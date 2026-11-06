import "server-only";
import { randomUUID } from "crypto";
import type { WorkspaceRepo } from "./db";
import { generateIdeas } from "./ai";
import { metered } from "./cost";
import { brandGaps, planOf, quotaOf } from "./plans";
import { accSlot, approveAndPublish, buildPostFromIdea } from "./pipeline";
import { withVisualStyle, type Idea, type IdeaBatch, type VisualStyleKey } from "./types";

/**
 * Autopilot konten:
 * 1. AI menyusun rencana IDE seminggu / sebulan + tanggal tayang (state "proposed").
 * 2. Owner ACC idenya → masuk antrean ("queued").
 * 3. Antrean membuat konten satu per satu, lalu otomatis menjadwalkannya di slot tayang.
 * Owner tinggal menunggu; konten terjadwal tetap bisa direvisi (otomatis / dengan arahan).
 */

const STALE_MS = 6 * 60_000; // "building" lebih lama dari ini dianggap macet
const MAX_ATTEMPTS = 2;

export type PlanPeriod = "week" | "month";
export const PERIOD_COUNTS: Record<PlanPeriod, number[]> = { week: [3, 5, 7], month: [8, 12, 20, 30] };

/** Slot tayang tersebar rata selama `days` hari mulai besok, jam posting brand (WIB). */
export function planSlots(count: number, postingTime: string, days = 30, from = new Date()): string[] {
  const [hh, mm] = /^\d{2}:\d{2}$/.test(postingTime) ? postingTime.split(":").map(Number) : [19, 0];
  const day0 = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(from.getTime() + 24 * 3600_000),
  );
  const start = new Date(`${day0}T00:00:00+07:00`).getTime();
  const step = days / count;
  return Array.from({ length: count }, (_, i) => new Date(start + Math.floor(i * step) * 24 * 3600_000 + (hh * 60 + mm) * 60_000).toISOString());
}

export interface BatchProgress {
  total: number; // ide yang sudah di-ACC (masuk antrean) di semua rencana yang masih berjalan
  done: number;
  failed: number;
  building: number;
  queued: number;
  running: boolean;
  stalled: boolean; // ada antrean tapi tidak ada yang sedang dikerjakan
}

const isStale = (b: IdeaBatch) => b.state === "building" && (!b.startedAt || Date.now() - new Date(b.startedAt).getTime() > STALE_MS);

/** Progres antrean pembuatan (null bila tidak ada yang berjalan / baru selesai). */
export function batchProgress(ideas: Idea[]): BatchProgress | null {
  const active = ideas.filter((i) => i.batch && i.batch.state !== "proposed");
  if (!active.length) return null;
  // Hanya rencana yang masih punya antrean, atau yang baru selesai < 1 jam.
  const recent = Date.now() - 3600_000;
  const liveBatches = new Set(
    active.filter((i) => ["queued", "building"].includes(i.batch!.state) || new Date(i.created_at).getTime() > recent).map((i) => i.batch!.id),
  );
  const items = active.filter((i) => liveBatches.has(i.batch!.id)).map((i) => i.batch!);
  if (!items.length) return null;
  const count = (s: IdeaBatch["state"]) => items.filter((b) => b.state === s).length;
  const buildingFresh = items.filter((b) => b.state === "building" && !isStale(b)).length;
  const pending = count("queued") + items.filter(isStale).length;
  return {
    total: items.length,
    done: count("done"),
    failed: count("failed"),
    building: count("building"),
    queued: count("queued"),
    running: pending + buildingFresh > 0,
    stalled: pending > 0 && buildingFresh === 0,
  };
}

/** Ide rencana yang menunggu ACC, urut tanggal tayang. */
export function proposedIdeas(ideas: Idea[]): Idea[] {
  return ideas
    .filter((i) => i.batch?.state === "proposed" && i.status === "pending")
    .sort((a, b) => a.batch!.plannedAt.localeCompare(b.batch!.plannedAt));
}

/** Susun rencana IDE (belum memakai kuota konten). */
export async function proposePlan(
  w: WorkspaceRepo,
  opts: { period: PlanPeriod; count: number; brief: string; style?: VisualStyleKey | "auto" },
): Promise<{ count: number }> {
  const brand = await w.getBrand();
  const count = Math.max(1, Math.min(opts.count, 30));
  const reference = withVisualStyle(null, opts.style ?? brand.visualStyle);
  const all = await w.listIdeas();
  const recent = all.slice(0, 60).map((i) => i.title);
  const ideas = await generateIdeas(brand, {
    brief: opts.brief,
    count,
    recentTitles: recent,
    month: opts.period === "month",
    reference: reference?.notes,
  });
  // Mulai setelah slot terakhir yang sudah direncanakan supaya tidak bertumpuk.
  const lastPlanned = all
    .map((i) => i.batch?.plannedAt)
    .filter((d): d is string => Boolean(d) && new Date(d!).getTime() > Date.now())
    .sort()
    .at(-1);
  const from = lastPlanned ? new Date(lastPlanned) : new Date();
  const slots = planSlots(ideas.length, brand.postingTime, opts.period === "week" ? 7 : 30, from);
  const batchId = randomUUID();
  await w.createIdeas(
    ideas.map((i, n) => ({
      ...i,
      reference,
      batch: { id: batchId, plannedAt: slots[n], state: "proposed", startedAt: null, attempts: 0, error: null, auto: true } satisfies IdeaBatch,
    })),
  );
  return { count: ideas.length };
}

/** ACC ide rencana → masuk antrean pembuatan + penjadwalan otomatis. */
export async function acceptPlanIdeas(w: WorkspaceRepo, ids: string[]): Promise<{ accepted: number; skipped: number; message: string }> {
  const quota = await quotaOf(w);
  if (!quota.ok) throw new Error(quota.message);
  const plan = await planOf(w.id);
  if (plan.quality === "full") {
    const gaps = brandGaps(await w.getBrand());
    if (gaps.length) throw new Error(`Lengkapi Brand Kit dulu supaya hasilnya on-brand: ${gaps.join(" & ")}.`);
  }
  const all = await w.listIdeas();
  const inQueue = all.filter((i) => i.batch && ["queued", "building"].includes(i.batch.state)).length;
  const room = Math.max(0, (Number.isFinite(quota.left) ? quota.left : 999) - inQueue);
  const wanted = proposedIdeas(all).filter((i) => ids.includes(i.id));
  const take = wanted.slice(0, room);
  for (const i of take) {
    await w.updateIdea(i.id, { status: "approved", batch: { ...i.batch!, state: "queued", attempts: 0, error: null } });
  }
  const skipped = wanted.length - take.length;
  return {
    accepted: take.length,
    skipped,
    message: skipped ? `Kuota paket ${quota.plan.label} hanya cukup untuk ${take.length} konten lagi; ${skipped} ide tetap menunggu.` : "",
  };
}

/** Pindahkan tanggal tayang ide (sebelum dibuat). */
export async function moveIdeaSlot(w: WorkspaceRepo, id: string, when: Date) {
  const idea = await w.getIdea(id);
  if (!idea?.batch) throw new Error("Ide tidak ditemukan");
  await w.updateIdea(id, { batch: { ...idea.batch, plannedAt: when.toISOString() } });
}

/**
 * Kerjakan SATU konten dari antrean (semua rencana, urut tanggal tayang).
 * Mengembalikan true bila masih ada antrean berikutnya.
 */
export async function processBatchStep(w: WorkspaceRepo): Promise<boolean> {
  const ideas = await w.listIdeas();
  const items = ideas
    .filter((i) => i.batch && ["queued", "building"].includes(i.batch.state))
    .sort((a, b) => a.batch!.plannedAt.localeCompare(b.batch!.plannedAt));
  // Satu pekerja per workspace: bila ada yang sedang dibuat (belum macet), berhenti.
  if (items.some((i) => i.batch!.state === "building" && !isStale(i.batch!))) return false;
  const next = items.find((i) => i.batch!.state === "queued" || isStale(i.batch!));
  if (!next) return false;

  const batch = next.batch!;
  const others = () => items.some((i) => i.id !== next.id && i.batch!.state === "queued");
  if (batch.attempts >= MAX_ATTEMPTS) {
    await w.updateIdea(next.id, { batch: { ...batch, state: "failed", error: batch.error ?? "Gagal dibuat" } });
    return others();
  }
  await w.updateIdea(next.id, { batch: { ...batch, state: "building", startedAt: new Date().toISOString(), attempts: batch.attempts + 1 } });
  try {
    const quota = await quotaOf(w);
    if (!quota.ok) throw new Error(quota.message);
    const post = await metered(w, "build_post", () => buildPostFromIdea(w, next.id), (p) => p.id);
    await w.updatePost(post.id, { planned_at: batch.plannedAt });
    let error: string | null = null;
    if (batch.auto) {
      // Autopilot: langsung jadwalkan di slot tayang.
      const brand = await w.getBrand();
      const res = await approveAndPublish(w, post.id, accSlot({ planned_at: batch.plannedAt }, brand.postingTime)).catch((e) => ({
        ok: false,
        message: e instanceof Error ? e.message : "gagal menjadwalkan",
      }));
      if (!res.ok) error = `Konten jadi, tapi gagal dijadwalkan: ${res.message}`;
    }
    await w.updateIdea(next.id, { batch: { ...batch, state: "done", startedAt: null, attempts: batch.attempts + 1, error } });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Gagal dibuat";
    const quotaOut = /kuota|kesempatan/i.test(error);
    await w.updateIdea(next.id, {
      batch: { ...batch, state: quotaOut || batch.attempts + 1 >= MAX_ATTEMPTS ? "failed" : "queued", startedAt: null, attempts: batch.attempts + 1, error },
    });
    if (quotaOut) {
      for (const i of items) if (i.id !== next.id && i.batch!.state === "queued") await w.updateIdea(i.id, { batch: { ...i.batch!, state: "failed", error } });
      return false;
    }
  }
  return true;
}

/** URL dasar untuk memanggil diri sendiri (domain produksi, bukan URL deployment yang terproteksi). */
export function selfOrigin(fallback: string): string {
  const app = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (app && /^https?:\/\//.test(app)) return app;
  const prod = process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return prod ? `https://${prod}` : fallback;
}

/**
 * Jalankan antrean. Di Vercel: tiap langkah = 1 pemanggilan fungsi (berantai lewat /api/cron/batch)
 * supaya tidak kena batas durasi. Tanpa CRON_SECRET (lokal): langsung berurutan di proses ini.
 */
export async function runBatch(w: WorkspaceRepo, origin: string): Promise<void> {
  if (!process.env.CRON_SECRET?.trim()) {
    while (await processBatchStep(w)) {
      // lanjut sampai habis
    }
    return;
  }
  await kickBatch(w.id, origin);
}

export async function kickBatch(workspaceId: string, origin: string): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return;
  try {
    await fetch(`${selfOrigin(origin)}/api/cron/batch`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ ws: workspaceId }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    console.error("Gagal memicu antrean:", e);
  }
}
