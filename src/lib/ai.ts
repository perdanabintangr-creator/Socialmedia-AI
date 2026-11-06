import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { config } from "./config";
import { recordAI } from "./cost";
import { visualConcept } from "./plans";
import { ICON_NAMES } from "./icons";
import { SLIDE_LAYOUTS, TEMPLATE_KEYS, normalizeSlide, type Brand, type Idea, type Post, type PostFormat, type Slide } from "./types";
import type { ImageRequest } from "./images";

const MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
function anthropic() {
  if (!client) client = new Anthropic();
  return client;
}

// ------------------------------------------------------------------ schemas

const IdeaSchema = z.object({
  title: z.string().describe("Judul ide singkat, maksimal 10 kata"),
  hook: z.string().describe("Kalimat pembuka yang bikin orang berhenti scroll"),
  angle: z.string().describe("Sudut pandang / isi utama yang akan dibahas, 1-2 kalimat"),
  pillar: z.string().describe("Salah satu pilar konten brand"),
  format: z.enum(["single", "carousel"]),
  rationale: z.string().describe("Kenapa ide ini relevan untuk audiens, 1 kalimat"),
});
const IdeasSchema = z.object({ ideas: z.array(IdeaSchema) });

const SlideOut = z.object({
  layout: z.enum(SLIDE_LAYOUTS),
  kicker: z.string().describe("Label kecil / sticker, maks 4 kata. Boleh kosong"),
  headline: z.string().describe("Teks utama, maks ~10 kata. Bungkus 1-3 kata kunci dengan *bintang* untuk highlight"),
  body: z.string().describe("Teks pendukung maks ~25 kata. Untuk quote: nama/sumber kutipan"),
  stat: z.string().describe("stat: angka besar, mis. '73%'. promo_hero/promo_offer: angka promo, mis. '50%', '2+1', 'Rp10rb'. Selain itu kosong"),
  items: z.array(z.string()).describe("list/steps: 3-5 item pendek (maks 7 kata). compare: poin kolom kiri. Selain itu []"),
  itemsB: z.array(z.string()).describe("compare: poin kolom kanan. Selain itu []"),
  labelA: z.string().describe("compare: judul kolom kiri (mis. 'Mitos'). promo_*: label kecil di atas angka promo (mis. 'Cashback', 'Diskon'). Selain itu kosong"),
  labelB: z.string().describe("compare: judul kolom kanan (mis. 'Fakta'). promo_*: teks tombol ajakan (mis. 'Pesan sekarang'). Selain itu kosong"),
  icon: z.enum(ICON_NAMES).describe("Ikon yang paling mewakili isi slide (dipakai di point_icon)"),
  image: z.object({
    assetId: z.string().describe("id foto brand yang cocok, atau kosong"),
    query: z.string().describe("Kata kunci stok foto dalam bahasa Inggris, 2-5 kata, atau kosong bila slide tanpa foto"),
    prompt: z.string().describe("Prompt AI image dalam bahasa Inggris (subjek, setting, sudut kamera, cahaya, mood), atau kosong bila slide tanpa foto"),
    change: z.boolean().describe("Untuk revisi: true bila foto slide ini perlu diganti. Saat membuat baru: true bila slide butuh foto"),
  }),
});
type SlideOutT = z.infer<typeof SlideOut>;

const PostSchema = z.object({
  title: z.string().describe("Nama internal konten ini, singkat"),
  slides: z.array(SlideOut),
  caption: z.string().describe("Caption lengkap untuk Instagram & TikTok, tanpa hashtag"),
  hashtags: z.array(z.string()).describe("3-5 hashtag relevan, tanpa simbol #"),
});
type GeneratedPost = z.infer<typeof PostSchema>;

const ReviewSchema = z.object({
  verdict: z.enum(["approve", "revise"]),
  notes: z.string().describe("Ringkasan singkat untuk owner (Bahasa Indonesia): apa yang sudah bagus / apa yang kamu perbaiki"),
  slides: z.array(SlideOut).describe("Slide versi final (sama dengan input bila verdict approve)"),
});

// ------------------------------------------------------------------ prompts

const LAYOUT_GUIDE = `# Layout yang tersedia (pilih per slide)
- cover_photo: foto full-bleed + judul besar di bawah. Paling eye-catching untuk cover. BUTUH foto.
- cover_split: foto di atas, panel warna brand di bawah berisi judul. Cover yang rapi & editorial. BUTUH foto.
- cover_type: tipografi besar + sticker, opsional foto dalam bingkai lengkung. Cocok untuk cover opini/hot take.
- point_photo: nomor + kartu foto + judul & penjelasan. BUTUH foto.
- point_icon: ikon besar + nomor + judul & penjelasan. Untuk poin konseptual.
- list: judul + checklist 3-5 item (isi field items).
- steps: judul + 3-4 langkah bernomor berurutan (isi field items).
- compare: dua kolom, mis. Mitos vs Fakta / Salah vs Benar / Before vs After (labelA, labelB, items, itemsB). Kolom kanan = yang benar.
- stat: angka besar (persen otomatis jadi ring chart) + judul. Hanya bila angkanya fakta yang aman.
- quote: kutipan besar + nama sumber (body). Opsional foto bulat.
- cta: penutup ajakan follow/save/share; opsional foto latar.
- promo_hero: gaya IKLAN PROMO. Foto orang/produk besar di bagian bawah di atas latar warna utama, judul kapital di kiri atas, angka promo (stat + labelA) dalam starburst di kanan atas, catatan S&K kecil (body) dan tombol (labelB). BUTUH foto: image.prompt harus berisi subjek (mis. orang Indonesia tersenyum memegang HP / produk) di atas LATAR POLOS SATU WARNA, subjek di 2/3 bawah, ruang kosong di atas.
- promo_offer: iklan promo tanpa foto: judul tebal, angka promo raksasa dalam starburst (stat + labelA), 1-3 benefit singkat (items), tombol (labelB), S&K kecil (body).
Untuk konten jualan/diskon/promo/cashback, pakai promo_hero untuk cover dan promo_offer untuk slide penawaran.
Cover bergaya (dipakai bila arah visual/referensi memintanya; semuanya BUTUH foto):
- news_cover: gaya media berita/homeless media. Foto liputan di atas, latar hitam, logo kecil, JUDUL KAPITAL panjang 12-20 kata di tengah bawah dengan 2-4 kata kunci ditandai *bintang* (warna menyala), body = 1 baris subjudul. image.prompt: foto dokumenter realistis, subjek di setengah atas.
- folk_cover: gaya info cepat. Foto lebar di atas, panel putih di bawah, headline = 1 kalimat fakta 15-30 kata huruf biasa tanpa *bintang*. image.prompt: foto dokumenter/wide shot/foto udara.
- editorial_cover: gaya majalah. Foto close-up penuh, judul 2-5 kata di tengah bawah, 1 kata *bintang* jadi serif italic, labelB = teks tombol pil kecil. image.prompt: close-up wajah/produk kelas majalah, latar bersih.
- creative_cover: gaya kreatif 3D/AI. Visual 3D penuh, judul raksasa 2-4 kata di atas, 1 kata *bintang* jadi tulisan tangan neon, kicker = stiker miring pendek (mis. "Part 2"). image.prompt: render 3D glossy surreal melayang di langit biru.`;

export function brandSystemPrompt(brand: Brand): string {
  const assets = brand.assets.length
    ? brand.assets.map((a) => `- id "${a.id}": ${a.description || "(tanpa deskripsi)"}`).join("\n")
    : "- (belum ada)";
  return `Kamu adalah creative director, copywriter, dan art director dari social media agency papan atas, yang bekerja in-house untuk brand "${brand.name}" (${brand.handle}). Kamu menggantikan seluruh tim: strategi, copy, dan desain. Hasilmu harus terlihat seperti dibuat agency profesional — visual kuat, bervariasi, dan on-brand — bukan sekadar slide teks. Konten diposting ke Instagram (feed 4:5) dan TikTok (photo mode).

# Brand
Tentang brand: ${brand.description || "(belum diisi — tulis secara umum dan aman)"}
Target audiens: ${brand.audience || "(belum diisi)"}
Gaya bahasa / tone: ${brand.tone}
Pilar konten: ${brand.pillars.join(", ")}
CTA default: ${brand.cta}
Website: ${brand.website || "-"}
Wajib / dilarang: ${brand.doDont || "-"}
Catatan gaya dari contoh post yang disukai brand: ${brand.styleNotes || "-"}
Art direction foto: ${brand.imageStyle}

# Foto milik brand (pakai via image.assetId bila relevan — foto asli selalu lebih baik dari stok)
${assets}

# Visual
${
  brand.imageSource === "none" || (brand.imageSource === "brand" && !brand.assets.length)
    ? "Konten ini TANPA foto (paket dasar): kosongkan image.query & image.prompt, pakai layout grafis (cover_type, point_icon, list, steps, compare, stat, quote, cta, promo_offer). Buat tetap menarik lewat tipografi, ikon, angka, dan struktur."
    : `Visual yang cocok untuk jenis bisnis ini: ${visualConcept(brand)}`
}

${LAYOUT_GUIDE}

# Aturan art direction
- Variasikan layout: jangan pakai layout yang sama lebih dari 2 slide berturut-turut. Kombinasikan foto, ikon, list, angka, dan perbandingan seperti carousel agency.
- Cover harus paling kuat secara visual: utamakan cover_photo atau cover_split (pakai foto), atau cover_type untuk opini.
- Anggaran foto AI maksimal 4 per konten (foto brand tidak dihitung): pakai foto di cover dan di 1-3 slide lain yang memang terbantu oleh visual (orang, suasana kerja, produk, contoh nyata). Slide konseptual pakai point_icon / list / steps / compare.
- Untuk slide berfoto, isi image.query (stok, bahasa Inggris) DAN image.prompt (AI image, bahasa Inggris): subjek spesifik, konteks Indonesia bila ada manusia, setting, sudut kamera, cahaya, mood. Sisakan ruang kosong agar teks terbaca. Tidak ada teks di dalam gambar.
- Untuk slide tanpa foto, kosongkan image.query dan image.prompt.
- Highlight 1-3 kata paling penting di headline dengan *bintang*. Jangan highlight seluruh kalimat.

# Aturan menulis
- Bahasa Indonesia yang natural, sesuai tone brand. Istilah bahasa Inggris boleh bila memang lazim dipakai audiens.
- Jangan mengarang fakta, angka, testimoni, harga, atau klaim produk yang tidak ada di informasi brand. Layout stat hanya untuk angka yang benar-benar aman/umum; jika ragu, jangan pakai stat.
- Jangan pakai emoji atau simbol panah di teks slide (emoji boleh di caption).
- Teks di desain harus singkat — orang membaca slide dalam 2-3 detik. Detail ditaruh di caption.
- Caption: baris pertama hook kuat, isi dengan paragraf pendek, tutup dengan CTA. Maksimal ~150 kata. Jangan menaruh hashtag di caption.`;
}

function formatRules(format: PostFormat): string {
  return format === "single"
    ? `Format: SINGLE POST → tepat 1 slide. Pilih layout paling kuat untuk ide ini (biasanya cover_photo, cover_split, cover_type, stat, quote, atau compare).`
    : `Format: CAROUSEL → 5 sampai 8 slide.
- Slide 1: cover (cover_photo / cover_split / cover_type) dengan hook yang bikin orang swipe.
- Slide tengah: isi yang bervariasi (point_photo, point_icon, list, steps, compare, stat, quote).
- Slide terakhir: layout cta.`;
}

export async function callStructured<T extends z.ZodType>(
  system: string,
  content: Anthropic.Beta.BetaContentBlockParam[] | string,
  schema: T,
  effort: "low" | "medium" | "high" = "medium",
): Promise<z.infer<T>> {
  try {
    const res = await anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      output_config: { effort, format: betaZodOutputFormat(schema) },
      messages: [{ role: "user", content }],
    });
    recordAI(res.model, res.usage);
    if (res.stop_reason === "refusal") {
      throw new Error("AI menolak permintaan ini. Coba ubah brief atau instruksinya.");
    }
    if (res.stop_reason === "max_tokens" || !res.parsed_output) {
      throw new Error("Jawaban AI terpotong / tidak valid. Coba lagi.");
    }
    return res.parsed_output as z.infer<T>;
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error("ANTHROPIC_API_KEY tidak valid.");
    if (err instanceof Anthropic.RateLimitError) throw new Error("Batas pemakaian AI tercapai, coba lagi sebentar lagi.");
    if (err instanceof Anthropic.APIError) throw new Error(`Error dari AI (${err.status}): ${err.message}`);
    throw err;
  }
}

// ------------------------------------------------------------------ hasil

export interface DraftSlide {
  slide: Slide; // image belum terisi (null) kecuali dipertahankan dari versi lama
  imageRequest: ImageRequest | null; // diisi bila slide butuh foto baru
}
export interface Draft {
  title: string;
  slides: DraftSlide[];
  caption: string;
  hashtags: string[];
}

function toDraftSlides(out: SlideOutT[], format: PostFormat, previous?: Slide[]): DraftSlide[] {
  const list = format === "single" ? out.slice(0, 1) : out.slice(0, 10);
  return list.map((o, i) => {
    const prev = previous?.[i];
    const wantsImage = Boolean(o.image.assetId || o.image.query || o.image.prompt);
    const keepOld = prev?.image && !o.image.change && wantsImage;
    const slide = normalizeSlide({
      layout: o.layout,
      kicker: o.kicker,
      headline: o.headline,
      body: o.body,
      stat: o.stat,
      items: o.items,
      itemsB: o.itemsB,
      labelA: o.labelA,
      labelB: o.labelB,
      icon: o.icon,
      image: keepOld ? prev!.image : null,
    });
    return {
      slide,
      imageRequest: wantsImage && !keepOld ? { assetId: o.image.assetId, query: o.image.query, prompt: o.image.prompt, layout: o.layout } : null,
    };
  });
}

function toDraft(p: GeneratedPost, format: PostFormat, previous?: Slide[]): Draft {
  return {
    title: p.title,
    slides: toDraftSlides(p.slides, format, previous),
    caption: p.caption.trim(),
    hashtags: p.hashtags.map((h) => h.replace(/^#/, "").replace(/\s+/g, "")).filter(Boolean).slice(0, 5),
  };
}

function slidesForPrompt(slides: Slide[]) {
  return slides.map((s) => ({
    layout: s.layout,
    kicker: s.kicker,
    headline: s.headline,
    body: s.body,
    stat: s.stat,
    items: s.items,
    itemsB: s.itemsB,
    labelA: s.labelA,
    labelB: s.labelB,
    icon: s.icon,
    image: s.image ? { source: s.image.source, query: s.image.query, prompt: s.image.prompt } : null,
  }));
}

// ------------------------------------------------------------------ API

/** Konteks tambahan dari referensi desain owner (teks arahan + gambar). */
export interface RefContext {
  text: string;
  images: Anthropic.Beta.BetaContentBlockParam[];
}
const withRef = (prompt: string, ref?: RefContext | null): Anthropic.Beta.BetaContentBlockParam[] | string =>
  ref ? [...ref.images, { type: "text", text: `${ref.text}\n\n${prompt}` }] : prompt;

const PROMO_WORDS = /promo|diskon|cashback|gratis|potongan|sale|beli \d|harga spesial|voucher/i;

export async function generateIdeas(brand: Brand, opts: { brief: string; count: number; recentTitles: string[]; reference?: string }) {
  if (!config.hasAI) return demoIdeas(brand, opts.count, opts.brief);
  const prompt = `Buat ${opts.count} ide konten baru untuk minggu ini.

Brief dari owner: ${opts.brief || "(tidak ada brief khusus — seimbangkan pilar konten)"}

Ide yang sudah pernah dibuat (jangan diulang atau terlalu mirip):
${opts.recentTitles.length ? opts.recentTitles.map((t) => `- ${t}`).join("\n") : "- (belum ada)"}

Campurkan format: kebanyakan carousel (lebih tinggi save & share), beberapa single post. Sebar ke pilar konten yang berbeda. Tiap ide harus spesifik, punya potensi visual yang kuat, dan langsung bisa dieksekusi — bukan topik umum.${opts.reference ? `\n\nOwner melampirkan referensi desain. Pilih ide & format yang cocok dieksekusi dengan gaya ini:\n${opts.reference}` : ""}`;
  const out = await callStructured(brandSystemPrompt(brand), prompt, IdeasSchema);
  return out.ideas.slice(0, opts.count);
}

export async function generatePost(brand: Brand, idea: Idea, ref?: RefContext | null): Promise<Draft> {
  if (!config.hasAI) return demoPost(brand, idea);
  const prompt = `Buat konten lengkap (copy + art direction) dari ide yang sudah di-ACC berikut.

Judul: ${idea.title}
Hook: ${idea.hook}
Isi / angle: ${idea.angle}
Pilar: ${idea.pillar}

${formatRules(idea.format)}

Pastikan alur slide enak dibaca berurutan, visualnya bervariasi, dan caption melengkapi (bukan mengulang persis) isi slide.${ref ? "\nKarena ada referensi: kemiripan dengan referensi lebih penting daripada aturan variasi layout." : ""}`;
  const out = await callStructured(brandSystemPrompt(brand), withRef(prompt, ref), PostSchema);
  return toDraft(out, idea.format);
}

export async function revisePost(brand: Brand, post: Post, instruction: string, ref?: RefContext | null): Promise<Draft> {
  if (!config.hasAI) {
    return {
      title: post.title,
      slides: post.slides.map((slide) => ({ slide, imageRequest: null })),
      caption: `${post.caption}\n\n[DEMO] Revisi diminta: ${instruction}`,
      hashtags: post.hashtags,
    };
  }
  const prompt = `Ini konten yang sudah kamu buat sebelumnya (JSON):
${JSON.stringify({ title: post.title, slides: slidesForPrompt(post.slides), caption: post.caption, hashtags: post.hashtags }, null, 2)}

Owner meminta revisi: "${instruction}"

Terapkan revisi tersebut. Pertahankan bagian yang tidak diminta untuk diubah. Hemat biaya: JANGAN mengganti foto kecuali owner memintanya secara eksplisit (mis. "ganti foto", "bedakan orangnya") atau slide baru memang butuh foto. Untuk slide yang fotonya tetap, isi image.query/prompt seperti semula dan image.change = false. Set image.change = true hanya bila foto perlu diganti (atau slide baru butuh foto).
${formatRules(post.format)}`;
  const out = await callStructured(brandSystemPrompt(brand), withRef(prompt, ref), PostSchema);
  return toDraft(out, post.format, post.slides);
}

/** AI art director: lihat hasil render, perbaiki yang kurang (teks kepanjangan, layout monoton, kontras, dsb). */
export async function reviewDesign(
  brand: Brand,
  post: Pick<Post, "slides" | "format" | "caption">,
  renders: string[], // base64 JPEG per slide
  ref?: RefContext | null,
): Promise<{ verdict: "approve" | "revise"; notes: string; slides: DraftSlide[] } | null> {
  if (!config.hasAI) return null;
  const content: Anthropic.Beta.BetaContentBlockParam[] = ref ? [...ref.images, { type: "text", text: ref.text }] : [];
  renders.forEach((data, i) => {
    content.push({ type: "text", text: `Slide ${i + 1}:` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
  });
  content.push({
    type: "text",
    text: `Di atas adalah hasil render carousel/post yang akan diposting. Data slide (JSON):
${JSON.stringify(slidesForPrompt(post.slides), null, 2)}

Review sebagai art director agency yang galak tapi adil.${ref ? " Owner minta hasilnya SANGAT MIRIP dengan gambar referensi di awal: bandingkan langsung dan perbaiki bagian yang belum mirip (komposisi, kepadatan teks, gaya)." : ""} Cek: (1) hook cover cukup kuat & visualnya eye-catching, (2) teks terbaca, tidak terlalu panjang, tidak terpotong/bertumpuk, (3) variasi layout & ritme visual, (4) foto relevan dengan isi slide, (5) konsistensi brand, (6) alur cerita antar slide.
Bila sudah layak posting, verdict "approve" dan kembalikan slide apa adanya (image.change = false). Bila ada yang perlu diperbaiki, verdict "revise" dan kembalikan slide versi perbaikan — set image.change = true hanya untuk foto yang tidak relevan/jelek. Jangan mengubah jumlah slide kecuali benar-benar perlu.
${formatRules(post.format)}`,
  });
  const out = await callStructured(brandSystemPrompt(brand), content, ReviewSchema);
  return { verdict: out.verdict, notes: out.notes, slides: toDraftSlides(out.slides, post.format, post.slides) };
}

const StyleSchema = z.object({
  styleNotes: z.string().describe("Ringkasan gaya visual & copywriting dari contoh post, berupa poin-poin praktis"),
  imageStyle: z.string().describe("Art direction foto/ilustrasi dalam 1-2 kalimat (dipakai sebagai pedoman gambar)"),
  suggestedTemplate: z.enum(TEMPLATE_KEYS),
});

export async function analyzeExamples(
  brand: Brand,
  images: { data: string; mediaType: "image/png" | "image/jpeg" | "image/webp" }[],
) {
  if (!config.hasAI) {
    return {
      styleNotes: "[DEMO] Isi ANTHROPIC_API_KEY agar AI bisa menganalisis contoh post secara otomatis.",
      imageStyle: brand.imageStyle,
      suggestedTemplate: brand.defaultTemplate,
    };
  }
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...images.map((img) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: img.mediaType, data: img.data },
    })),
    {
      type: "text",
      text: `Ini contoh post media sosial yang disukai owner brand. Analisis gaya visual (komposisi, hierarki teks, kepadatan teks, penggunaan foto vs grafis, gaya foto/ilustrasi, warna) dan gaya copy (panjang kalimat, tone, struktur hook). Tulis catatan gaya yang praktis untuk membuat konten baru, art direction untuk foto/ilustrasi, dan pilih template yang paling mendekati: "bold" (latar warna solid berganti-ganti, bentuk dekoratif), "clean" (latar terang, minimalis), atau "mix" (cover & penutup gelap, isi terang, editorial).`,
    },
  ];
  return callStructured(brandSystemPrompt(brand), content, StyleSchema);
}

// ------------------------------------------------------------------ mode demo

function demoIdeas(brand: Brand, count: number, brief = "") {
  const pillars = brand.pillars.length ? brand.pillars : ["Edukasi"];
  if (count === 1 && PROMO_WORDS.test(brief)) {
    return [
      {
        title: "[DEMO] Promo spesial akhir bulan",
        hook: "Akhir bulan, dompet tetap aman.",
        angle: "Penawaran promo dengan angka besar, benefit singkat, dan tombol ajakan (mode demo).",
        pillar: "Promo",
        format: "carousel" as const,
        rationale: "Contoh konten promo untuk mencoba mode iklan.",
      },
    ];
  }
  const base = [
    { title: "5 kesalahan yang bikin konten sepi engagement", format: "carousel" as const },
    { title: "Satu kebiasaan kecil yang menghemat 2 jam kerja", format: "single" as const },
    { title: "Checklist sebelum posting konten", format: "carousel" as const },
    { title: "Mitos vs fakta soal branding", format: "carousel" as const },
    { title: "Kutipan minggu ini dari tim kami", format: "single" as const },
    { title: "Cara kerja kami dari brief sampai hasil", format: "carousel" as const },
  ];
  return Array.from({ length: count }, (_, i) => {
    const b = base[i % base.length];
    return {
      title: `[DEMO] ${b.title}`,
      hook: "Kalau kamu masih begini, pantas hasilnya belum maksimal.",
      angle: "Contoh ide (mode demo). Isi ANTHROPIC_API_KEY agar ide dibuat AI sesuai brand.",
      pillar: pillars[i % pillars.length],
      format: b.format,
      rationale: "Ide contoh untuk mencoba alur ACC.",
    };
  });
}

function demoPost(brand: Brand, idea: Idea): Draft {
  const title = idea.title.replace("[DEMO] ", "");
  const photo = (q: string, layout?: string): ImageRequest => ({ assetId: "", query: q, prompt: q, layout });
  if (idea.reference?.template === "promo" || PROMO_WORDS.test(`${idea.title} ${idea.angle}`)) {
    const raw: [Partial<Slide>, ImageRequest | null][] = [
      [{ layout: "promo_hero", kicker: "Promo minggu ini", headline: "Akhir bulan *tetap hemat*", stat: "50%", labelA: "Cashback", labelB: "Pesan sekarang", body: "Contoh S&K · mode demo" }, photo("smiling Indonesian woman holding smartphone", "promo_hero")],
      [{ layout: "promo_offer", kicker: "Spesial", headline: "Beli 2 *gratis 1*", stat: "2+1", labelA: "Semua menu", items: ["Semua cabang", "Tiap Jumat", "Bisa takeaway"], labelB: "Klaim promo", body: "Contoh syarat & ketentuan." }, null],
      [{ layout: "list", kicker: "Cara klaim", headline: "Gampang *banget*", items: ["Datang ke outlet", "Tunjukkan postingan ini", "Nikmati promonya"] }, null],
      [{ layout: "cta", headline: "Jangan sampai *kelewatan*", body: brand.cta }, null],
    ];
    return {
      title,
      slides: (idea.format === "single" ? raw.slice(0, 1) : raw).map(([s, req]) => ({ slide: normalizeSlide(s), imageRequest: req })),
      caption: `${idea.hook}\n\nIni caption contoh dari mode demo. Setelah ANTHROPIC_API_KEY diisi, copy promo & art direction dibuat AI sesuai brief dan referensimu.\n\n${brand.cta} 👉 ${brand.handle}`,
      hashtags: ["promo", "diskon", "hemat"],
    };
  }
  const raw: [Partial<Slide>, ImageRequest | null][] =
    idea.format === "single"
      ? [[{ layout: "cover_photo", kicker: idea.pillar, headline: `${title.split(" ").slice(0, -2).join(" ")} *${title.split(" ").slice(-2).join(" ")}*`, body: idea.hook }, photo("creative team working")]]
      : [
          [{ layout: "cover_photo", kicker: idea.pillar, headline: `5 kesalahan yang bikin konten *sepi*`, body: "Nomor 3 paling sering terjadi" }, photo("frustrated marketer laptop")],
          [{ layout: "point_photo", kicker: "Kesalahan", headline: "Tidak punya *tujuan* yang jelas", body: "Tiap konten harus punya satu tujuan: edukasi, kepercayaan, atau jualan." }, photo("team planning whiteboard")],
          [{ layout: "point_icon", kicker: "Kesalahan", headline: "Hook di slide pertama *lemah*", body: "Orang memutuskan geser atau scroll dalam 3 detik.", icon: "Zap" }, null],
          [{ layout: "compare", headline: "Yang sering dilakukan vs yang *seharusnya*", labelA: "Salah", labelB: "Benar", items: ["Satu slide penuh teks", "Posting asal jadi"], itemsB: ["Satu slide, satu ide", "Rencanakan tiap minggu"] }, null],
          [{ layout: "list", kicker: "Checklist", headline: "Sebelum klik *posting*", items: ["Hook jelas di slide pertama", "Visual sesuai brand", "CTA yang spesifik"] }, null],
          [{ layout: "cta", headline: "Simpan biar *nggak lupa*", body: brand.cta }, null],
        ];
  return {
    title,
    slides: raw.map(([s, req]) => ({ slide: normalizeSlide(s), imageRequest: req })),
    caption: `${idea.hook}\n\nIni caption contoh dari mode demo. Setelah ANTHROPIC_API_KEY diisi, caption & art direction dibuat AI sesuai brand ${brand.name}.\n\n${brand.cta} 👉 ${brand.handle}`,
    hashtags: ["marketing", "kontenkreator", "tipsbisnis"],
  };
}
