"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { db } from "@/lib/db";
import { analyzeExamples, generateIdeas, generatePost, revisePost } from "@/lib/ai";
import { renderSlidesJpeg } from "@/lib/render";
import { getPublishStatus, publish } from "@/lib/publisher";
import { config } from "@/lib/config";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";
import type { Brand, FontKey, Platform, Slide, SlideLayout, TemplateKey } from "@/lib/types";

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
        const res = await fetch(u);
        if (!res.ok) throw new Error(`Gagal mengambil ${u}`);
        // Perkecil supaya hemat token.
        const jpg = await sharp(Buffer.from(await res.arrayBuffer()))
          .resize({ width: 1080, withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        return { data: jpg.toString("base64"), mediaType: "image/jpeg" as const };
      }),
    );
    const out = await analyzeExamples(brand, images);
    await db().saveBrand({ ...brand, styleNotes: out.styleNotes, defaultTemplate: out.suggestedTemplate });
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
    const content = await generatePost(brand, idea);
    const post = await db().createPost({
      idea_id: idea.id,
      title: content.title || idea.title,
      format: idea.format,
      platforms: ["instagram", "tiktok"],
      caption: content.caption,
      hashtags: content.hashtags,
      slides: content.slides,
      template: brand.defaultTemplate,
      status: "review",
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

const LAYOUTS: SlideLayout[] = ["cover", "point", "stat", "quote", "cta"];

export async function updatePostAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const post = await db().getPost(id);
    if (!post) return { error: "Konten tidak ditemukan" };
    if (!["review", "failed"].includes(post.status)) return { error: "Konten yang sudah di-ACC tidak bisa diedit" };
    const slides: Slide[] = [];
    post.slides.forEach((_s, i) => {
      if (fd.get(`slide_${i}_delete`) === "on") return;
      const layout = str(fd, `slide_${i}_layout`) as SlideLayout;
      slides.push({
        layout: LAYOUTS.includes(layout) ? layout : "point",
        kicker: str(fd, `slide_${i}_kicker`),
        headline: str(fd, `slide_${i}_headline`),
        body: str(fd, `slide_${i}_body`),
        stat: str(fd, `slide_${i}_stat`),
      });
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
    const out = await revisePost(brand, post, instruction);
    await db().updatePost(id, { ...out, status: "review", revision_count: post.revision_count + 1 });
    revalidatePath(`/posts/${id}`);
    return { ok: "Revisi selesai — cek hasilnya" };
  } catch (e) {
    return fail(e);
  }
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
