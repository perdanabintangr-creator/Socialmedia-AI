"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import type { WorkspaceRepo } from "@/lib/db";
import { workspaceOrThrow } from "@/lib/session";
import { analyzeExamples } from "@/lib/ai";
import { sourceImage } from "@/lib/images";
import { metered } from "@/lib/cost";
import { brandGaps, quotaOf } from "@/lib/plans";
import { importBrandFromWebsite } from "@/lib/brand-import";
import { approveAndPublish, buildPostFromIdea, createIdeas, parseWib, publishTarget, revisePostWith } from "@/lib/pipeline";
import { readMedia } from "@/lib/media";
import { randomUUID } from "crypto";
import { getPublishStatus } from "@/lib/publisher";
import { BODY_FONT_KEYS, FONT_KEYS, SLIDE_LAYOUTS, TEMPLATE_KEYS, normalizeSlide, type Brand, type FontKey, type ImageSourceMode, type Platform, type Post, type Slide, type SlideLayout, type TemplateKey } from "@/lib/types";

export type ActionState = { error?: string; ok?: string } | undefined;

function fail(e: unknown): ActionState {
  console.error(e);
  return { error: e instanceof Error ? e.message : "Terjadi kesalahan" };
}
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const lines = (s: string) =>
  s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);

// ------------------------------------------------------------------ brand

const FONTS: FontKey[] = FONT_KEYS;
const TEMPLATES: readonly TemplateKey[] = TEMPLATE_KEYS;
const HEX = /^#[0-9a-fA-F]{6}$/;

async function uploadImage(w: WorkspaceRepo, file: File, folder: string) {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} bukan file gambar`);
  const buf = Buffer.from(await file.arrayBuffer());
  const isSvg = file.type === "image/svg+xml";
  // Simpan sebagai PNG agar aman dipakai renderer & AI (SVG di-rasterize).
  const png = await sharp(buf, isSvg ? { density: 300 } : {}).png().toBuffer();
  const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  return w.uploadFile(key, png, "image/png");
}

export async function saveBrandAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { w } = await workspaceOrThrow();
  try {
    const current = await w.getBrand();
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
      bodyFont: BODY_FONT_KEYS.includes(bodyFont) ? bodyFont : current.bodyFont,
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
    if (logo instanceof File && logo.size > 0) brand.logoUrl = await uploadImage(w, logo, "brand");
    if (fd.get("removeLogo") === "on") brand.logoUrl = null;
    const logoAlt = fd.get("logoAlt");
    if (logoAlt instanceof File && logoAlt.size > 0) brand.logoAltUrl = await uploadImage(w, logoAlt, "brand");
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
        brand.assets.push({ id: randomUUID().slice(0, 8), url: await uploadImage(w, f, "assets"), description: f.name.replace(/\.[a-z]+$/i, "").replace(/[-_]+/g, " ") });
      }
    }
    brand.assets = brand.assets.slice(-30);

    const removeExamples = new Set(fd.getAll("removeExample").map(String));
    brand.exampleUrls = brand.exampleUrls.filter((u) => !removeExamples.has(u));
    for (const f of fd.getAll("examples")) {
      if (f instanceof File && f.size > 0) brand.exampleUrls.push(await uploadImage(w, f, "examples"));
    }
    brand.exampleUrls = brand.exampleUrls.slice(-8);

    await w.saveBrand(brand);
    revalidatePath("/", "layout");
    return { ok: "Brand tersimpan" };
  } catch (e) {
    return fail(e);
  }
}

/** Brand Kit: isi otomatis dari website (logo, deskripsi, audiens, gaya bahasa, pilar). */
export async function importWebsiteAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { w } = await workspaceOrThrow();
    const url = str(fd, "url");
    if (!url) return { error: "Tempel alamat website dulu, mis. brandkamu.com" };
    const brand = await w.getBrand();
    const { brand: next, filled } = await metered(w, "other", () => importBrandFromWebsite(w, brand, url));
    await w.saveBrand(next);
    revalidatePath("/brand");
    revalidatePath("/", "layout");
    return filled.length
      ? { ok: `Terisi dari website: ${filled.join(", ")}. Cek & rapikan di bawah bila perlu.` }
      : { ok: "Website terbaca, tapi kolom Brand Kit kamu sudah terisi semua sehingga tidak ada yang diubah." };
  } catch (e) {
    return fail(e);
  }
}

export async function analyzeExamplesAction(): Promise<ActionState> {
  const { w } = await workspaceOrThrow();
  try {
    const brand = await w.getBrand();
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
    await w.saveBrand({ ...brand, styleNotes: out.styleNotes, imageStyle: out.imageStyle, defaultTemplate: out.suggestedTemplate });
    revalidatePath("/brand");
    return { ok: `Analisis selesai. Template disarankan: ${out.suggestedTemplate}` };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------------ ide

export async function generateIdeasAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { w } = await workspaceOrThrow();
  try {
    const count = Math.min(10, Math.max(1, Number(str(fd, "count")) || 6));
    const ideas = await metered(w, "ideas", () => createIdeas(w, str(fd, "brief"), count));
    revalidatePath("/", "layout");
    return { ok: `${ideas.length} ide baru siap di-review` };
  } catch (e) {
    return fail(e);
  }
}

export async function approveIdeaAction(id: string): Promise<ActionState> {
  const { w } = await workspaceOrThrow();
  let postId: string;
  try {
    const q = await quotaOf(w);
    if (!q.ok) return { error: q.message };
    if (q.plan.quality === "full") {
      const gaps = brandGaps(await w.getBrand());
      if (gaps.length) return { error: `Lengkapi Brand Kit dulu: ${gaps.join(" & ")}.` };
    }
    const post = await metered(w, "build_post", () => buildPostFromIdea(w, id));
    postId = post.id;
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  redirect(`/posts/${postId}`);
}

export async function rejectIdeaAction(id: string): Promise<ActionState> {
  const { w } = await workspaceOrThrow();
  await w.updateIdea(id, { status: "rejected" });
  revalidatePath("/", "layout");
  return { ok: "Ide ditolak" };
}

// ------------------------------------------------------------------ konten

const LAYOUTS = SLIDE_LAYOUTS as readonly SlideLayout[];

export async function updatePostAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { w } = await workspaceOrThrow();
  try {
    const post = await w.getPost(id);
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
    await w.updatePost(id, {
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
  const { w } = await workspaceOrThrow();
  try {
    const base = str(fd, "instruction") || str(fd, "preset");
    const part = str(fd, "slide");
    const instruction = !base
      ? ""
      : part === "caption"
        ? `Revisi CAPTION saja (slide jangan diubah): ${base}`
        : /^\d+$/.test(part)
          ? `Revisi khusus SLIDE ${part} saja, slide lain dan caption biarkan sama: ${base}`
          : base;
    if (!instruction) return { error: "Tulis dulu revisi yang diinginkan" };
    await metered(w, "revise", () => revisePostWith(w, id, instruction));
    revalidatePath(`/posts/${id}`);
    return { ok: "Revisi selesai — cek hasilnya" };
  } catch (e) {
    return fail(e);
  }
}

async function editableSlide(w: WorkspaceRepo, postId: string, index: number) {
  const post = await w.getPost(postId);
  if (!post) throw new Error("Konten tidak ditemukan");
  if (!["review", "failed"].includes(post.status)) throw new Error("Konten yang sudah di-ACC tidak bisa diedit");
  const slide = post.slides[index];
  if (!slide) throw new Error("Slide tidak ditemukan");
  return { post, slide };
}

async function saveSlide(w: WorkspaceRepo, post: Post, index: number, slide: Slide) {
  const slides = post.slides.slice();
  slides[index] = slide;
  await w.updatePost(post.id, { slides });
  revalidatePath(`/posts/${post.id}`);
}

/** Cari / generate ulang foto untuk satu slide (opsional dengan kata kunci baru). */
export async function replaceImageAction(postId: string, index: number, _: ActionState, fd: FormData): Promise<ActionState> {
  const { w } = await workspaceOrThrow();
  try {
    const { post, slide } = await editableSlide(w, postId, index);
    const brand = await w.getBrand();
    const custom = str(fd, "query");
    const req = {
      assetId: "",
      query: custom || slide.image?.query || plainHeadline(slide),
      prompt: custom ? `${custom}. Context: ${plainHeadline(slide)}` : slide.image?.prompt || plainHeadline(slide),
    };
    const image = await metered(w, "image", () => sourceImage(w, { ...brand, imageSource: brand.imageSource === "brand" || brand.imageSource === "none" ? "auto" : brand.imageSource }, req, `${post.id}-${index}`, Date.now() % 97), () => post.id);
    if (!image) return { error: "Tidak ada sumber gambar aktif (isi OPENAI/GEMINI atau PEXELS API key), atau tidak ditemukan." };
    await saveSlide(w, post, index, { ...slide, image });
    return { ok: "Gambar diganti" };
  } catch (e) {
    return fail(e);
  }
}

export async function uploadSlideImageAction(postId: string, index: number, _: ActionState, fd: FormData): Promise<ActionState> {
  const { w } = await workspaceOrThrow();
  try {
    const { post, slide } = await editableSlide(w, postId, index);
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) return { error: "Pilih file gambar" };
    const url = await uploadImage(w, file, `uploads/${post.id}`);
    await saveSlide(w, post, index, { ...slide, image: { url, source: "upload", query: "", prompt: "", credit: "" } });
    return { ok: "Gambar di-upload" };
  } catch (e) {
    return fail(e);
  }
}

export async function removeSlideImageAction(postId: string, index: number): Promise<ActionState> {
  const { w } = await workspaceOrThrow();
  try {
    const { post, slide } = await editableSlide(w, postId, index);
    await saveSlide(w, post, index, { ...slide, image: null });
    return { ok: "Gambar dihapus" };
  } catch (e) {
    return fail(e);
  }
}

function plainHeadline(s: Slide) {
  return s.headline.replace(/\*/g, "");
}

export async function rejectPostAction(id: string): Promise<ActionState> {
  const { w } = await workspaceOrThrow();
  await w.updatePost(id, { status: "rejected" });
  revalidatePath("/", "layout");
  return { ok: "Konten ditolak" };
}

/** ACC konten → render desain → upload → kirim ke publisher (sekarang / terjadwal). */
export async function approvePostAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { w } = await workspaceOrThrow();
  try {
    let scheduleAt: Date | null = null;
    if (str(fd, "when") === "schedule") {
      scheduleAt = parseWib(str(fd, "scheduledAt")); // dianggap WIB
      if (!scheduleAt) return { error: "Tanggal jadwal tidak valid" };
    }
    const res = await approveAndPublish(w, id, scheduleAt);
    revalidatePath("/", "layout");
    return res.ok ? { ok: res.message } : { error: res.message };
  } catch (e) {
    return fail(e);
  }
}

export async function checkStatusAction(id: string): Promise<ActionState> {
  const { w } = await workspaceOrThrow();
  try {
    const post = await w.getPost(id);
    if (!post?.publish_ref) return { error: "Belum ada referensi posting" };
    const target = await publishTarget(w.id);
    const raw = await getPublishStatus(post.publish_ref, target.profileKey);
    if (!raw) return { error: "Tidak bisa mengambil status" };
    const s = String(raw.status ?? "");
    const status = s === "success" ? "published" : s === "error" ? "failed" : post.status;
    await w.updatePost(id, { publish_result: raw, status });
    revalidatePath(`/posts/${id}`);
    return { ok: `Status dari publisher: ${s || "tidak diketahui"}` };
  } catch (e) {
    return fail(e);
  }
}
