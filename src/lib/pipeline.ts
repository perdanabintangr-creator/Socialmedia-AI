import "server-only";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { accounts, type WorkspaceRepo } from "./db";
import { generateIdeas, generatePost, reviewDesign, revisePost, type Draft } from "./ai";
import { renderSlidePng, renderSlidesJpeg } from "./render";
import { sourceImage } from "./images";
import { publish } from "./publisher";
import { config } from "./config";
import type { AgentId } from "./agents";
import type { Brand, Idea, Post, PostFormat, Slide } from "./types";

/**
 * Inti alur kerja: ide → konten (copy + visual + review) → ACC → posting.
 * Dipakai oleh dashboard (server actions) dan Studio chat (tim agen).
 * `progress` dipanggil saat tiap agen menyelesaikan tahapannya.
 */
export type Progress = (agent: AgentId, text: string) => Promise<void>;
const silent: Progress = async () => {};

export async function createIdeas(w: WorkspaceRepo, brief: string, count: number, format?: PostFormat): Promise<Idea[]> {
  const brand = await w.getBrand();
  const recent = (await w.listIdeas()).slice(0, 40).map((i) => i.title);
  const formatHint = format ? `\nSemua ide harus berformat ${format === "single" ? "single post" : "carousel"}.` : "";
  const ideas = await generateIdeas(brand, { brief: brief + formatHint, count, recentTitles: recent });
  return w.createIdeas(ideas.map((i) => (format ? { ...i, format } : i)));
}

/** Isi gambar untuk slide yang membutuhkannya (paralel, maks 3 sekaligus). */
export async function materialize(w: WorkspaceRepo, brand: Brand, draft: Pick<Draft, "slides">, key: string): Promise<Slide[]> {
  const out = draft.slides.map((d) => d.slide);
  const jobs = draft.slides.map((d, i) => ({ d, i })).filter(({ d }) => d.imageRequest);
  for (let n = 0; n < jobs.length; n += 3) {
    await Promise.all(
      jobs.slice(n, n + 3).map(async ({ d, i }) => {
        out[i] = { ...out[i], image: await sourceImage(w, brand, d.imageRequest!, `${key}-${i}`, i) };
      }),
    );
  }
  return out;
}

/** AI art director: render → lihat → perbaiki (1 putaran). */
async function artDirector(
  w: WorkspaceRepo,
  brand: Brand,
  post: Pick<Post, "slides" | "format" | "caption" | "template">,
  key: string,
): Promise<{ slides: Slide[]; notes: string | null }> {
  if (!brand.autoReview || !config.hasAI) return { slides: post.slides, notes: null };
  try {
    const renders: string[] = [];
    for (let i = 0; i < post.slides.length; i++) {
      const png = await renderSlidePng(brand, post, i);
      renders.push((await sharp(png).resize(540).jpeg({ quality: 75 }).toBuffer()).toString("base64"));
    }
    const review = await reviewDesign(brand, post, renders);
    if (!review) return { slides: post.slides, notes: null };
    if (review.verdict === "approve") return { slides: post.slides, notes: review.notes };
    return { slides: await materialize(w, brand, review, `${key}-qa`), notes: review.notes };
  } catch (e) {
    console.error("Review art director gagal (konten tetap dipakai):", e);
    return { slides: post.slides, notes: null };
  }
}

const countPhotos = (slides: Slide[]) => slides.filter((s) => s.image).length;
const firstHook = (slides: Slide[]) => slides[0]?.headline.replace(/\*/g, "") ?? "";

/** Ide yang sudah di-ACC → konten lengkap siap review. */
export async function buildPostFromIdea(w: WorkspaceRepo, ideaId: string, progress: Progress = silent): Promise<Post> {
  const idea = await w.getIdea(ideaId);
  if (!idea) throw new Error("Ide tidak ditemukan");
  if (idea.post_id) {
    const existing = await w.getPost(idea.post_id);
    if (existing) return existing;
  }
  await w.updateIdea(ideaId, { status: "approved" });
  const brand = await w.getBrand();

  const draft = await generatePost(brand, idea);
  await progress(
    "kata",
    `Naskah ${draft.slides.length > 1 ? `${draft.slides.length} slide` : "single post"} + caption sudah jadi. Hook-nya: “${firstHook(draft.slides.map((d) => d.slide))}”. Aku oper ke Rupa ya.`,
  );

  const key = randomUUID();
  const slides = await materialize(w, brand, draft, key);
  const photos = countPhotos(slides);
  await progress(
    "rupa",
    `Layout & visual sudah tersusun${photos ? ` (${photos} foto)` : ""}.${brand.autoReview && config.hasAI ? " Aku cek ulang hasil rendernya dulu sebelum kukirim." : ""}`,
  );

  const reviewed = await artDirector(w, brand, { slides, format: idea.format, caption: draft.caption, template: brand.defaultTemplate }, key);
  const post = await w.createPost({
    idea_id: idea.id,
    title: draft.title || idea.title,
    format: idea.format,
    platforms: ["instagram", "tiktok"],
    caption: draft.caption,
    hashtags: draft.hashtags,
    slides: reviewed.slides,
    template: brand.defaultTemplate,
    status: "review",
    design_notes: reviewed.notes,
  });
  await w.updateIdea(ideaId, { status: "approved", post_id: post.id });
  return post;
}

export async function revisePostWith(w: WorkspaceRepo, postId: string, instruction: string, progress: Progress = silent): Promise<Post> {
  const post = await w.getPost(postId);
  if (!post) throw new Error("Konten tidak ditemukan");
  if (!["review", "failed"].includes(post.status)) throw new Error("Konten ini sudah di-ACC, tidak bisa direvisi lagi");
  const brand = await w.getBrand();
  const draft = await revisePost(brand, post, instruction);
  await progress("kata", "Revisi naskah sudah kuterapkan. Rupa, tolong sesuaikan visualnya.");
  const slides = await materialize(w, brand, draft, `${post.id}-r${post.revision_count + 1}`);
  const patch = {
    title: draft.title,
    caption: draft.caption,
    hashtags: draft.hashtags,
    slides,
    status: "review" as const,
    revision_count: post.revision_count + 1,
  };
  await w.updatePost(postId, patch);
  return { ...post, ...patch, updated_at: new Date().toISOString() };
}

/** "2026-11-05T19:00" (WIB) → Date. */
export function parseWib(local: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const d = new Date(`${local}:00+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function defaultScheduleWib(postingTime: string): string {
  const tomorrow = new Date(Date.now() + 24 * 3600_000);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(tomorrow);
  return `${date}T${postingTime}`;
}

export function nowWib() {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

/** ACC konten → render final → upload → kirim ke publisher (sekarang / terjadwal). */
export async function approveAndPublish(w: WorkspaceRepo, postId: string, scheduleAt: Date | null): Promise<{ post: Post; message: string; ok: boolean }> {
  const post = await w.getPost(postId);
  if (!post) throw new Error("Konten tidak ditemukan");
  if (!["review", "failed", "approved"].includes(post.status)) throw new Error("Konten ini sudah dikirim ke jadwal posting");
  if (scheduleAt && scheduleAt.getTime() < Date.now() + 5 * 60_000) throw new Error("Jadwal minimal 5 menit dari sekarang");
  const brand = await w.getBrand();

  const jpgs = await renderSlidesJpeg(brand, post);
  const stamp = Date.now();
  const mediaUrls: string[] = [];
  for (let i = 0; i < jpgs.length; i++) {
    mediaUrls.push(await w.uploadFile(`posts/${post.id}/${stamp}-${i + 1}.jpg`, jpgs[i], "image/jpeg"));
  }
  const text = [post.caption, post.hashtags.map((h) => `#${h}`).join(" ")].filter(Boolean).join("\n\n");

  const target = await publishTarget(w.id);
  if (!target.connected) {
    const patch = { status: "approved" as const, media_urls: mediaUrls, scheduled_at: scheduleAt?.toISOString() ?? null, error: null };
    await w.updatePost(postId, patch);
    return {
      post: { ...post, ...patch },
      ok: true,
      message: `Desain final sudah kurender. ${target.reason} Untuk sementara gambarnya bisa diunduh dan diposting manual.`,
    };
  }
  if (!mediaUrls.every((u) => u.startsWith("https://"))) {
    throw new Error("Gambar harus punya URL publik https (pakai Supabase Storage di produksi)");
  }
  const result = await publish({ text, mediaUrls, platforms: post.platforms, scheduleAt, profileKey: target.profileKey });
  const patch = {
    status: (result.ok ? (scheduleAt ? "scheduled" : "published") : "failed") as Post["status"],
    media_urls: mediaUrls,
    scheduled_at: (scheduleAt ?? new Date()).toISOString(),
    publish_ref: result.ref,
    publish_result: result.raw,
    error: result.error,
  };
  await w.updatePost(postId, patch);
  return {
    post: { ...post, ...patch },
    ok: result.ok,
    message: result.ok ? (scheduleAt ? "Terjadwal, akan terbit otomatis." : "Terkirim, sedang diposting.") : `Gagal posting: ${result.error}`,
  };
}

/**
 * Ke akun sosmed mana workspace ini memposting.
 * - Workspace klien: wajib punya Profile-Key Ayrshare sendiri (diisi owner aplikasi di halaman Pengguna).
 * - Workspace milik admin/owner aplikasi: boleh memakai akun Ayrshare utama.
 * Tanpa itu, konten TIDAK diposting — supaya konten klien tidak pernah masuk ke akun orang lain.
 */
export async function publishTarget(workspaceId: string): Promise<{ connected: boolean; profileKey: string | null; reason: string }> {
  if (!config.hasPublisher) return { connected: false, profileKey: null, reason: "Auto-posting belum aktif di aplikasi ini." };
  const ws = await accounts().getWorkspace(workspaceId);
  if (ws?.publish_key) return { connected: true, profileKey: ws.publish_key, reason: "" };
  const owner = ws?.owner_id ? await accounts().getUserById(ws.owner_id) : null;
  if (owner?.role === "admin") return { connected: true, profileKey: null, reason: "" };
  return { connected: false, profileKey: null, reason: "Akun Instagram/TikTok workspace ini belum dihubungkan." };
}
