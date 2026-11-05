import "server-only";
import sharp from "sharp";
import { config } from "./config";
import { generateImage } from "./image-gen";
import type { WorkspaceRepo } from "./db";
import type { Brand, SlideImage } from "./types";

/**
 * Sumber gambar untuk slide, urutan prioritas:
 *  1. Foto milik brand (library di Brand Kit) bila AI memilihnya
 *  2. AI image generation (OpenAI gpt-image / Google Gemini) — ilustrasi/foto custom on-brand
 *  3. Stok foto Pexels (gratis untuk komersial)
 *  4. Tidak ada → slide otomatis memakai layout grafis (ikon/bentuk)
 * Semua gambar disalin ke storage sendiri supaya URL stabil untuk publisher.
 */

export interface ImageRequest {
  query: string; // kata kunci stok (Inggris)
  prompt: string; // prompt AI image (Inggris)
  assetId: string; // id foto brand
  layout?: string; // layout slide (promo_hero butuh subjek di latar polos warna utama)
}

const NO_TEXT = "No text, no letters, no words, no logos, no watermark.";

function aiPrompt(brand: Brand, req: ImageRequest) {
  const promo = req.layout === "promo_hero";
  return [
    req.prompt || req.query,
    promo
      ? `Advertising key visual: the subject stands/poses in the lower two thirds, waist-up, on a plain seamless solid ${brand.colors.primary} background (exact same flat color edge to edge, no gradient, no props behind), clean studio lighting, crisp edges like a cut-out. Keep the top third empty.`
      : "",
    `Art direction: ${brand.imageStyle}`,
    `Subtle color harmony with brand colors ${brand.colors.primary}, ${brand.colors.secondary} and ${brand.colors.accent}.`,
    "Vertical 4:5 composition, high-end social media agency quality, magazine-grade lighting.",
    NO_TEXT,
  ]
    .filter(Boolean)
    .join(" ");
}

async function searchPexels(query: string): Promise<{ data: Buffer; credit: string } | null> {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=15`;
  const res = await fetch(url, { headers: { Authorization: process.env.PEXELS_API_KEY! } });
  if (!res.ok) throw new Error(`Pexels: ${res.status}`);
  const json = (await res.json()) as { photos?: { src: { large2x: string }; photographer: string }[] };
  const photos = json.photos ?? [];
  if (!photos.length) return null;
  const pick = photos[Math.floor(Math.random() * Math.min(5, photos.length))];
  const img = await fetch(pick.src.large2x);
  if (!img.ok) throw new Error(`Pexels download: ${img.status}`);
  return { data: Buffer.from(await img.arrayBuffer()), credit: `Foto: ${pick.photographer} / Pexels` };
}

async function store(w: WorkspaceRepo, data: Buffer, key: string) {
  const jpg = await sharp(data).rotate().resize({ width: 1350, height: 1350, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
  return w.uploadFile(`images/${key}-${Date.now()}.jpg`, jpg, "image/jpeg");
}

/** Gambar abstrak on-brand untuk mode demo (tanpa API gambar). */
async function demoImage(brand: Brand, seed: number) {
  const { primary, secondary, accent } = brand.colors;
  const r = (n: number) => Math.abs(Math.sin(seed * 999 + n)) ;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${secondary}"/><stop offset="1" stop-color="${primary}"/></linearGradient></defs>
    <rect width="1080" height="1350" fill="url(#g)"/>
    <circle cx="${200 + r(1) * 700}" cy="${300 + r(2) * 500}" r="${220 + r(3) * 200}" fill="${accent}" opacity="0.55"/>
    <circle cx="${200 + r(4) * 700}" cy="${600 + r(5) * 500}" r="${150 + r(6) * 200}" fill="#ffffff" opacity="0.18"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

/**
 * @param refs gambar referensi desain dari owner (JPEG kecil) — dikirim ke AI image sebagai contoh gaya.
 */
export async function sourceImage(w: WorkspaceRepo, brand: Brand, req: ImageRequest, key: string, seed = 0, refs: Buffer[] = []): Promise<SlideImage | null> {
  const base = { query: req.query, prompt: req.prompt, credit: "" };
  const mode = brand.imageSource;
  if (mode === "none") return null;

  const asset = brand.assets.find((a) => a.id === req.assetId);
  if (asset) return { ...base, url: asset.url, source: "brand" };
  if (mode === "brand") return null;

  // Mode demo tanpa API gambar: pakai foto brand bergantian.
  if (!config.hasAI && !config.imageProvider && brand.assets.length) return { ...base, url: brand.assets[seed % brand.assets.length].url, source: "brand" };

  // AI image boleh jalan walau ANTHROPIC_API_KEY belum diisi (kunci gambar terpisah).
  if ((mode === "auto" || mode === "ai") && config.imageProvider && (req.prompt || req.query)) {
    try {
      const out = await generateImage(aiPrompt(brand, req), refs);
      if (out.notes) console.warn("AI image memakai cadangan:", out.notes);
      return { ...base, url: await store(w, out.data, key), source: "ai" };
    } catch (e) {
      console.error("AI image gagal, coba stok foto:", e);
    }
  }
  if ((mode === "auto" || mode === "stock" || mode === "ai") && config.hasStock && req.query) {
    try {
      const found = await searchPexels(req.query);
      if (found) return { ...base, url: await store(w, found.data, key), source: "stock", credit: found.credit };
    } catch (e) {
      console.error("Stok foto gagal:", e);
    }
  }
  if (!config.hasAI) return { ...base, url: await store(w, await demoImage(brand, seed + 1), key), source: "demo" };
  return null;
}

export async function demoImageDataUrl(brand: Brand, seed: number) {
  return `data:image/jpeg;base64,${(await demoImage(brand, seed)).toString("base64")}`;
}

export function imageSourceStatus() {
  return {
    ai: config.imageProvider,
    stock: config.hasStock,
  };
}
