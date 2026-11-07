import "server-only";
import { DENSITY_KEYS, FONT_PAIR_GUIDE, PACK_GUIDE, PACK_KEYS } from "./design";
import { FONT_PAIR_KEYS } from "./font-pairs";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";
import { brandSystemPrompt, callStructured } from "./ai";
import { readMedia } from "./media";
import { supportsReferences } from "./image-gen";
import type { WorkspaceRepo } from "./db";
import { BODY_FONT_KEYS, VISUAL_STYLES, FONT_KEYS, FONT_OPTIONS, SLIDE_LAYOUTS, TEMPLATE_KEYS, type Brand, type FontKey, type PostReference, type SlideLayout, type TemplateKey } from "./types";

/**
 * Referensi desain: owner menempel / mengunggah contoh ("bikin seperti ini").
 * 1. Gambar dinormalisasi & disimpan di storage workspace.
 * 2. Palet warna dihitung dari piksel (selalu jalan, tanpa AI).
 * 3. Bila AI aktif: dianalisis dengan vision → layout, tipografi, gaya copy & foto.
 * Hasilnya disimpan di ide/konten (PostReference) dan dipakai saat menulis, mendesain, dan merender.
 */

export const MAX_REFS = 6;
const MAX_BYTES = 8 * 1024 * 1024;

/** Simpan file referensi dari form (validasi + kompres). Mengembalikan URL. */
export async function uploadReferences(w: WorkspaceRepo, files: File[]): Promise<string[]> {
  const imgs = files.filter((f) => f && f.size > 0).slice(0, MAX_REFS);
  const buffers: Buffer[] = [];
  for (const f of imgs) {
    if (!f.type.startsWith("image/")) throw new Error(`${f.name || "File"} bukan gambar`);
    if (f.size > MAX_BYTES) throw new Error(`${f.name || "Gambar"} terlalu besar (maks 8 MB)`);
    buffers.push(Buffer.from(await f.arrayBuffer()));
  }
  return uploadReferenceBuffers(w, buffers);
}

/** Normalisasi (JPEG ≤1600px) lalu simpan gambar referensi. */
export async function uploadReferenceBuffers(w: WorkspaceRepo, buffers: Buffer[]): Promise<string[]> {
  const urls: string[] = [];
  for (const b of buffers.slice(0, MAX_REFS)) {
    const jpg = await sharp(b, { failOn: "none" })
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 86 })
      .toBuffer();
    urls.push(await w.uploadFile(`refs/${randomUUID()}.jpg`, jpg, "image/jpeg"));
  }
  return urls;
}

// ---------------------------------------------------------------- palet (tanpa AI)

interface Swatch {
  hex: string;
  share: number; // porsi luas 0..1
  lum: number;
  sat: number;
}

const hex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function relLum(h: string) {
  const [r, g, b] = rgb(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function satOf(r: number, g: number, b: number) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  return max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
}
const dist = (a: string, b: string) => {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
};
export const contrastOf = (a: string, b: string) => {
  const [x, y] = [relLum(a), relLum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/** Warna dominan dari semua gambar referensi (porsi luas). */
export async function paletteOf(buffers: Buffer[]): Promise<Swatch[]> {
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  let total = 0;
  for (const buf of buffers) {
    const { data, info } = await sharp(buf).resize(60, 75, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += info.channels) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
      const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      e.n++;
      e.r += r;
      e.g += g;
      e.b += b;
      buckets.set(key, e);
      total++;
    }
  }
  const raw = [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .map((e) => ({ hex: hex(e.r / e.n, e.g / e.n, e.b / e.n), n: e.n, sat: satOf(e.r / e.n, e.g / e.n, e.b / e.n) }));
  // gabungkan warna yang mirip
  const merged: { hex: string; n: number; sat: number }[] = [];
  for (const c of raw) {
    const near = merged.find((m) => dist(m.hex, c.hex) < 38);
    if (near) near.n += c.n;
    else merged.push({ ...c });
  }
  return merged
    .sort((a, b) => b.n - a.n)
    .slice(0, 10)
    .map((m) => ({ hex: m.hex, share: m.n / total, lum: relLum(m.hex), sat: m.sat }));
}

/** Campur dua warna hex (t = porsi warna b). */
const mixHex = (a: string, b: string, t: number) => {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return hex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
};

/**
 * Warna Brand Kit dari logo: warna logo paling dominan jadi warna utama, warna kedua jadi
 * sekunder/aksen, latar = tint sangat muda dari warna utama. Null bila logo hitam-putih saja.
 */
export async function colorsFromLogo(logo: Buffer): Promise<Brand["colors"] | null> {
  const flat = await sharp(logo).flatten({ background: "#ffffff" }).png().toBuffer();
  const sw = (await paletteOf([flat])).filter((c) => c.lum < 0.88 && c.sat > 0.22 && c.share > 0.004);
  if (!sw.length) return null;
  const vivid = [...sw].sort((a, b) => b.share * (0.5 + b.sat) - a.share * (0.5 + a.sat));
  let primary = vivid[0].hex;
  if (relLum(primary) > 0.45) primary = mixHex(primary, "#0B0D1A", 0.35); // terlalu terang untuk latar cover
  const second = vivid.find((c) => dist(c.hex, vivid[0].hex) > 70)?.hex;
  const accent = second ?? mixHex(vivid[0].hex, "#FFFFFF", 0.35);
  const secondary = second ? mixHex(primary, second, 0.5) : mixHex(primary, "#000000", 0.3);
  return { primary, secondary, accent, background: mixHex(vivid[0].hex, "#FFFFFF", 0.95), text: "#14161F" };
}

/** Tentukan peran warna (latar, teks, utama, aksen) + template yang paling mirip. */
export function rolesFromPalette(sw: Swatch[]): { colors: Brand["colors"]; template: TemplateKey } {
  const bg = sw[0]?.hex ?? "#F7F6F2";
  const bgLum = relLum(bg);
  const bgSat = sw[0]?.sat ?? 0;
  const others = sw.slice(1).filter((s) => s.share > 0.01 && dist(s.hex, bg) > 50);
  const vivid = [...others].sort((a, b) => b.sat * Math.sqrt(b.share) - a.sat * Math.sqrt(a.share));
  const darkest = [...sw].sort((a, b) => a.lum - b.lum)[0]?.hex ?? "#14161F";
  const lightest = [...sw].sort((a, b) => b.lum - a.lum)[0]?.hex ?? "#FFFFFF";
  const boldLook = bgLum < 0.3 || (bgSat > 0.35 && bgLum < 0.7);

  if (boldLook) {
    const secondary = others.find((s) => s.lum < 0.6 && dist(s.hex, bg) > 60)?.hex ?? bg;
    const accent = vivid.find((s) => contrastOf(s.hex, bg) >= 2.5)?.hex ?? (bgLum < 0.3 ? "#FFD24D" : "#14161F");
    const background = relLum(lightest) > 0.75 ? lightest : "#F7F6F2";
    const text = relLum(darkest) < 0.08 ? darkest : "#14161F";
    // Banyak warna mencolok (≥ 2 selain latar) = gaya iklan promo; selain itu bold biasa.
    const loud = vivid.filter((v) => v.sat > 0.45 && v.share > 0.02).length >= 2;
    return { colors: { primary: bg, secondary, accent, background, text }, template: loud ? "promo" : "bold" };
  }
  const text = contrastOf(darkest, bg) >= 4.5 ? darkest : "#14161F";
  const primary = vivid[0]?.hex ?? (others.find((s) => s.lum < 0.5)?.hex ?? text);
  const accent = vivid.find((s) => dist(s.hex, primary) > 70)?.hex ?? primary;
  const secondary = others.find((s) => s.hex !== primary && s.hex !== accent && s.lum < 0.7)?.hex ?? primary;
  return { colors: { primary, secondary, accent, background: bg, text }, template: "clean" };
}

// ---------------------------------------------------------------- analisis AI

const HEX = /^#[0-9a-fA-F]{6}$/;

const RefSchema = z.object({
  notes: z
    .string()
    .describe(
      "Analisis praktis untuk meniru referensi: komposisi & grid, posisi judul, hierarki & ukuran teks, kepadatan teks per slide, elemen dekoratif (bentuk, sticker, garis, nomor), penggunaan foto vs grafis, gaya hook & copy, jumlah slide & alurnya. Poin-poin singkat, Bahasa Indonesia.",
    ),
  imageStyle: z.string().describe("Art direction foto/ilustrasi di referensi dalam bahasa Inggris (subjek, cahaya, warna, mood). Kosong bila referensi tidak memakai foto"),
  usesPhotos: z.boolean(),
  layouts: z.array(z.enum(SLIDE_LAYOUTS)).describe("Untuk tiap gambar referensi secara berurutan: layout tersedia yang paling mirip"),
  template: z
    .enum(TEMPLATE_KEYS)
    .describe("promo: iklan/jualan dengan warna kontras, starburst, stiker, angka diskon; bold: latar warna solid/gelap berganti; clean: latar terang minimalis; mix: cover gelap, isi terang"),
  headingFont: z.enum(FONT_KEYS as [FontKey, ...FontKey[]]).describe("Font judul tersedia yang paling mirip dengan tipografi judul referensi"),
  bodyFont: z.enum(BODY_FONT_KEYS as [FontKey, ...FontKey[]]).describe("Font isi tersedia yang paling mirip dengan teks kecil di referensi"),
  designPack: z.enum(PACK_KEYS).describe(`Design Pack yang paling mendekati gaya referensi. ${PACK_GUIDE.replace(/\n/g, "; ")}`),
  fontPair: z.enum(FONT_PAIR_KEYS).describe("Pasangan huruf tersedia yang paling mirip dengan tipografi referensi (lihat daftar di prompt)"),
  density: z.enum(DENSITY_KEYS).describe("Kepadatan teks referensi: visual (hampir tanpa teks, foto dominan), seimbang, edukatif (banyak teks/info)"),
  palette: z.object({
    primary: z.string().describe("Hex warna utama/panel (latar cover/slide berwarna)"),
    secondary: z.string().describe("Hex warna kedua"),
    accent: z.string().describe("Hex warna highlight/aksen (kata yang disorot, sticker)"),
    background: z.string().describe("Hex latar terang untuk slide isi"),
    text: z.string().describe("Hex warna teks di atas latar terang"),
  }),
});

const LAYOUT_NAMES = SLIDE_LAYOUTS.join(", ");

export async function analyzeReference(brand: Brand, urls: string[], useRefColors: boolean): Promise<PostReference> {
  const buffers = (await Promise.all(urls.map((u) => readMedia(u).catch(() => null)))).filter((b): b is Buffer => Boolean(b));
  if (!buffers.length) throw new Error("Gambar referensi tidak bisa dibaca");
  const roles = rolesFromPalette(await paletteOf(buffers));
  const base: PostReference = {
    urls,
    notes: "",
    imageStyle: "",
    colors: useRefColors ? roles.colors : null,
    headingFont: null,
    bodyFont: null,
    template: roles.template,
    layouts: [],
  };
  if (!config.hasAI) return base;

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (let i = 0; i < buffers.length; i++) {
    const data = (await sharp(buffers[i]).resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer()).toString("base64");
    content.push({ type: "text", text: `Referensi ${i + 1}:` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
  }
  content.push({
    type: "text",
    text: `Owner ingin konten baru yang SANGAT MIRIP dengan referensi di atas (gaya, bukan isi). Bedah referensi ini seperti senior designer sebelum mengerjakan brief:
- Layout tersedia di sistem kami: ${LAYOUT_NAMES}. Petakan tiap gambar ke layout paling mirip (iklan promo dengan foto orang/produk + angka diskon → promo_hero; poster diskon tanpa foto → promo_offer).
- Font tersedia: ${FONT_KEYS.map((k) => `${k} (${FONT_OPTIONS[k].style})`).join("; ")}.
- Palet dari analisis piksel (sebagai acuan): utama ${roles.colors.primary}, kedua ${roles.colors.secondary}, aksen ${roles.colors.accent}, latar ${roles.colors.background}, teks ${roles.colors.text}. Koreksi bila perannya kurang tepat.
- Fokus pada hal yang bisa ditiru: komposisi, hierarki teks, kepadatan, dekorasi, gaya foto, gaya copy.
- Sistem desain kami (Design Pack): ${PACK_GUIDE.replace(/\n/g, "; ")}.
- Pasangan huruf tersedia: ${FONT_PAIR_GUIDE.replace(/\n/g, "; ")}. Pilih yang karakter judulnya paling mirip (serif/sans, tebal/tipis, sempit/lebar, kapital, tulisan tangan).`,
  });
  try {
    const out = await callStructured(brandSystemPrompt(brand), content, RefSchema, "medium");
    const p = out.palette;
    const aiColors = [p.primary, p.secondary, p.accent, p.background, p.text].every((c) => HEX.test(c))
      ? { primary: p.primary, secondary: p.secondary, accent: p.accent, background: p.background, text: p.text }
      : roles.colors;
    return {
      ...base,
      notes: out.notes,
      imageStyle: out.usesPhotos ? out.imageStyle : "",
      colors: useRefColors ? aiColors : null,
      headingFont: out.headingFont,
      bodyFont: out.bodyFont,
      template: out.template,
      layouts: out.layouts.slice(0, 10) as SlideLayout[],
      suggest: { pack: out.designPack, pair: out.fontPair, density: out.density },
    };
  } catch (e) {
    console.error("Analisis referensi AI gagal, pakai palet saja:", e);
    return base;
  }
}

/** Blok teks untuk prompt penulisan/desain. */
export function referencePrompt(ref: PostReference): string {
  if (!ref.urls.length) {
    const s = ref.style ? VISUAL_STYLES[ref.style] : null;
    return `# ARAH VISUAL PILIHAN OWNER${s ? `: ${s.label.toUpperCase()}` : ""} — WAJIB DIIKUTI
Owner memilih arah visual ini supaya hasilnya setara designer expert di gaya tersebut. Ikuti struktur cover, panjang & gaya judul, dan jenis foto di bawah dengan disiplin.
${ref.notes}
${ref.layouts.length ? `Kerangka layout: ${ref.layouts.join(" → ")} (slide pertama WAJIB ${ref.layouts[0]}; sesuaikan jumlah slide dengan format, single post cukup slide pertama).` : ""}
${ref.imageStyle ? `Art direction foto: ${ref.imageStyle}` : ""}`;
  }
  return `# REFERENSI DESAIN DARI OWNER — WAJIB DIIKUTI SEDEKAT MUNGKIN
Owner melampirkan ${ref.urls.length} gambar contoh dan ingin hasil yang sangat mirip gayanya. Tiru seperti designer agency meniru moodboard klien: komposisi, hierarki & panjang teks, gaya hook dan copy, penggunaan foto vs grafis, mood foto, jumlah & alur slide.
${ref.notes ? `Analisis referensi:\n${ref.notes}` : ""}
${ref.layouts.length ? `Urutan layout yang paling mirip dengan referensi: ${ref.layouts.join(" → ")}. Pakai urutan ini sebagai kerangka (sesuaikan jumlah slide dengan format).` : ""}
${ref.imageStyle ? `Gaya foto referensi: ${ref.imageStyle}` : ""}
Jangan menyalin teks, nama, logo, atau klaim milik pihak lain di referensi — isi tetap untuk brand ini.`;
}

/** Gambar referensi sebagai blok konten untuk AI (dikecilkan). */
export async function referenceImageBlocks(ref: PostReference): Promise<Anthropic.Beta.BetaContentBlockParam[]> {
  const out: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const [i, url] of ref.urls.slice(0, MAX_REFS).entries()) {
    try {
      const data = (await sharp(await readMedia(url)).resize(900, 900, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer()).toString("base64");
      out.push({ type: "text", text: `Gambar referensi ${i + 1}:` });
      out.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
    } catch {
      // gambar hilang: lanjut dengan analisis teks saja
    }
  }
  return out;
}

/** Ringkasan singkat untuk chat (warna & template). */
export function describeReference(ref: PostReference): string {
  const parts: string[] = [];
  if (ref.style) parts.push(`arah visual ${VISUAL_STYLES[ref.style].label}`);
  else if (ref.template) parts.push(ref.template === "bold" ? "latar warna solid yang tegas" : ref.template === "clean" ? "latar terang yang bersih" : "cover gelap dengan isi terang");
  if (ref.colors) parts.push(`palet ${ref.colors.primary}, ${ref.colors.accent} & ${ref.colors.background}`);
  if (ref.layouts.length) parts.push(`${ref.layouts.length} pola slide`);
  return parts.join(", ");
}

/** Gambar referensi sebagai JPEG kecil untuk generator gambar (maks 3, hemat biaya & ukuran request). */
export async function referenceImageBuffers(ref: PostReference | null): Promise<Buffer[]> {
  if (!ref || !supportsReferences()) return [];
  const out: Buffer[] = [];
  for (const url of ref.urls.slice(0, 3)) {
    try {
      out.push(await sharp(await readMedia(url)).resize(768, 768, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer());
    } catch {
      // lewati gambar yang tidak terbaca
    }
  }
  return out;
}
