import "server-only";
import { randomUUID } from "crypto";
import type { WorkspaceRepo } from "./db";
import { generateIdeas } from "./ai";
import { metered } from "./cost";
import { brandGaps, planOf, quotaOf } from "./plans";
import { buildPostFromIdea } from "./pipeline";
import { withVisualStyle, type Idea, type IdeaBatch, type VisualStyleKey } from "./types";

/**
 * "Konten sebulan sekali klik": AI menyusun kalender 1 bulan (N ide + slot tayang), lalu
 * konten dibuat satu per satu di latar belakang (antrean berantai). Owner tinggal ACC di Mode ACC.
 */

const STALE_MS = 6 * 60_000; // "building" lebih lama dari ini dianggap macet
const MAX_ATTEMPTS = 2;

export const MONTH_COUNTS = [8, 12, 20, 30] as const;

/** Slot tayang tersebar rata selama 30 hari mulai besok, jam posting default brand (WIB). */
export function planSlots(count: number, postingTime: string, from = new Date()): string[] {
  const [hh, mm] = /^\d{2}:\d{2}$/.test(postingTime) ? postingTime.split(":").map(Number) : [19, 0];
  const day0 = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(from.getTime() + 24 * 3600_000),
  );
  const start = new Date(`${day0}T00:00:00+07:00`).getTime();
  const step = 30 / count;
  return Array.from({ length: count }, (_, i) => {
    const day = Math.floor(i * step);
    return new Date(start + day * 24 * 3600_000 + (hh * 60 + mm) * 60_000).toISOString();
  });
}

export interface BatchProgress {
  id: string;
  total: number;
  done: number;
  failed: number;
  building: number;
  queued: number;
  running: boolean; // ada yang sedang/masih akan dibuat
  stalled: boolean; // ada antrean tapi tidak ada yang sedang dikerjakan
}

const isStale = (b: IdeaBatch) => b.state === "building" && (!b.startedAt || Date.now() - new Date(b.startedAt).getTime() > STALE_MS);

/** Progres rencana bulanan terbaru (null bila belum pernah). */
export function batchProgress(ideas: Idea[]): BatchProgress | null {
  const withBatch = ideas.filter((i) => i.batch);
  if (!withBatch.length) return null;
  const latest = withBatch.reduce((a, b) => (a.created_at > b.created_at ? a : b)).batch!.id;
  const items = withBatch.filter((i) => i.batch!.id === latest).map((i) => i.batch!);
  const count = (s: IdeaBatch["state"]) => items.filter((b) => b.state === s).length;
  const buildingFresh = items.filter((b) => b.state === "building" && !isStale(b)).length;
  const pending = count("queued") + items.filter(isStale).length;
  return {
    id: latest,
    total: items.length,
    done: count("done"),
    failed: count("failed"),
    building: count("building"),
    queued: count("queued"),
    running: pending + buildingFresh > 0,
    stalled: pending > 0 && buildingFresh === 0,
  };
}

/** Susun rencana bulanan: ide + slot tayang, masuk antrean. Mengembalikan jumlah konten. */
export async function startMonthPlan(
  w: WorkspaceRepo,
  opts: { count: number; brief: string; style?: VisualStyleKey | "auto" },
): Promise<{ batchId: string; count: number }> {
  const progress = batchProgress(await w.listIdeas());
  if (progress?.running) throw new Error(`Rencana bulanan sebelumnya masih dibuat (${progress.done}/${progress.total}). Tunggu sampai selesai ya.`);
  const quota = await quotaOf(w);
  if (!quota.ok) throw new Error(quota.message);
  const plan = await planOf(w.id);
  const brand = await w.getBrand();
  if (plan.quality === "full") {
    const gaps = brandGaps(brand);
    if (gaps.length) throw new Error(`Lengkapi Brand Kit dulu supaya hasilnya on-brand: ${gaps.join(" & ")}.`);
  }
  const count = Math.max(1, Math.min(opts.count, 30, quota.left));
  const reference = withVisualStyle(null, opts.style ?? brand.visualStyle);
  const recent = (await w.listIdeas()).slice(0, 60).map((i) => i.title);
  const ideas = await generateIdeas(brand, { brief: opts.brief, count, recentTitles: recent, month: true, reference: reference?.notes });
  const slots = planSlots(ideas.length, brand.postingTime);
  const batchId = randomUUID();
  const created = await w.createIdeas(
    ideas.map((i, n) => ({
      ...i,
      reference,
      batch: { id: batchId, plannedAt: slots[n], state: "queued", startedAt: null, attempts: 0, error: null } satisfies IdeaBatch,
    })),
  );
  await Promise.all(created.map((i) => w.updateIdea(i.id, { status: "approved" })));
  return { batchId, count: created.length };
}

/**
 * Kerjakan SATU konten dari antrean. Mengembalikan true bila masih ada antrean berikutnya.
 * Aman dipanggil berulang: konten yang sedang dikerjakan pekerja lain dilewati.
 */
export async function processBatchStep(w: WorkspaceRepo): Promise<boolean> {
  const ideas = await w.listIdeas();
  const progress = batchProgress(ideas);
  if (!progress) return false;
  const items = ideas
    .filter((i) => i.batch?.id === progress.id)
    .sort((a, b) => a.batch!.plannedAt.localeCompare(b.batch!.plannedAt));
  // Satu pekerja per workspace: bila ada yang sedang dibuat (belum macet), berhenti.
  if (items.some((i) => i.batch!.state === "building" && !isStale(i.batch!))) return false;
  const next = items.find((i) => i.batch!.state === "queued" || isStale(i.batch!));
  if (!next) return false;

  const batch = next.batch!;
  if (batch.attempts >= MAX_ATTEMPTS) {
    await w.updateIdea(next.id, { batch: { ...batch, state: "failed", error: batch.error ?? "Gagal dibuat" } });
    return items.some((i) => i.id !== next.id && i.batch!.state === "queued");
  }
  await w.updateIdea(next.id, { batch: { ...batch, state: "building", startedAt: new Date().toISOString(), attempts: batch.attempts + 1 } });
  try {
    const quota = await quotaOf(w);
    if (!quota.ok) throw new Error(quota.message);
    const post = await metered(w, "build_post", () => buildPostFromIdea(w, next.id), (p) => p.id);
    await w.updatePost(post.id, { planned_at: batch.plannedAt });
    await w.updateIdea(next.id, { batch: { ...batch, state: "done", startedAt: null, attempts: batch.attempts + 1, error: null } });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Gagal dibuat";
    const quotaOut = /kuota|kesempatan/i.test(error);
    await w.updateIdea(next.id, {
      batch: { ...batch, state: quotaOut || batch.attempts + 1 >= MAX_ATTEMPTS ? "failed" : "queued", startedAt: null, attempts: batch.attempts + 1, error },
    });
    if (quotaOut) {
      // Kuota habis: sisa antrean dibatalkan.
      for (const i of items) if (i.batch!.state === "queued") await w.updateIdea(i.id, { batch: { ...i.batch!, state: "failed", error } });
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
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
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
    console.error("Gagal memicu antrean bulanan:", e);
  }
}
