"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { inChat, type WorkspaceRepo } from "@/lib/db";
import { approveIdeaFromChat, approvePostFromChat, handleMessage, type Attach } from "@/lib/studio";
import { uploadReferences } from "@/lib/reference";
import { parseWib } from "@/lib/pipeline";
import { workspaceOrThrow } from "@/lib/session";
import { isVisualStyle } from "@/lib/types";

export type StudioResult = { ok: boolean; error?: string; chatId?: string };

function fail(e: unknown): StudioResult {
  console.error(e);
  return { ok: false, error: e instanceof Error ? e.message : "Terjadi kesalahan" };
}

/** Jalankan pekerjaan agen setelah respons terkirim, supaya chat langsung responsif. */
function background(run: (() => Promise<void>) | null) {
  if (!run) return;
  after(async () => {
    await run();
    revalidatePath("/", "layout");
  });
}

/** Workspace pengguna + repo yang terkunci ke percakapan ini (pastikan chat milik workspace). */
async function chatScope(chatId: string): Promise<WorkspaceRepo> {
  const { w } = await workspaceOrThrow();
  if (!(await w.getChat(chatId))) throw new Error("Percakapan tidak ditemukan");
  return inChat(w, chatId);
}

const titleFrom = (text: string) => {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 48 ? t.slice(0, 46).trimEnd() + "…" : t || "Percakapan baru";
};

const DEFAULT_REF_TEXT = "Buatkan konten yang mirip dengan referensi ini.";

/** Ambil teks + gambar referensi dari form chat. */
async function readMessage(w: WorkspaceRepo, fd: FormData): Promise<{ msg: string; attach?: Attach }> {
  const files = fd.getAll("refs").filter((f): f is File => f instanceof File && f.size > 0);
  const urls = files.length ? await uploadReferences(w, files) : [];
  const text = String(fd.get("text") ?? "").trim().slice(0, 2000);
  const rawStyle = fd.get("style");
  const style = isVisualStyle(rawStyle) ? rawStyle : undefined;
  return {
    msg: text || (urls.length ? DEFAULT_REF_TEXT : ""),
    attach: urls.length || style ? { urls, useRefColors: fd.get("colors") !== "brand", style } : undefined,
  };
}

/** Dari Beranda: buat percakapan baru dengan pesan pertama (boleh berisi gambar referensi). */
export async function startChatAction(fd: FormData): Promise<StudioResult> {
  try {
    const { w } = await workspaceOrThrow();
    const hasText = String(fd.get("text") ?? "").trim() || fd.getAll("refs").some((f) => f instanceof File && f.size > 0);
    if (!hasText) return { ok: false, error: "Tulis kebutuhanmu atau lampirkan referensi" };
    const { msg, attach } = await readMessage(w, fd);
    const chat = await w.createChat(titleFrom(attach && msg === DEFAULT_REF_TEXT ? "Konten dari referensi" : msg));
    background(await handleMessage(inChat(w, chat.id), msg, attach));
    revalidatePath("/", "layout");
    return { ok: true, chatId: chat.id };
  } catch (e) {
    return fail(e);
  }
}

export async function sendChatAction(chatId: string, fd: FormData): Promise<StudioResult> {
  try {
    const c = await chatScope(chatId);
    const { msg, attach } = await readMessage(c, fd);
    if (!msg) return { ok: false, error: "Pesan kosong" };
    const first = (await c.listMessages(1)).length === 0;
    if (first) await c.updateChat(chatId, { title: titleFrom(msg) });
    background(await handleMessage(c, msg, attach));
    if (first) revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function chatApproveIdeaAction(chatId: string, ideaId: string): Promise<StudioResult> {
  try {
    background(await approveIdeaFromChat(await chatScope(chatId), ideaId));
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function chatRejectIdeaAction(chatId: string, ideaId: string): Promise<StudioResult> {
  try {
    const c = await chatScope(chatId);
    await c.updateIdea(ideaId, { status: "rejected" });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function chatApprovePostAction(chatId: string, postId: string, when: "now" | "schedule", scheduledAt: string): Promise<StudioResult> {
  try {
    const c = await chatScope(chatId);
    let at: Date | null = null;
    if (when === "schedule") {
      at = parseWib(scheduledAt);
      if (!at) return { ok: false, error: "Tanggal jadwal tidak valid" };
      if (at.getTime() < Date.now() + 5 * 60_000) return { ok: false, error: "Jadwal minimal 5 menit dari sekarang" };
    }
    background(await approvePostFromChat(c, postId, at));
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteChatAction(chatId: string): Promise<StudioResult> {
  try {
    const { w } = await workspaceOrThrow();
    await w.deleteChat(chatId);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
