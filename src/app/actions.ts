"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { db } from "@/lib/db";
import { analyzeExamples, generateIdeas, generatePost, reviewDesign, revisePost, type Draft } from "@/lib/ai";
import { renderSlidePng, renderSlidesJpeg } from "@/lib/render";
import { sourceImage } from "@/lib/images";
import { readMedia } from "@/lib/media";
import { randomUUID } from "crypto";
import { getPublishStatus, publish } from "@/lib/publisher";
import { config } from "@/lib/config";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";
import { SLIDE_LAYOUTS, normalizeSlide, type Brand, type FontKey, type ImageSourceMode, type Platform, type Post, type Slide, type SlideLayout, type TemplateKey } from "@/lib/types";

export type ActionState = { error?: string; ok?: string } | undefined;

function fail(e: unknown): ActionState {
  console.error(e);
  return { error: e instanceof Error ? e.message : "Terjadi kesalahan" };
}
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const lines = (s: string) =>
  s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);

// ------------------------------------------------------------------ auth

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) redirect("/");
  if (str(fd, "password") !== password) return { error: "Password salah" };
  (await cookies()).set(SESSION_COOKIE, await sessionToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// ------------------------------------------------------------------ brand

const FONTS: FontKey[] = ["plus-jakarta-sans", "poppins", "montserrat", "inter", "playfair-display"];
const TEMPLATES: TemplateKey[] = ["mix", "bold", "clean"];
const HEX = /^#[0-9a-fA-F]{6}$/;

async function uploadImage(file: File, folder: string) {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} bukan file gambar`);
  const buf = Buffer.from(await file.arrayBuffer());
  const isSvg = file.type === "image/svg+xml";
  // Simpan sebagai PNG agar aman dipakai renderer & AI (SVG di-rasterize).
  const png = await sharp(buf, isSvg ? { density: 300 } : {}).png().toBuffer();
  const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  return db().uploadFile(key, png, "image/png");
}

export async function saveBrandAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const current = await db().getBrand();
    const color = (k: keyof Brand["colors"]) => {
      const v = str(fd, `color_${k}`);
      return HEX.test(v) ? v : current.colors[k];
    };
    const headingFont = str(fd, "headingFont") as FontKey;
    const bodyFont = str(fd, "bodyFont") as FontKey;
    const template = str(fd, "defaultTemplate") as TemplateKey;
    const brand: Brand = {
      ...current,
      name: str(fd, "name") || current.name,
      handle: str(fd, "handle"),
      website: str(fd, "website"),
      description: str(fd, "description"),
      audience: str(fd, "audience"),
      tone: str(fd, "tone"),
      pillars: lines(str(fd, "pillars")),
      cta: str(fd, "cta"),
      hashtags: lines(str(fd, "hashtags")).map((h) => h.replace(/^#/, "")),
      doDont: str(fd, "doDont"),
      styleNotes: str(fd, "styleNotes"),
      postingTime: /^\d{2}:\d{2}$/.test(str(fd, "postingTime")) ? str(fd, "postingTime") : current.postingTime,
      headingFont: FONTS.includes(headingFont) ? headingFont : current.headingFont,
      bodyFont: FONTS.includes(bodyFont) ? bodyFont : current.bodyFont,
      defaultTemplate: TEMPLATES.includes(template) ? template : current.defaultTemplate,
      colors: {
        primary: color("primary"),
        secondary: color("secondary"),
        accent: color("accent"),
        background: color("background"),
        text: color("text"),
      },
    };

    const logo = fd.get("logo");
    if (logo instanceof File && logo.size > 0) brand.logoUrl = await uploadImage(logo, "brand");
    if (fd.get("removeLogo") === "on") brand.logoUrl = null;
    const logoAlt = fd.get("logoAlt");
    if (logoAlt instanceof File && logoAlt.size > 0) brand.logoAltUrl = await uploadImage(logoAlt, "brand");
    if (fd.get("removeLogoAlt") === "on") brand.logoAltUrl = null;

    const mode = str(fd, "imageSource") as ImageSourceMode;
    if (["auto", "ai", "stock", "brand", "none"].includes(mode)) brand.imageSource = mode;
    brand.imageStyle = str(fd, "imageStyle") || brand.imageStyle;
    brand.autoReview = fd.get("autoReview") === "on";

    const removeAssets = new Set(fd.getAll("removeAsset").map(String));
    brand.assets = brand.assets
      .filter((a) => !removeAssets.has(a.id))
      .map((a) => ({ ...a, description: fd.has(`asset_${a.id}`) ? str(fd, `asset_${a.id}`) : a.description }));
    for (const f of fd.getAll("assets")) {
      if (f instanceof File && f.size > 0) {
        brand.assets.push({ id: randomUUID().slice(0, 8), url: await uploadImage(f, "assets"), description: f.name.replace(/\.[a-z]+$/i, "").replace(/[-_]+/g, " ") });
      }
    }
    brand.assets = brand.assets.slice(-30);

    const removeExamples = new Set(fd.getAll("removeExample").map(String));
    brand.exampleUrls = brand.exampleUrls.filter((u) => !removeExamples.has(u));
    for (const f of fd.getAll("examples")) {
      if (f instanceof File && f.size > 0) brand.exampleUrls.push(await uploadImage(f, "examples"));
    }
    brand.exampleUrls = brand.exampleUrls.slice(-8);

    await db().saveBrand(brand);
    revalidatePath("/", "layout");
    return { ok: "Brand tersimpan" };
  } catch (e) {
    return fail(e);
  }
}

export async function analyzeExamplesAction(): Promise<ActionState> {
  try {
    const brand = await db().getBrand();
    if (!brand.exampleUrls.length) return { error: "Upload contoh post dulu" };
    const images = await Promise.all(
      brand.exampleUrls.map(async (u) => {
        // Perkecil supaya hemat token.
        const jpg = await sharp(await readMedia(u))
          .resize({ width: 1080, withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        return { data: jpg.toString("base64"), mediaType: "image/jpeg" as const };
      }),
    );
    const out = await analyzeExamples(brand, images);
    await db().saveBrand({ ...brand, styleNotes: out.styleNotes, imageStyle: out.imageStyle, defaultTemplate: out.suggestedTemplate });
    revalidatePath("/brand");
    return { ok: `Analisis selesai. Template disarankan: ${out.suggestedTemplate}` };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------------ ide

export async function generateIdeasAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const brand = await db().getBrand();
    const count = Math.min(10, Math.max(1, Number(str(fd, "count")) || 6));
    const recent = (await db().listIdeas()).slice(0, 40).map((i) => i.title);
    const ideas = await generateIdeas(brand, { brief: str(fd, "brief"), count, recentTitles: recent });
    await db().createIdeas(ideas);
    revalidatePath("/", "layout");
    return { ok: `${ideas.length} ide baru siap di-review` };
  } catch (e) {
    return fail(e);
  }
}

export async function approveIdeaAction(id: string): Promise<ActionState> {
  let postId: string;
  try {
    const idea = await db().getIdea(id);
    if (!idea) return { error: "Ide tidak ditemukan" };
    if (idea.post_id) redirect(`/posts/${idea.post_id}`);
    const brand = await db().getBrand();
    const draft = await generatePost(brand, idea);
    const tempKey = randomUUID();
    const slides = await materialize(brand, draft, tempKey);
    const reviewed = await artDirector(brand, { slides, format: idea.format, caption: draft.caption, template: brand.defaultTemplate }, tempKey);
    const post = await db().createPost({
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
    await db().updateIdea(id, { status: "approved", post_id: post.id });
    postId = post.id;
  } catch (e) {
    if (isRedirect(e)) throw e;
    return fail(e);
  }
  revalidatePath("/", "layout");
  redirect(`/posts/${postId}`);
}

export async function rejectIdeaAction(id: string): Promise<ActionState> {
  await db().updateIdea(id, { status: "rejected" });
  revalidatePath("/", "layout");
  return { ok: "Ide ditolak" };
}

function isRedirect(e: unknown) {
  return typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}

// ------------------------------------------------------------------ konten

/** Isi gambar untuk slide yang membutuhkannya (paralel, maks 3 sekaligus). */
async function materialize(brand: Brand, draft: Pick<Draft, "slides">, key: string): Promise<Slide[]> {
  const out = draft.slides.map((d) => d.slide);
  const jobs = draft.slides.map((d, i) => ({ d, i })).filter(({ d }) => d.imageRequest);
  for (let n = 0; n < jobs.length; n += 3) {
    await Promise.all(
      jobs.slice(n, n + 3).map(async ({ d, i }) => {
        out[i] = { ...out[i], image: await sourceImage(brand, d.imageRequest!, `${key}-${i}`, i) };
      }),
    );
  }
  return out;
}

/** AI art director: render → lihat → perbaiki (1 putaran). */
async function artDirector(
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
    return { slides: await materialize(brand, review, `${key}-qa`), notes: review.notes };
  } catch (e) {
    console.error("Review art director gagal (konten tetap dipakai):", e);
    return { slides: post.slides, notes: null };
  }
}

const LAYOUTS = SLIDE_LAYOUTS as readonly SlideLayout[];

export async function updatePostAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const post = await db().getPost(id);
    if (!post) return { error: "Konten tidak ditemukan" };
    if (!["review", "failed"].includes(post.status)) return { error: "Konten yang sudah di-ACC tidak bisa diedit" };
    const slides: Slide[] = [];
    post.slides.forEach((old, i) => {
      if (fd.get(`slide_${i}_delete`) === "on") return;
      const layout = str(fd, `slide_${i}_layout`) as SlideLayout;
      const itemLines = (k: string) => str(fd, k).split("\n").map((x) => x.trim()).filter(Boolean);
      slides.push(
        normalizeSlide({
          ...old,
          layout: LAYOUTS.includes(layout) ? layout : old.layout,
          kicker: str(fd, `slide_${i}_kicker`),
          headline: str(fd, `slide_${i}_headline`),
          body: str(fd, `slide_${i}_body`),
          stat: str(fd, `slide_${i}_stat`),
          items: itemLines(`slide_${i}_items`),
          itemsB: itemLines(`slide_${i}_itemsB`),
          labelA: str(fd, `slide_${i}_labelA`),
          labelB: str(fd, `slide_${i}_labelB`),
          icon: str(fd, `slide_${i}_icon`) || old.icon,
        }),
      );
    });
    if (!slides.length) return { error: "Minimal harus ada 1 slide" };
    const platforms = fd.getAll("platforms").map(String).filter((p): p is Platform => p === "instagram" || p === "tiktok");
    const template = str(fd, "template") as TemplateKey;
    await db().updatePost(id, {
      title: str(fd, "title") || post.title,
      caption: str(fd, "caption"),
      hashtags: lines(str(fd, "hashtags").replace(/#/g, " ").replace(/\s+/g, ",")),
      slides,
      format: slides.length > 1 ? "carousel" : "single",
      template: TEMPLATES.includes(template) ? template : post.template,
      platforms: platforms.length ? platforms : post.platforms,
    });
    revalidatePath(`/posts/${id}`);
    return { ok: "Perubahan tersimpan" };
  } catch (e) {
    return fail(e);
  }
}

export async function revisePostAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const instruction = str(fd, "instruction") || str(fd, "preset");
    if (!instruction) return { error: "Tulis dulu revisi yang diinginkan" };
    const post = await db().getPost(id);
    if (!post) return { error: "Konten tidak ditemukan" };
    const brand = await db().getBrand();
    const draft = await revisePost(brand, post, instruction);
    const slides = await materialize(brand, draft, `${post.id}-r${post.revision_count + 1}`);
    await db().updatePost(id, {
      title: draft.title,
      caption: draft.caption,
      hashtags: draft.hashtags,
      slides,
      status: "review",
      revision_count: post.revision_count + 1,
    });
    revalidatePath(`/posts/${id}`);
    return { ok: "Revisi selesai — cek hasilnya" };
  } catch (e) {
    return fail(e);
  }
}

async function editableSlide(postId: string, index: number) {
  const post = await db().getPost(postId);
  if (!post) throw new Error("Konten tidak ditemukan");
  if (!["review", "failed"].includes(post.status)) throw new Error("Konten yang sudah di-ACC tidak bisa diedit");
  const slide = post.slides[index];
  if (!slide) throw new Error("Slide tidak ditemukan");
  return { post, slide };
}

async function saveSlide(post: Post, index: number, slide: Slide) {
  const slides = post.slides.slice();
  slides[index] = slide;
  await db().updatePost(post.id, { slides });
  revalidatePath(`/posts/${post.id}`);
}

/** Cari / generate ulang foto untuk satu slide (opsional dengan kata kunci baru). */
export async function replaceImageAction(postId: string, index: number, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { post, slide } = await editableSlide(postId, index);
    const brand = await db().getBrand();
    const custom = str(fd, "query");
    const req = {
      assetId: "",
      query: custom || slide.image?.query || plainHeadline(slide),
      prompt: custom ? `${custom}. Context: ${plainHeadline(slide)}` : slide.image?.prompt || plainHeadline(slide),
    };
    const image = await sourceImage({ ...brand, imageSource: brand.imageSource === "brand" || brand.imageSource === "none" ? "auto" : brand.imageSource }, req, `${post.id}-${index}`, Date.now() % 97);
    if (!image) return { error: "Tidak ada sumber gambar aktif (isi OPENAI/GEMINI atau PEXELS API key), atau tidak ditemukan." };
    await saveSlide(post, index, { ...slide, image });
    return { ok: "Gambar diganti" };
  } catch (e) {
    return fail(e);
  }
}

export async function uploadSlideImageAction(postId: string, index: number, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { post, slide } = await editableSlide(postId, index);
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) return { error: "Pilih file gambar" };
    const url = await uploadImage(file, `uploads/${post.id}`);
    await saveSlide(post, index, { ...slide, image: { url, source: "upload", query: "", prompt: "", credit: "" } });
    return { ok: "Gambar di-upload" };
  } catch (e) {
    return fail(e);
  }
}

export async function removeSlideImageAction(postId: string, index: number): Promise<ActionState> {
  try {
    const { post, slide } = await editableSlide(postId, index);
    await saveSlide(post, index, { ...slide, image: null });
    return { ok: "Gambar dihapus" };
  } catch (e) {
    return fail(e);
  }
}

function plainHeadline(s: Slide) {
  return s.headline.replace(/\*/g, "");
}

export async function rejectPostAction(id: string): Promise<ActionState> {
  await db().updatePost(id, { status: "rejected" });
  revalidatePath("/", "layout");
  return { ok: "Konten ditolak" };
}

/** ACC konten → render desain → upload → kirim ke publisher (sekarang / terjadwal). */
export async function approvePostAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const post = await db().getPost(id);
    if (!post) return { error: "Konten tidak ditemukan" };
    if (!["review", "failed", "approved"].includes(post.status)) {
      return { error: "Konten ini sudah dikirim ke jadwal posting" };
    }
    const brand = await db().getBrand();

    let scheduleAt: Date | null = null;
    if (str(fd, "when") === "schedule") {
      const local = str(fd, "scheduledAt"); // "2026-11-05T19:00" dianggap WIB
      scheduleAt = new Date(`${local}:00+07:00`);
      if (Number.isNaN(scheduleAt.getTime())) return { error: "Tanggal jadwal tidak valid" };
      if (scheduleAt.getTime() < Date.now() + 5 * 60_000) return { error: "Jadwal minimal 5 menit dari sekarang" };
    }

    // 1) Render & upload gambar final
    const jpgs = await renderSlidesJpeg(brand, post);
    const stamp = Date.now();
    const mediaUrls: string[] = [];
    for (let i = 0; i < jpgs.length; i++) {
      mediaUrls.push(await db().uploadFile(`posts/${post.id}/${stamp}-${i + 1}.jpg`, jpgs[i], "image/jpeg"));
    }
    const text = [post.caption, post.hashtags.map((h) => `#${h}`).join(" ")].filter(Boolean).join("\n\n");

    // 2) Kirim ke publisher
    if (!config.hasPublisher) {
      await db().updatePost(id, {
        status: "approved",
        media_urls: mediaUrls,
        scheduled_at: scheduleAt?.toISOString() ?? null,
        error: null,
      });
      revalidatePath("/", "layout");
      return {
        ok: "Konten di-ACC & desain final sudah dibuat. Auto-posting belum aktif (AYRSHARE_API_KEY belum diisi) — gambar bisa diunduh di bawah.",
      };
    }
    if (!mediaUrls.every((u) => u.startsWith("https://"))) {
      return { error: "Gambar harus punya URL publik https (pakai Supabase Storage di produksi)" };
    }
    const result = await publish({ text, mediaUrls, platforms: post.platforms, scheduleAt });
    await db().updatePost(id, {
      status: result.ok ? (scheduleAt ? "scheduled" : "published") : "failed",
      media_urls: mediaUrls,
      scheduled_at: (scheduleAt ?? new Date()).toISOString(),
      publish_ref: result.ref,
      publish_result: result.raw,
      error: result.error,
    });
    revalidatePath("/", "layout");
    if (!result.ok) return { error: `Gagal posting: ${result.error}` };
    return { ok: scheduleAt ? "Terjadwal! Akan terbit otomatis." : "Terkirim! Konten sedang diposting." };
  } catch (e) {
    return fail(e);
  }
}

export async function checkStatusAction(id: string): Promise<ActionState> {
  try {
    const post = await db().getPost(id);
    if (!post?.publish_ref) return { error: "Belum ada referensi posting" };
    const raw = await getPublishStatus(post.publish_ref);
    if (!raw) return { error: "Tidak bisa mengambil status" };
    const s = String(raw.status ?? "");
    const status = s === "success" ? "published" : s === "error" ? "failed" : post.status;
    await db().updatePost(id, { publish_result: raw, status });
    revalidatePath(`/posts/${id}`);
    return { ok: `Status dari publisher: ${s || "tidak diketahui"}` };
  } catch (e) {
    return fail(e);
  }
}
