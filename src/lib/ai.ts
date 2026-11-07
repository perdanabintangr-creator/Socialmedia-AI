import "server-only";
import { DENSITIES, PACK_GUIDE, PACK_KEYS, FONT_PAIR_GUIDE, densityGuide, isDensity, isPack, type Density, type PostDesign } from "./design";
import { FONT_PAIR_KEYS, isFontPair } from "./font-pairs";
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
  kicker: z.string().describe("Label kecil / sticker, maks 4 kata. Boleh kosong. Jangan mengulang nomor slide (nomor sudah tampil otomatis)"),
  headline: z.string().describe("Teks utama, maks ~10 kata. Bungkus 1-3 kata kunci dengan *bintang* untuk highlight"),
  body: z.string().describe("Teks pendukung maks ~25 kata. Untuk quote: nama/sumber kutipan"),
  stat: z.string().describe("stat: angka besar, mis. '73%'. promo_hero/promo_offer: angka promo, mis. '50%', '2+1', 'Rp10rb'. Selain itu kosong"),
  items: z.array(z.string()).describe("list/steps: 3-5 item pendek (maks 7 kata). compare: poin kolom kiri. Selain itu []"),
  itemsB: z.array(z.string()).describe("compare: poin kolom kanan. Selain itu []"),
  labelA: z.string().describe("compare: judul kolom kiri (mis. 'Mitos'). promo_*: label kecil di atas angka promo (mis. 'Cashback', 'Diskon'). Selain itu kosong"),
  labelB: z.string().describe("compare: judul kolom kanan (mis. 'Fakta'). promo_* & cta: teks tombol ajakan spesifik sesuai tujuan (mis. 'Pesan sekarang', 'Mampir hari ini', 'Save buat nanti'). editorial_cover/logo_reveal: teks tombol/tanggal kecil. Selain itu kosong"),
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

const ChooseDesign = {
  designPack: z.enum(PACK_KEYS).describe("Sistem desain yang paling cocok untuk brand & isi konten ini"),
  fontPair: z.enum(FONT_PAIR_KEYS).describe("Pasangan huruf yang paling cocok dengan karakter brand (lihat daftar)"),
};
const PostChooseSchema = PostSchema.extend(ChooseDesign);
const ReviseSchema = PostSchema.extend({
  designPack: z.enum([...PACK_KEYS, "same"]).describe("Ganti sistem desain HANYA bila owner meminta gaya/desain lain; selain itu 'same'"),
  fontPair: z.enum([...FONT_PAIR_KEYS, "same"]).describe("Ganti pasangan huruf HANYA bila owner meminta font/huruf lain (mis. 'lebih mewah', 'lebih tebal'); selain itu 'same'"),
  density: z.enum([...(Object.keys(DENSITIES) as Density[]), "same"]).describe("Ganti kepadatan teks HANYA bila owner minta tulisan lebih sedikit/banyak; selain itu 'same'"),
});

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
- logo_reveal: teaser / coming soon / pengumuman: logo brand besar di tengah, latar warna brand bercahaya, kicker kecil ("Segera hadir"), headline 2-6 kata, labelB tanggal. TANPA foto. Selalu single post.
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

${brand.insights ? `# Wawasan akun dari audit konsultan (WAJIB diikuti)\n${brand.insights}\n` : ""}
# Playbook social media specialist
- Setiap konten punya SATU tujuan jelas (awareness / edukasi / interaksi / kepercayaan / jualan) dan satu pesan utama. Tulis untuk satu orang spesifik dari target audiens, bukan "semua orang".
- Pikirkan perilaku di feed: orang memutuskan berhenti scroll dalam ±1,5 detik. Cover = janji yang jelas + rasa penasaran. Konten yang di-save & di-share biasanya: checklist, kerangka/template, perbandingan, kesalahan umum, angka/data, cerita nyata.
- Variasikan sudut: edukasi praktis, opini berani (contrarian yang masuk akal), behind the scenes, studi kasus/before-after, FAQ, mitos vs fakta, tren yang relevan dengan audiens Indonesia.

# Playbook copywriter
- Hook: pakai salah satu rumus terbukti — angka spesifik ("3 kesalahan…"), kontras/kontrarian ("Berhenti … kalau mau …"), pertanyaan yang menyentuh masalah ("Konten rame tapi nggak ada yang beli?"), janji hasil + waktu ("… dalam 7 hari"), rasa penasaran ("Yang jarang dibahas soal …"), panggilan audiens ("Buat pemilik kedai yang …").
- Tulis seperti orang Indonesia ngobrol di DM: kalimat pendek, kata kerja aktif, konkret. Satu slide = satu ide.
- DILARANG kata/frasa klise & kaku: "solusi terbaik", "tingkatkan bisnis Anda", "di era digital", "tidak bisa dipungkiri", "yuk simak", "simak selengkapnya", "dijamin", "terpercaya", "berkualitas", "inovatif", "revolusioner", "game changer", "maksimal" berulang, "Anda" (pakai "kamu" kecuali tone brand formal).
- Spesifik > umum: ganti klaim kosong dengan contoh, angka yang aman, langkah konkret, atau situasi yang dikenali audiens.
- Caption: baris pertama ≤ 125 karakter (terlihat sebelum "selengkapnya") dan harus menarik; isi 2-4 paragraf pendek yang menambah nilai (bukan mengulang slide); tutup dengan SATU CTA spesifik (save / share ke teman / komentar kata kunci / klik link bio). Hashtag terpisah: 3-6 hashtag niche + brand, bukan hashtag generik raksasa.

# Playbook desainer
- Hierarki: 1 fokus utama per slide (judul ATAU angka ATAU foto), maksimal 3 level teks. Judul cover maks ±8 kata, judul isi maks ±10 kata, body maks ±20 kata.
- Ritme carousel: hook → masalah/ketegangan → nilai (2-4 slide) → bukti/contoh → kesimpulan/CTA. Slide 2 harus langsung memberi nilai supaya orang terus geser.
- Kontras & keterbacaan: teks di atas foto hanya bila fotonya punya ruang kosong; pilih foto dengan satu subjek jelas, bukan foto ramai.
- Konsistensi brand: warna, font, dan gaya foto sama di semua slide; variasi datang dari layout, bukan dari gaya yang berbeda-beda.

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
- Caption: baris pertama hook kuat, isi dengan paragraf pendek, tutup dengan CTA. Maksimal ~150 kata. Jangan menaruh hashtag di caption.

# Cek diri sebelum menjawab (wajib, dalam kepala)
1. Apakah hook cover membuat target audiens berhenti scroll? Jika ragu, tulis ulang lebih spesifik.
2. Adakah kata klise dari daftar terlarang? Hapus.
3. Apakah tiap slide hanya satu ide dan teksnya bisa dibaca dalam 2-3 detik?
4. Apakah visual & warnanya konsisten dengan brand dan relevan dengan isi slide?
5. Apakah caption menambah nilai dan punya satu CTA jelas?`;
}

function formatRules(format: PostFormat): string {
  return format === "single"
    ? `Format: SINGLE POST → tepat 1 slide. Pilih layout paling kuat untuk ide ini (biasanya cover_photo, cover_split, cover_type, stat, quote, atau compare).`
    : `Format: CAROUSEL → 5 sampai 8 slide.
- Slide 1: cover (cover_photo / cover_split / cover_type) dengan hook yang bikin orang swipe.
- Slide tengah: isi yang bervariasi (point_photo, point_icon, list, steps, compare, stat, quote).
- Slide terakhir: layout cta.`;
}

/** Semua pekerjaan kreatif wajib lewat Claude — tidak ada konten contoh/tiruan. */
export function requireAI() {
  if (!config.hasAI) throw new Error("AI belum aktif: ANTHROPIC_API_KEY belum diisi di pengaturan server.");
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
  design?: { pack?: string | null; pair?: string | null; density?: string | null } | null; // pilihan desain dari AI
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

function toDraft(p: GeneratedPost & { designPack?: string; fontPair?: string; density?: string }, format: PostFormat, previous?: Slide[]): Draft {
  const pick = (v?: string) => (v && v !== "same" ? v : null);
  const design = p.designPack || p.fontPair || p.density ? { pack: pick(p.designPack), pair: pick(p.fontPair), density: pick(p.density) } : null;
  return {
    design,
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


export async function generateIdeas(brand: Brand, opts: { brief: string; count: number; recentTitles: string[]; reference?: string; month?: boolean }) {
  requireAI();
  const prompt = `Buat ${opts.count} ide konten baru untuk ${opts.month ? "SATU BULAN penuh (kalender konten bulanan)" : "minggu ini"}.${
    opts.month
      ? `\nSusun seperti social media strategist agency: urutkan sesuai tanggal tayang, campur tujuan (awareness/edukasi ±40%, engagement/interaksi ±20%, social proof/testimoni ±15%, behind the scenes ±10%, jualan/promo ±15%), selang-seling format & pilar supaya feed tidak monoton, dan buat alur kampanye yang nyambung dari minggu ke minggu.`
      : ""
  }

Brief dari owner: ${opts.brief || "(tidak ada brief khusus — seimbangkan pilar konten)"}

Ide yang sudah pernah dibuat (jangan diulang atau terlalu mirip):
${opts.recentTitles.length ? opts.recentTitles.map((t) => `- ${t}`).join("\n") : "- (belum ada)"}

Campurkan format: kebanyakan carousel (lebih tinggi save & share), beberapa single post. Sebar ke pilar konten yang berbeda. Tiap ide harus spesifik, punya potensi visual yang kuat, dan langsung bisa dieksekusi — bukan topik umum.${opts.reference ? `\n\nOwner melampirkan referensi desain. Pilih ide & format yang cocok dieksekusi dengan gaya ini:\n${opts.reference}` : ""}`;
  const out = await callStructured(brandSystemPrompt(brand), prompt, IdeasSchema);
  return out.ideas.slice(0, opts.count);
}

/** Konten teaser/pengumuman: harus terasa eksklusif & visual-first, bukan carousel edukasi. */
export const TEASER_WORDS = /coming\s?soon|segera hadir|teaser|launch|peluncuran|countdown|sneak ?peek|bocoran|stay tuned|nantikan|rilis|grand opening|pre-?order|segera dibuka/i;
export const isTeaser = (idea: Pick<Idea, "title" | "hook" | "angle">, extra = "") => TEASER_WORDS.test(`${idea.title} ${idea.hook} ${idea.angle} ${extra}`);

const TEASER_GUIDE = `# KONTEN TEASER / COMING SOON (WAJIB)
Ini teaser eksklusif yang SIMPEL: SINGLE POST, 1 slide saja, layout logo_reveal (logo brand besar di tengah di atas latar warna brand). Bukan carousel, bukan edukasi.
- kicker: label kecil kapital, mis. "Segera hadir" / "Coming soon".
- headline: 2-6 kata yang bikin penasaran, tanpa *bintang*, mis. "Sesuatu yang baru untuk marketer".
- labelB: tanggal / ajakan sangat singkat, mis. "12.12" atau "Nantikan". body boleh kosong.
- Kosongkan image.prompt & image.query (visualnya logo brand).
- Caption singkat penuh rasa penasaran + ajakan nyalakan notifikasi/follow.`;

/** Arahan desain untuk copywriter (Design Pack). */
function designPrompt(design: PostDesign | null | undefined, choose: boolean) {
  if (!design) return "";
  return `\n\n# SISTEM DESAIN
Konten dirender dengan Design Pack (komposisi ala desainer, tiap slide divariasikan otomatis). Pakai layout inti saja: cover_photo (slide 1), point_photo / point_icon, list / steps, compare, stat, quote, cta. Jangan pakai layout klasik (news_cover, folk_cover, editorial_cover, creative_cover, promo_*).
${densityGuide(design.density)}${
    choose
      ? `\n\nPilih juga designPack & fontPair yang paling cocok dengan brand, audiens, dan isi konten ini.\nDesign Pack:\n${PACK_GUIDE}\nPasangan huruf:\n${FONT_PAIR_GUIDE}`
      : ""
  }`;
}

export async function generatePost(brand: Brand, idea: Idea, ref?: RefContext | null, opts: { design?: PostDesign | null; choose?: boolean } = {}): Promise<Draft> {
  requireAI();
  const teaser = isTeaser(idea);
  const prompt = `Buat konten lengkap (copy + art direction) dari ide yang sudah di-ACC berikut.

Judul: ${idea.title}
Hook: ${idea.hook}
Isi / angle: ${idea.angle}
Pilar: ${idea.pillar}

${formatRules(idea.format)}

Pastikan alur slide enak dibaca berurutan, visualnya bervariasi, dan caption melengkapi (bukan mengulang persis) isi slide.${ref ? "\nKarena ada referensi: kemiripan dengan referensi lebih penting daripada aturan variasi layout." : ""}${teaser ? `\n\n${TEASER_GUIDE}` : designPrompt(opts.design, Boolean(opts.choose))}`;
  if (opts.choose && opts.design && !teaser) {
    const out = await callStructured(brandSystemPrompt(brand), withRef(prompt, ref), PostChooseSchema);
    return toDraft(out, idea.format);
  }
  const out = await callStructured(brandSystemPrompt(brand), withRef(prompt, ref), PostSchema);
  return toDraft(out, idea.format);
}

export async function revisePost(brand: Brand, post: Post, instruction: string, ref?: RefContext | null): Promise<Draft> {
  requireAI();
  const design = post.reference?.design ?? null;
  const prompt = `Ini konten yang sudah kamu buat sebelumnya (JSON):
${JSON.stringify({ title: post.title, slides: slidesForPrompt(post.slides), caption: post.caption, hashtags: post.hashtags }, null, 2)}

Owner meminta revisi: "${instruction}"

Terapkan revisi tersebut. Pertahankan bagian yang tidak diminta untuk diubah. Hemat biaya: JANGAN mengganti foto kecuali owner memintanya secara eksplisit (mis. "ganti foto", "bedakan orangnya") atau slide baru memang butuh foto. Untuk slide yang fotonya tetap, isi image.query/prompt seperti semula dan image.change = false. Set image.change = true hanya bila foto perlu diganti (atau slide baru butuh foto).
${formatRules(post.format)}${
    design
      ? `${designPrompt(design, false)}\n\nDesain sekarang: pack=${design.pack}, fontPair=${design.pair}, density=${design.density}. Bila owner minta ganti gaya/font/kepadatan teks, isi designPack/fontPair/density dengan pilihan baru dari daftar ini:\nDesign Pack:\n${PACK_GUIDE}\nPasangan huruf:\n${FONT_PAIR_GUIDE}\nKepadatan: visual / seimbang / edukatif. Selain itu isi "same".`
      : ""
  }`;
  if (design) {
    const out = await callStructured(brandSystemPrompt(brand), withRef(prompt, ref), ReviseSchema);
    return toDraft(out, post.format, post.slides);
  }
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
  requireAI();
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
