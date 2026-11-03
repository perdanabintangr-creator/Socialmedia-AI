import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { config } from "./config";
import type { Brand, Idea, Post, PostFormat, Slide } from "./types";

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

const SlideSchema = z.object({
  layout: z.enum(["cover", "point", "stat", "quote", "cta"]),
  kicker: z.string().describe("Label kecil di atas judul (boleh kosong), maks 4 kata"),
  headline: z.string().describe("Teks utama slide. Pendek & tegas, maks ~12 kata"),
  body: z.string().describe("Teks pendukung, maks ~30 kata. Kosongkan untuk cover/quote jika tidak perlu"),
  stat: z.string().describe("Angka/statistik besar untuk layout 'stat' (mis. '73%'), selain itu kosong"),
});
const PostSchema = z.object({
  title: z.string().describe("Nama internal konten ini, singkat"),
  slides: z.array(SlideSchema),
  caption: z.string().describe("Caption lengkap untuk Instagram & TikTok, tanpa hashtag"),
  hashtags: z.array(z.string()).describe("3-5 hashtag relevan, tanpa simbol #"),
});
type GeneratedPost = z.infer<typeof PostSchema>;

// ------------------------------------------------------------------ prompts

function brandSystemPrompt(brand: Brand): string {
  return `Kamu adalah social media strategist, copywriter, dan art director in-house untuk brand "${brand.name}" (${brand.handle}). Kamu menggantikan seluruh tim konten: kamu menyusun ide, menulis copy, dan menentukan isi tiap slide desain. Konten diposting ke Instagram (feed 4:5) dan TikTok (photo mode).

# Brand
Tentang brand: ${brand.description || "(belum diisi — tulis secara umum dan aman)"}
Target audiens: ${brand.audience || "(belum diisi)"}
Gaya bahasa / tone: ${brand.tone}
Pilar konten: ${brand.pillars.join(", ")}
CTA default: ${brand.cta}
Website: ${brand.website || "-"}
Wajib / dilarang: ${brand.doDont || "-"}
Catatan gaya visual & copy dari contoh post yang disukai brand: ${brand.styleNotes || "-"}

# Aturan menulis
- Bahasa Indonesia yang natural, sesuai tone brand. Istilah bahasa Inggris boleh bila memang lazim dipakai audiens.
- Jangan mengarang fakta, angka, testimoni, harga, atau klaim produk yang tidak ada di informasi brand. Jika memakai statistik umum, pastikan itu fakta yang luas diketahui; jika ragu, jangan pakai angka.
- Jangan pakai emoji atau simbol panah di teks slide (emoji boleh di caption).
- Teks di desain harus singkat — orang membaca slide dalam 2-3 detik. Detail ditaruh di caption.
- Caption: baris pertama adalah hook kuat, lalu isi dengan paragraf pendek, tutup dengan CTA. Maksimal ~150 kata. Jangan menaruh hashtag di caption.`;
}

function formatRules(format: PostFormat): string {
  return format === "single"
    ? `Format: SINGLE POST → tepat 1 slide. Pilih layout "cover", "stat", atau "quote" yang paling kuat untuk ide ini.`
    : `Format: CAROUSEL → 5 sampai 8 slide.
- Slide 1 wajib layout "cover" (hook besar yang bikin orang swipe).
- Slide tengah memakai "point" (satu poin per slide), boleh diselingi "stat" atau "quote".
- Slide terakhir wajib layout "cta" yang mengajak follow/save/share atau mengarah ke website.
- Untuk "point", isi kicker dengan penomoran mis. "Tips 1", "Langkah 2", atau label pendek.`;
}

async function callStructured<T extends z.ZodType>(
  system: string,
  content: Anthropic.Beta.BetaContentBlockParam[] | string,
  schema: T,
): Promise<z.infer<T>> {
  try {
    const res = await anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
      messages: [{ role: "user", content }],
    });
    if (res.stop_reason === "refusal") {
      throw new Error("AI menolak permintaan ini. Coba ubah brief atau instruksinya.");
    }
    if (res.stop_reason === "max_tokens" || !res.parsed_output) {
      throw new Error("Jawaban AI terpotong / tidak valid. Coba lagi.");
    }
    return res.parsed_output as z.infer<T>;
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new Error("ANTHROPIC_API_KEY tidak valid.");
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new Error("Batas pemakaian AI tercapai, coba lagi sebentar lagi.");
    }
    if (err instanceof Anthropic.APIError) {
      throw new Error(`Error dari AI (${err.status}): ${err.message}`);
    }
    throw err;
  }
}

function cleanSlides(slides: Slide[], format: PostFormat): Slide[] {
  const s = slides.map((x) => ({
    layout: x.layout,
    kicker: x.kicker ?? "",
    headline: x.headline ?? "",
    body: x.body ?? "",
    stat: x.stat ?? "",
  }));
  return format === "single" ? s.slice(0, 1) : s.slice(0, 10);
}

function cleanPost(p: GeneratedPost, format: PostFormat) {
  return {
    title: p.title,
    slides: cleanSlides(p.slides, format),
    caption: p.caption.trim(),
    hashtags: p.hashtags.map((h) => h.replace(/^#/, "").replace(/\s+/g, "")).filter(Boolean).slice(0, 5),
  };
}

// ------------------------------------------------------------------ API

export async function generateIdeas(
  brand: Brand,
  opts: { brief: string; count: number; recentTitles: string[] },
) {
  if (!config.hasAI) return demoIdeas(brand, opts.count);
  const prompt = `Buat ${opts.count} ide konten baru untuk minggu ini.

Brief dari owner: ${opts.brief || "(tidak ada brief khusus — seimbangkan pilar konten)"}

Ide yang sudah pernah dibuat (jangan diulang atau terlalu mirip):
${opts.recentTitles.length ? opts.recentTitles.map((t) => `- ${t}`).join("\n") : "- (belum ada)"}

Campurkan format: kebanyakan carousel (lebih tinggi save & share), beberapa single post. Sebar ke pilar konten yang berbeda. Tiap ide harus spesifik dan langsung bisa dieksekusi, bukan topik umum.`;
  const out = await callStructured(brandSystemPrompt(brand), prompt, IdeasSchema);
  return out.ideas.slice(0, opts.count);
}

export async function generatePost(brand: Brand, idea: Idea) {
  if (!config.hasAI) return demoPost(brand, idea);
  const prompt = `Buat konten lengkap dari ide yang sudah di-ACC berikut.

Judul: ${idea.title}
Hook: ${idea.hook}
Isi / angle: ${idea.angle}
Pilar: ${idea.pillar}

${formatRules(idea.format)}

Pastikan alur slide enak dibaca berurutan dan caption melengkapi (bukan mengulang persis) isi slide.`;
  const out = await callStructured(brandSystemPrompt(brand), prompt, PostSchema);
  return cleanPost(out, idea.format);
}

export async function revisePost(brand: Brand, post: Post, instruction: string) {
  if (!config.hasAI) {
    return {
      title: post.title,
      slides: post.slides,
      caption: `${post.caption}\n\n[DEMO] Revisi diminta: ${instruction}`,
      hashtags: post.hashtags,
    };
  }
  const prompt = `Ini konten yang sudah kamu buat sebelumnya (JSON):
${JSON.stringify({ title: post.title, slides: post.slides, caption: post.caption, hashtags: post.hashtags }, null, 2)}

Owner meminta revisi: "${instruction}"

Terapkan revisi tersebut. Pertahankan bagian yang tidak diminta untuk diubah.
${formatRules(post.format)}`;
  const out = await callStructured(brandSystemPrompt(brand), prompt, PostSchema);
  return cleanPost(out, post.format);
}

const StyleSchema = z.object({
  styleNotes: z
    .string()
    .describe("Ringkasan gaya visual & copywriting dari contoh post, berupa poin-poin praktis"),
  suggestedTemplate: z.enum(["mix", "bold", "clean"]),
});

export async function analyzeExamples(
  brand: Brand,
  images: { data: string; mediaType: "image/png" | "image/jpeg" | "image/webp" }[],
) {
  if (!config.hasAI) {
    return {
      styleNotes:
        "[DEMO] Isi ANTHROPIC_API_KEY agar AI bisa menganalisis contoh post secara otomatis.",
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
      text: `Ini contoh post media sosial yang disukai owner brand. Analisis gaya visual (komposisi, hierarki teks, kepadatan teks, penggunaan warna, gaya foto/ilustrasi) dan gaya copy (panjang kalimat, tone, struktur hook). Tulis catatan gaya yang praktis dan bisa langsung dipakai sebagai pedoman membuat konten baru. Pilih juga template yang paling mendekati: "bold" (latar warna solid, teks putih besar), "clean" (latar terang, minimalis), atau "mix" (cover & penutup bold, isi clean).`,
    },
  ];
  return callStructured(brandSystemPrompt(brand), content, StyleSchema);
}

// ------------------------------------------------------------------ demo mode

function demoIdeas(brand: Brand, count: number) {
  const pillars = brand.pillars.length ? brand.pillars : ["Edukasi"];
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

function demoPost(brand: Brand, idea: Idea) {
  const slides: Slide[] =
    idea.format === "single"
      ? [{ layout: "cover", kicker: idea.pillar, headline: idea.title.replace("[DEMO] ", ""), body: idea.hook, stat: "" }]
      : [
          { layout: "cover", kicker: idea.pillar, headline: idea.title.replace("[DEMO] ", ""), body: "Geser untuk lihat ›", stat: "" },
          { layout: "point", kicker: "Poin 1", headline: "Tidak punya tujuan yang jelas", body: "Setiap konten harus punya satu tujuan: edukasi, membangun kepercayaan, atau jualan.", stat: "" },
          { layout: "stat", kicker: "Fakta", headline: "Pembaca hanya melihat slide pertama", body: "Karena itu hook di cover menentukan segalanya.", stat: "3 detik" },
          { layout: "point", kicker: "Poin 2", headline: "Terlalu banyak teks", body: "Satu slide, satu ide. Detail taruh di caption.", stat: "" },
          { layout: "quote", kicker: "", headline: "Konsisten lebih penting daripada sempurna.", body: brand.name, stat: "" },
          { layout: "cta", kicker: "", headline: brand.cta, body: brand.handle, stat: "" },
        ];
  return {
    title: idea.title,
    slides,
    caption: `${idea.hook}\n\nIni caption contoh dari mode demo. Setelah ANTHROPIC_API_KEY diisi, caption akan ditulis AI sesuai tone ${brand.name}.\n\n${brand.cta} 👉 ${brand.handle}`,
    hashtags: ["marketing", "kontenkreator", "tipsbisnis"],
  };
}
