"use server";

import { revalidatePath } from "next/cache";
import { workspaceOrThrow } from "@/lib/session";
import { InsightError, addLink, postUrlsFromPublish, refreshLink } from "@/lib/insights";
import type { WorkspaceRepo } from "@/lib/db";
import type { ActionState } from "@/app/actions";

const done = () => revalidatePath("/performa");

/** Konten yang sudah terbit lewat SosmedAutopilot langsung ikut dipantau. */
async function importPublished(w: WorkspaceRepo) {
  const [posts, links] = await Promise.all([w.listPosts(), w.listLinks()]);
  const have = new Set(links.map((l) => l.url));
  for (const p of posts.filter((x) => x.status === "published")) {
    for (const url of postUrlsFromPublish(p.publish_result)) {
      if (have.has(url)) continue;
      have.add(url);
      await addLink(w, url, p.id).catch(() => {});
    }
  }
}

export async function enablePerformanceAction(): Promise<void> {
  const { w } = await workspaceOrThrow();
  const brand = await w.getBrand();
  await w.saveBrand({ ...brand, performance: true });
  await importPublished(w);
  done();
}

export async function disablePerformanceAction(): Promise<void> {
  const { w } = await workspaceOrThrow();
  const brand = await w.getBrand();
  await w.saveBrand({ ...brand, performance: false });
  done();
}

export async function addLinkAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { w } = await workspaceOrThrow();
  const raw = String(fd.get("url") ?? "").trim();
  if (!raw) return { error: "Tempel link TikTok atau Instagram dulu." };
  if ((await w.listLinks()).length >= 50) return { error: "Maksimal 50 link per workspace. Hapus yang sudah tidak perlu." };
  try {
    const link = await addLink(w, raw);
    done();
    if (link.status === "ok") return { ok: "Terbaca! Angkanya sudah masuk." };
    return { ok: `Link disimpan. ${link.error ?? ""}`.trim() };
  } catch (e) {
    if (e instanceof InsightError) return { error: e.message };
    console.error(e);
    return { error: "Gagal menyimpan link. Coba lagi sebentar." };
  }
}

export async function refreshLinkAction(id: string): Promise<void> {
  const { w } = await workspaceOrThrow();
  const link = await w.getLink(id);
  if (link) await refreshLink(w, link);
  done();
}

export async function refreshAllAction(): Promise<void> {
  const { w } = await workspaceOrThrow();
  await importPublished(w);
  const links = await w.listLinks();
  // paralel kecil-kecilan supaya cepat tapi tidak membanjiri platform
  for (let i = 0; i < links.length; i += 4) await Promise.all(links.slice(i, i + 4).map((l) => refreshLink(w, l)));
  done();
}

export async function deleteLinkAction(id: string): Promise<void> {
  const { w } = await workspaceOrThrow();
  await w.deleteLink(id);
  done();
}
