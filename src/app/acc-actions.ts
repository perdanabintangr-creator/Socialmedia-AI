"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { workspaceOrThrow } from "@/lib/session";
import { metered } from "@/lib/cost";
import { accSlot, approveAndPublish, autoRevisePost, isRevising, parseWib, reopenPost, revisePostWith } from "@/lib/pipeline";
import { acceptPlanIdeas, batchProgress, moveIdeaSlot, proposePlan, runBatch } from "@/lib/month";
import { isVisualStyle } from "@/lib/types";
import type { WorkspaceRepo } from "@/lib/db";

export type AccResult = { ok: boolean; message: string };

const fail = (e: unknown): AccResult => ({ ok: false, message: e instanceof Error ? e.message : "Terjadi kesalahan" });

async function origin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
}

/** Langkah 1: AI menyusun rencana IDE seminggu / sebulan (belum memakai kuota). */
export async function proposePlanAction(fd: FormData): Promise<AccResult> {
  try {
    const { w } = await workspaceOrThrow();
    const rawStyle = fd.get("style");
    const period = fd.get("period") === "week" ? "week" : "month";
    const res = await metered(w, "ideas", () =>
      proposePlan(w, {
        period,
        count: Number(fd.get("count")) || (period === "week" ? 5 : 12),
        brief: String(fd.get("brief") ?? "").trim().slice(0, 1000),
        style: isVisualStyle(rawStyle) ? rawStyle : undefined,
      }),
    );
    revalidatePath("/", "layout");
    return { ok: true, message: `${res.count} ide ${period === "week" ? "seminggu" : "sebulan"} sudah disusun lengkap dengan jadwalnya. ACC yang kamu suka — sisanya otomatis.` };
  } catch (e) {
    return fail(e);
  }
}

/** Langkah 2: ACC ide → dibuatkan konten & dijadwalkan otomatis. */
export async function acceptIdeasAction(ids: string[]): Promise<AccResult> {
  try {
    const { w } = await workspaceOrThrow();
    const res = await acceptPlanIdeas(w, ids);
    if (res.accepted) {
      const o = await origin();
      after(() => runBatch(w, o));
    }
    revalidatePath("/", "layout");
    return {
      ok: res.accepted > 0,
      message: res.accepted
        ? `${res.accepted} ide di-ACC. Tim AI membuat kontennya dan menjadwalkannya otomatis — kamu tinggal tunggu tayang.${res.message ? ` ${res.message}` : ""}`
        : res.message || "Tidak ada ide yang bisa di-ACC",
    };
  } catch (e) {
    return fail(e);
  }
}

export async function rejectIdeasAction(ids: string[]): Promise<AccResult> {
  try {
    const { w } = await workspaceOrThrow();
    for (const id of ids.slice(0, 60)) await w.updateIdea(id, { status: "rejected" });
    revalidatePath("/", "layout");
    return { ok: true, message: ids.length > 1 ? `${ids.length} ide dilewati` : "Ide dilewati" };
  } catch (e) {
    return fail(e);
  }
}

export async function moveIdeaAction(id: string, local: string): Promise<AccResult> {
  try {
    const { w } = await workspaceOrThrow();
    const d = parseWib(local);
    if (!d) return { ok: false, message: "Tanggal tidak valid" };
    await moveIdeaSlot(w, id, d);
    revalidatePath("/acc");
    return { ok: true, message: "Jadwal ide diubah" };
  } catch (e) {
    return fail(e);
  }
}

/** Lanjutkan antrean yang terhenti (mis. fungsi sebelumnya terputus). */
export async function resumeBatchAction(): Promise<AccResult> {
  try {
    const { w } = await workspaceOrThrow();
    const progress = batchProgress(await w.listIdeas());
    if (!progress?.stalled) return { ok: true, message: "" };
    const o = await origin();
    after(() => runBatch(w, o));
    return { ok: true, message: "Antrean dilanjutkan" };
  } catch (e) {
    return fail(e);
  }
}

async function startRevision(w: WorkspaceRepo, id: string, run: () => Promise<unknown>) {
  const post = await w.getPost(id);
  if (!post) throw new Error("Konten tidak ditemukan");
  if (isRevising(post)) throw new Error("Konten ini masih direvisi, tunggu sebentar ya");
  // Konten autopilot yang sudah terjadwal: batalkan jadwal dulu, revisi, lalu jadwalkan ulang di slot yang sama.
  const reschedule = post.status === "approved" || post.status === "scheduled";
  const opened = await reopenPost(w, post);
  await w.updatePost(id, { revising_since: new Date().toISOString() });
  const postingTime = (await w.getBrand()).postingTime;
  after(async () => {
    try {
      await metered(w, "revise", run, () => id);
    } catch (e) {
      console.error("Revisi latar belakang gagal:", e);
    } finally {
      await w.updatePost(id, { revising_since: null });
      if (reschedule) {
        await approveAndPublish(w, id, accSlot(opened, postingTime)).catch((e) => console.error("Jadwal ulang gagal:", e));
      }
    }
  });
}

/** Revisi otomatis: AI mengkritik & memperbaiki kontennya sendiri. */
export async function autoReviseAction(id: string): Promise<AccResult> {
  try {
    const { w } = await workspaceOrThrow();
    await startRevision(w, id, () => autoRevisePost(w, id));
    revalidatePath("/acc");
    return { ok: true, message: "AI sedang memperbaiki konten ini…" };
  } catch (e) {
    return fail(e);
  }
}

/** Revisi dengan arahan owner (chat). */
export async function chatReviseAction(id: string, instruction: string): Promise<AccResult> {
  try {
    const text = instruction.trim().slice(0, 1500);
    if (!text) return { ok: false, message: "Tulis dulu revisi yang diinginkan" };
    const { w } = await workspaceOrThrow();
    await startRevision(w, id, () => revisePostWith(w, id, text));
    revalidatePath("/acc");
    return { ok: true, message: "Revisi sedang dikerjakan…" };
  } catch (e) {
    return fail(e);
  }
}

/** Batalkan jadwal konten autopilot → kembali ke "Menunggu ACC". */
export async function cancelScheduleAction(id: string): Promise<AccResult> {
  try {
    const { w } = await workspaceOrThrow();
    const post = await w.getPost(id);
    if (!post) return { ok: false, message: "Konten tidak ditemukan" };
    await reopenPost(w, post);
    revalidatePath("/", "layout");
    return { ok: true, message: "Jadwal dibatalkan. Konten pindah ke Menunggu ACC." };
  } catch (e) {
    return fail(e);
  }
}

/** Ubah slot tayang (WIB, "YYYY-MM-DDTHH:mm"). Konten terjadwal dijadwalkan ulang otomatis. */
export async function setPlannedAction(id: string, local: string): Promise<AccResult> {
  try {
    const { w } = await workspaceOrThrow();
    const d = parseWib(local);
    if (!d) return { ok: false, message: "Tanggal tidak valid" };
    const post = await w.getPost(id);
    if (!post) return { ok: false, message: "Konten tidak ditemukan" };
    if (post.status === "approved" || post.status === "scheduled") {
      if (d.getTime() < Date.now() + 10 * 60_000) return { ok: false, message: "Jadwal minimal 10 menit dari sekarang" };
      await reopenPost(w, post);
      await w.updatePost(id, { planned_at: d.toISOString() });
      const res = await approveAndPublish(w, id, d);
      revalidatePath("/", "layout");
      return { ok: res.ok, message: res.ok ? "Jadwal tayang diubah" : res.message };
    }
    await w.updatePost(id, { planned_at: d.toISOString() });
    revalidatePath("/acc");
    return { ok: true, message: "Jadwal diubah" };
  } catch (e) {
    return fail(e);
  }
}

async function accOne(w: WorkspaceRepo, id: string, postingTime: string) {
  const post = await w.getPost(id);
  if (!post) return { ok: false, message: "Konten tidak ditemukan" };
  if (isRevising(post)) return { ok: false, message: "Masih direvisi" };
  return approveAndPublish(w, id, accSlot(post, postingTime));
}

/** ACC satu konten → terjadwal sesuai slot rencana. */
export async function accAction(id: string): Promise<AccResult> {
  try {
    const { w } = await workspaceOrThrow();
    const res = await accOne(w, id, (await w.getBrand()).postingTime);
    revalidatePath("/", "layout");
    return { ok: res.ok, message: res.message };
  } catch (e) {
    return fail(e);
  }
}

/** ACC sekaligus untuk konten yang dicentang. */
export async function accManyAction(ids: string[]): Promise<AccResult> {
  try {
    const { w } = await workspaceOrThrow();
    const time = (await w.getBrand()).postingTime;
    let ok = 0;
    const errors: string[] = [];
    for (const id of ids.slice(0, 30)) {
      const res = await accOne(w, id, time).catch((e) => ({ ok: false, message: e instanceof Error ? e.message : "gagal" }));
      if (res.ok) ok++;
      else errors.push(res.message);
    }
    revalidatePath("/", "layout");
    return errors.length
      ? { ok: ok > 0, message: `${ok} konten di-ACC. ${errors.length} gagal: ${[...new Set(errors)].slice(0, 2).join("; ")}` }
      : { ok: true, message: `${ok} konten di-ACC dan masuk jadwal.` };
  } catch (e) {
    return fail(e);
  }
}

export async function rejectAction(id: string): Promise<AccResult> {
  try {
    const { w } = await workspaceOrThrow();
    await w.updatePost(id, { status: "rejected" });
    revalidatePath("/", "layout");
    return { ok: true, message: "Konten ditolak" };
  } catch (e) {
    return fail(e);
  }
}
