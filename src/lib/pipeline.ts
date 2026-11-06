import "server-only";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { accounts, type WorkspaceRepo } from "./db";
import { generateIdeas, generatePost, isTeaser, TEASER_WORDS, reviewDesign, revisePost, type Draft, type RefContext } from "./ai";
import { setMeterPost } from "./cost";
import { brandForPlan, planOf, visualConcept, type PlanRule } from "./plans";
import { referenceImageBlocks, referenceImageBuffers, referencePrompt } from "./reference";
import { renderSlidePng, renderSlidesJpeg, renderStoryJpeg } from "./render";
import { sourceImage } from "./images";
import { publish, publishStory } from "./publisher";
import { config } from "./config";
import type { AgentId } from "./agents";
import { styledBrand, withVisualStyle, type Brand, type Idea, type Post, type PostFormat, type PostReference, type Slide } from "./types";

/**
 * Inti alur kerja: ide → konten (copy + visual + review) → ACC → posting.
 * Dipakai oleh dashboard (server actions) dan Studio chat (tim agen).
 * `progress` dipanggil saat tiap agen menyelesaikan tahapannya.
 */
export type Progress = (agent: AgentId, text: string) => Promise<void>;
const silent: Progress = async () => {};

export async function createIdeas(
  w: WorkspaceRepo,
  brief: string,
  count: number,
  format?: PostFormat,
  reference: PostReference | null = null,
): Promise<Idea[]> {
  const brand = await w.getBrand();
  const recent = (await w.listIdeas()).slice(0, 40).map((i) => i.title);
  const formatHint = format ? `\nSemua ide harus berformat ${format === "single" ? "single post" : "carousel"}.` : "";
  const ideas = await generateIdeas(brand, {
    brief: brief + formatHint,
    count,
    recentTitles: recent,
    reference: reference ? [reference.notes, reference.layouts.length ? `Referensi berisi ${reference.layouts.length} slide.` : ""].filter(Boolean).join("\n") : undefined,
  });
  // Brief teaser/coming soon: tandai idenya supaya naskah & desain memakai resep teaser.
  const teaserBrief = TEASER_WORDS.test(brief);
  return w.createIdeas(
    ideas.map((i) => ({
      ...i,
      angle: teaserBrief && !isTeaser(i) ? `[Teaser coming soon] ${i.angle}` : i.angle,
      ...(format ? { format } : {}),
      reference,
    })),
  );
}

/** Teks + gambar referensi untuk AI (hanya bila AI aktif; mode demo cukup palet & template). */
async function refContext(ref: PostReference | null): Promise<RefContext | null> {
  if (!ref || !config.hasAI) return null;
  return { text: referencePrompt(ref), images: await referenceImageBlocks(ref) };
}

/** Isi gambar untuk slide yang membutuhkannya (paralel, maks 3 sekaligus). */
/**
 * Mode hemat: batas foto AI baru per konten (cover didahulukan). Slide yang tidak kebagian
 * otomatis memakai versi grafis. Foto milik brand (assetId) gratis dan tidak dihitung.
 * Atur lewat env MAX_AI_IMAGES_PER_POST (default 4) dan MAX_AI_IMAGE_SWAPS (default 2).
 */
export const MAX_NEW_IMAGES = Number(process.env.MAX_AI_IMAGES_PER_POST) || 4;
const MAX_SWAPS = Number(process.env.MAX_AI_IMAGE_SWAPS) || 2;

export async function materialize(
  w: WorkspaceRepo,
  brand: Brand,
  draft: Pick<Draft, "slides">,
  key: string,
  refs: Buffer[] = [],
  maxNew = MAX_NEW_IMAGES,
): Promise<Slide[]> {
  const out = draft.slides.map((d) => d.slide);
  let budget = maxNew;
  const jobs = draft.slides
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => {
      if (!d.imageRequest) return false;
      if (d.imageRequest.assetId && brand.assets.some((a) => a.id === d.imageRequest!.assetId)) return true;
      if (budget <= 0) return false;
      budget--;
      return true;
    });
  for (let n = 0; n < jobs.length; n += 3) {
    await Promise.all(
      jobs.slice(n, n + 3).map(async ({ d, i }) => {
        out[i] = { ...out[i], image: await sourceImage(w, brand, { ...d.imageRequest!, layout: d.imageRequest!.layout ?? d.slide.layout }, `${key}-${i}`, i, refs) };
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
  ref: RefContext | null = null,
  refImgs: Buffer[] = [],
): Promise<{ slides: Slide[]; notes: string | null }> {
  if (!brand.autoReview || !config.hasAI) return { slides: post.slides, notes: null };
  try {
    const renders: string[] = [];
    for (let i = 0; i < post.slides.length; i++) {
      const png = await renderSlidePng(brand, post, i);
      renders.push((await sharp(png).resize(540).jpeg({ quality: 75 }).toBuffer()).toString("base64"));
    }
    const review = await reviewDesign(brand, post, renders, ref);
    if (!review) return { slides: post.slides, notes: null };
    if (review.verdict === "approve") return { slides: post.slides, notes: review.notes };
    // Mode hemat: art director hanya boleh mengganti maks. MAX_SWAPS foto; sisanya foto lama dipertahankan.
    let swaps = 0;
    const capped = {
      slides: review.slides.map((d, i) => {
        if (!d.imageRequest) return d;
        if (swaps < MAX_SWAPS) {
          swaps++;
          return d;
        }
        return { slide: { ...d.slide, image: post.slides[i]?.image ?? null }, imageRequest: null };
      }),
    };
    return { slides: await materialize(w, brand, capped, `${key}-qa`, refImgs, MAX_SWAPS), notes: review.notes };
  } catch (e) {
    console.error("Review art director gagal (konten tetap dipakai):", e);
    return { slides: post.slides, notes: null };
  }
}

const countPhotos = (slides: Slide[]) => slides.filter((s) => s.image).length;
const firstHook = (slides: Slide[]) => slides[0]?.headline.replace(/\*/g, "") ?? "";

const PHOTO_OF: Partial<Record<Slide["layout"], Slide["layout"]>> = {
  cover_type: "cover_photo",
  point_icon: "point_photo",
  stat: "point_photo",
  quote: "point_photo",
  promo_offer: "promo_hero",
};

/** Cover khas tiap gaya (dipakai bila cover AI belum berfoto). */
const STYLE_COVER: Record<string, Slide["layout"]> = {
  promo: "promo_hero",
  news: "news_cover",
  folk: "folk_cover",
  editorial: "editorial_cover",
  creative: "creative_cover",
};

/**
 * Teaser / coming soon: maks 3 slide, cover = key visual penuh (editorial_cover atau cover khas
 * arah visual), slide teks-berat dibuang. Paket penuh: cover pasti punya key visual sinematik.
 */
function teaserize(draft: Draft, plan: PlanRule, brand: Brand, ref: PostReference | null, template: string): Draft {
  if (!draft.slides.length) return draft;
  const styleCover = ref?.style && ref.style !== "brand" ? STYLE_COVER[template] : undefined;
  const coverLayout = styleCover ?? "editorial_cover";
  const TEXTY = new Set<Slide["layout"]>(["list", "steps", "compare", "point_icon", "stat"]);
  const [first, ...rest] = draft.slides;
  const last = rest.length ? rest[rest.length - 1] : null;
  const middle = rest.slice(0, -1).filter((d) => !TEXTY.has(d.slide.layout)).slice(0, 1);
  const tail = last && !TEXTY.has(last.slide.layout) ? [last] : [];
  const headline = first.slide.headline.replace(/\*/g, "");
  const prompt = `Cinematic mysterious teaser key visual for an upcoming launch by ${brand.name} (${brand.industry || brand.description}). ${visualConcept(brand)} Main subject partially hidden in shadow, dramatic rim light in brand color ${brand.colors.accent} and ${brand.colors.primary}, dark clean premium background with subtle glow and light particles, plenty of empty space, luxury launch-campaign quality. Theme: "${headline}".`.slice(0, 900);
  const cover = {
    slide: { ...first.slide, layout: coverLayout },
    imageRequest:
      first.imageRequest ? { ...first.imageRequest, prompt: `${prompt} Scene idea: ${first.imageRequest.prompt}`.slice(0, 1200), layout: coverLayout }
      : plan.quality === "full" ? { assetId: "", query: `${brand.industry || brand.name} dark product launch`, prompt, layout: coverLayout }
      : null,
  };
  return { ...draft, slides: [cover, ...middle, ...tail].slice(0, 3) };
}

/** Arah visual dipilih owner: cover wajib memakai cover khas gaya itu. */
function styleCover(draft: Draft, ref: PostReference | null, template: string): Draft {
  const cover = STYLE_COVER[template];
  if (!ref?.style || !cover || !draft.slides.length || draft.slides[0].slide.layout === cover) return draft;
  const [first, ...rest] = draft.slides;
  return {
    ...draft,
    slides: [{ slide: { ...first.slide, layout: cover }, imageRequest: first.imageRequest ? { ...first.imageRequest, layout: cover } : null }, ...rest],
  };
}

/**
 * Paket kualitas penuh wajib punya minimal N visual. Bila naskah AI kurang foto,
 * cover lalu slide isi diubah ke layout berfoto dengan konsep visual sesuai bisnis.
 */
export function ensureVisuals(draft: Draft, plan: PlanRule, brand: Brand, template: string): Draft {
  if (plan.quality !== "full" || !plan.minVisuals) return draft;
  let have = draft.slides.filter((d) => d.imageRequest || d.slide.image).length;
  const coverHasVisual = Boolean(draft.slides[0]?.imageRequest || draft.slides[0]?.slide.image);
  // Paket penuh: cover WAJIB bervisual, plus minimal N visual total.
  if (have >= plan.minVisuals && coverHasVisual) return draft;
  const concept = visualConcept(brand);
  const order = draft.slides.map((_, i) => i).filter((i) => i !== draft.slides.length - 1 || draft.slides.length === 1);
  const slides = [...draft.slides];
  for (const i of order) {
    if (have >= plan.minVisuals && (i !== 0 || coverHasVisual)) continue;
    const d = slides[i];
    if (d.imageRequest || d.slide.image) continue;
    const to = (i === 0 ? STYLE_COVER[template] : undefined) ?? PHOTO_OF[d.slide.layout];
    if (!to && d.slide.layout !== "cover_photo" && d.slide.layout !== "point_photo" && d.slide.layout !== "cover_split") continue;
    const headline = d.slide.headline.replace(/\*/g, "");
    const asset = brand.assets[have % Math.max(1, brand.assets.length)];
    slides[i] = {
      slide: { ...d.slide, layout: to ?? d.slide.layout },
      imageRequest: {
        assetId: asset?.id ?? "",
        query: brand.industry || brand.name,
        prompt: `${concept} The scene visually supports this message: "${headline}". For brand ${brand.name}: ${brand.description}`.slice(0, 900),
        layout: to ?? d.slide.layout,
      },
    };
    have++;
  }
  return { ...draft, slides };
}

/** Ide yang sudah di-ACC → konten lengkap siap review. */
export async function buildPostFromIdea(w: WorkspaceRepo, ideaId: string, progress: Progress = silent): Promise<Post> {
  const idea = await w.getIdea(ideaId);
  if (!idea) throw new Error("Ide tidak ditemukan");
  if (idea.post_id) {
    const existing = await w.getPost(idea.post_id);
    if (existing) return existing;
  }
  await w.updateIdea(ideaId, { status: "approved" });
  const plan = await planOf(w.id);
  const baseBrand = await w.getBrand();
  // Ide tanpa referensi (mis. dari halaman Ide) tetap memakai arah visual default Brand Kit.
  const ref = idea.reference ?? withVisualStyle(null, baseBrand.visualStyle);
  const brand = brandForPlan(styledBrand(baseBrand, ref), plan);
  const ctx = await refContext(ref);
  const refImgs = await referenceImageBuffers(ref);
  const template = ref?.template ?? brand.defaultTemplate;

  const raw = styleCover(await generatePost(brand, idea, ctx), ref, template);
  const draft = ensureVisuals(isTeaser(idea) ? teaserize(raw, plan, brand, ref, template) : raw, plan, brand, template);
  await progress(
    "kata",
    `Naskah ${draft.slides.length > 1 ? `${draft.slides.length} slide` : "single post"} + caption sudah jadi${ref ? " mengikuti gaya referensimu" : ""}. Hook-nya: “${firstHook(draft.slides.map((d) => d.slide))}”. Aku oper ke Rupa ya.`,
  );

  const key = randomUUID();
  const slides = await materialize(w, brand, draft, key, refImgs, Math.min(MAX_NEW_IMAGES, plan.maxVisuals));
  const photos = countPhotos(slides);
  await progress(
    "rupa",
    `Layout & visual sudah tersusun${photos ? ` (${photos} foto)` : ""}${ref ? ", warna & gaya kusamakan dengan referensi" : ""}.${brand.autoReview && config.hasAI ? " Aku cek ulang hasil rendernya dulu sebelum kukirim." : ""}`,
  );

  const reviewed = await artDirector(w, brand, { slides, format: idea.format, caption: draft.caption, template }, key, ctx, refImgs);
  const post = await w.createPost({
    idea_id: idea.id,
    title: draft.title || idea.title,
    format: idea.format,
    platforms: ["instagram", "tiktok"],
    caption: draft.caption,
    hashtags: draft.hashtags,
    slides: reviewed.slides,
    template,
    status: "review",
    design_notes: reviewed.notes,
    reference: ref,
  });
  setMeterPost(post.id);
  await w.updateIdea(ideaId, { status: "approved", post_id: post.id });
  return post;
}

export async function revisePostWith(
  w: WorkspaceRepo,
  postId: string,
  instruction: string,
  progress: Progress = silent,
  newRef: PostReference | null = null,
): Promise<Post> {
  const post = await w.getPost(postId);
  if (!post) throw new Error("Konten tidak ditemukan");
  if (!["review", "failed"].includes(post.status)) throw new Error("Konten ini sudah di-ACC, tidak bisa direvisi lagi");
  setMeterPost(post.id);
  const ref = newRef ?? post.reference ?? null;
  const plan = await planOf(w.id);
  const brand = brandForPlan(styledBrand(await w.getBrand(), ref), plan);
  const draft = await revisePost(brand, post, instruction, await refContext(ref));
  await progress("kata", `Revisi naskah sudah kuterapkan${newRef ? " mengikuti referensi baru" : ""}. Rupa, tolong sesuaikan visualnya.`);
  const slides = await materialize(w, brand, draft, `${post.id}-r${post.revision_count + 1}`, await referenceImageBuffers(ref), Math.min(MAX_NEW_IMAGES, plan.maxVisuals));
  const patch = {
    title: draft.title,
    caption: draft.caption,
    hashtags: draft.hashtags,
    slides,
    status: "review" as const,
    revision_count: post.revision_count + 1,
    reference: ref,
    template: newRef?.template ?? post.template,
  };
  await w.updatePost(postId, patch);
  return { ...post, ...patch, updated_at: new Date().toISOString() };
}

/** Instruksi revisi otomatis: AI mengkritik kontennya sendiri sebagai creative director senior. */
export const AUTO_REVISE = `REVISI OTOMATIS oleh creative director senior. Evaluasi konten ini dengan kritis seperti sedang review hasil junior designer, lalu perbaiki sendiri tanpa menunggu arahan owner:
- Hook slide 1 harus bikin berhenti scroll: lebih spesifik & tajam (angka, konflik, rasa penasaran), tetap jujur.
- Pangkas teks bertele-tele: satu slide satu ide, judul maks 8 kata, body maks 1 kalimat.
- Alur slide harus logis dan slide terakhir punya CTA yang spesifik.
- Visual: cover wajib punya visual kuat; ganti foto yang kurang relevan/generik dengan image.prompt yang lebih spesifik & on-brand. Variasikan layout supaya tidak monoton.
- Caption: baris pertama hook, isi bernilai, CTA jelas, hashtag relevan.
Jangan mengubah fakta, harga, nama produk, tanggal, atau klaim.`;

/** Revisi otomatis: AI memperbaiki naskah & visual, lalu art director mengecek hasil render. */
export async function autoRevisePost(w: WorkspaceRepo, postId: string): Promise<Post> {
  const revised = await revisePostWith(w, postId, AUTO_REVISE);
  const plan = await planOf(w.id);
  if (plan.quality !== "full" || !config.hasAI) return revised;
  const ref = revised.reference ?? null;
  const brand = brandForPlan(styledBrand(await w.getBrand(), ref), plan);
  const reviewed = await artDirector(w, brand, revised, `${postId}-auto${revised.revision_count}`, await refContext(ref), await referenceImageBuffers(ref));
  await w.updatePost(postId, { slides: reviewed.slides, design_notes: reviewed.notes ?? revised.design_notes });
  return { ...revised, slides: reviewed.slides, design_notes: reviewed.notes ?? revised.design_notes };
}

/** Revisi AI sedang berjalan (lebih dari 6 menit dianggap macet). */
export const isRevising = (p: Pick<Post, "revising_since">) =>
  Boolean(p.revising_since && Date.now() - new Date(p.revising_since).getTime() < 6 * 60_000);

/** Slot ACC: jadwal dari rencana bulanan bila masih di masa depan, selain itu besok jam posting brand. */
export function accSlot(post: Pick<Post, "planned_at">, postingTime: string): Date {
  const planned = post.planned_at ? new Date(post.planned_at) : null;
  if (planned && planned.getTime() > Date.now() + 10 * 60_000) return planned;
  return parseWib(defaultScheduleWib(postingTime)) ?? new Date(Date.now() + 24 * 3600_000);
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

/**
 * Versi Story: render frame 9:16, simpan, lalu kirim ke Instagram Story (sekarang / terjadwal).
 * Tanpa akun sosmed terhubung: frame tetap dirender & bisa diunduh.
 */
export async function publishStoryFor(
  w: WorkspaceRepo,
  postId: string,
  frames: number[],
  scheduleAt: Date | null,
): Promise<{ ok: boolean; message: string }> {
  const post = await w.getPost(postId);
  if (!post) throw new Error("Konten tidak ditemukan");
  const list = [...new Set(frames)].filter((i) => Number.isInteger(i) && i >= 0 && i < post.slides.length).sort((a, b) => a - b).slice(0, 10);
  if (!list.length) throw new Error("Pilih minimal satu slide untuk Story");
  if (scheduleAt && scheduleAt.getTime() < Date.now() + 5 * 60_000) throw new Error("Jadwal minimal 5 menit dari sekarang");
  const brand = await w.getBrand();
  const stamp = Date.now();
  const media: string[] = [];
  for (const i of list) {
    const jpg = await renderStoryJpeg(brand, post, i);
    media.push(await w.uploadFile(`stories/${post.id}/${stamp}-${i + 1}.jpg`, jpg, "image/jpeg"));
  }
  const base = { frames: list, media_urls: media, updated_at: new Date().toISOString(), scheduled_at: scheduleAt?.toISOString() ?? null };
  const target = await publishTarget(w.id);
  if (!target.connected) {
    await w.updatePost(post.id, { story: { ...base, status: "approved", publish_refs: [], error: null } });
    return { ok: true, message: `${list.length} frame Story siap diunduh. ${target.reason}` };
  }
  const refs: string[] = [];
  const errors: string[] = [];
  for (const [n, url] of media.entries()) {
    // Frame berurutan: beri jarak 1 menit supaya urutannya terjaga di Story.
    const at = scheduleAt ? new Date(scheduleAt.getTime() + n * 60_000) : null;
    const r = await publishStory({ mediaUrl: url, profileKey: target.profileKey, scheduleAt: at, note: post.caption.split("\n")[0].slice(0, 200) });
    if (r.ok && r.ref) refs.push(r.ref);
    if (!r.ok) errors.push(r.error ?? "gagal");
  }
  const ok = !errors.length;
  await w.updatePost(post.id, {
    story: { ...base, status: ok ? (scheduleAt ? "scheduled" : "published") : "failed", publish_refs: refs, error: errors.join(" | ") || null },
  });
  return { ok, message: ok ? (scheduleAt ? `Story terjadwal (${list.length} frame).` : `Story sedang diunggah (${list.length} frame).`) : `Gagal upload Story: ${errors.join(" | ")}` };
}
