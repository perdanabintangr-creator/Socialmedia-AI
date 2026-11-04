"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { approveIdeaFromChat, approvePostFromChat, handleMessage } from "@/lib/studio";
import { parseWib } from "@/lib/pipeline";
import { currentUser } from "@/lib/session";

export type StudioResult = { ok: boolean; error?: string };

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

async function authed() {
  if (!(await currentUser())) throw new Error("Sesi berakhir, silakan masuk lagi");
}

export async function sendChatAction(text: string): Promise<StudioResult> {
  const msg = text.trim().slice(0, 2000);
  if (!msg) return { ok: false, error: "Pesan kosong" };
  try {
    await authed();
    background(await handleMessage(msg));
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function chatApproveIdeaAction(ideaId: string): Promise<StudioResult> {
  try {
    await authed();
    background(await approveIdeaFromChat(ideaId));
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function chatRejectIdeaAction(ideaId: string): Promise<StudioResult> {
  try {
    await authed();
    await db().updateIdea(ideaId, { status: "rejected" });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function chatApprovePostAction(postId: string, when: "now" | "schedule", scheduledAt: string): Promise<StudioResult> {
  try {
    await authed();
    let at: Date | null = null;
    if (when === "schedule") {
      at = parseWib(scheduledAt);
      if (!at) return { ok: false, error: "Tanggal jadwal tidak valid" };
      if (at.getTime() < Date.now() + 5 * 60_000) return { ok: false, error: "Jadwal minimal 5 menit dari sekarang" };
    }
    background(await approvePostFromChat(postId, at));
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
