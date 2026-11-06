import "server-only";
import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { config } from "./config";
import { generateImage, redact } from "./image-gen";
import { recordImage } from "./cost";
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

/** Arahan komposisi khusus per cover bergaya (supaya foto pas dengan tata letak teksnya). */
const COVER_DIRECTION: Record<string, string> = {
  news_cover:
    "Photojournalism style news photo, realistic documentary moment, main subject large and centered in the upper half, eye-level, natural light, slightly gritty authentic feel like a press photo. Bottom area can be darker/simpler because a headline will be placed there.",
  folk_cover:
    "Documentary photo, wide landscape-style framing (subject centered, will be cropped to a wide banner), aerial/drone or wide establishing shot when it suits the topic, natural colors, informative like a news agency photo.",
  editorial_cover:
    "High-end magazine cover photography: extreme close-up portrait or hero product, perfectly lit soft beauty light, flawless natural skin texture, clean pastel or sky background, symmetrical composition, face/product in the middle, empty space at the bottom third for a title.",
  creative_cover:
    "Surreal glossy 3D render: oversized shiny object or product floating in a bright blue sky with soft fluffy clouds, plastic/glass material, saturated colors, studio lighting, playful viral AI-art look. Keep the top third mostly clear sky for a big title.",
};

function aiPrompt(brand: Brand, req: ImageRequest) {
  const promo = req.layout === "promo_hero";
  // Teaser punya arahan key visual sendiri (gelap & misterius): jangan ditimpa arahan cover gaya.
  const cover = req.layout && !/teaser key visual/i.test(req.prompt) ? COVER_DIRECTION[req.layout] : undefined;
  return [
    req.prompt || req.query,
    promo
      ? `Advertising key visual: the subject stands/poses in the lower two thirds, waist-up, on a plain seamless solid ${brand.colors.primary} background (exact same flat color edge to edge, no gradient, no props behind), clean studio lighting, crisp edges like a cut-out. Keep the top third empty.`
      : "",
    cover ?? "",
    `Art direction: ${brand.imageStyle}`,
    `Color grading must match the brand palette: dominant tones close to ${brand.colors.primary} and ${brand.colors.secondary}, small accents of ${brand.colors.accent} (wardrobe, props, lighting, background). Avoid colors that clash with this palette.`,
    cover ? "High-end editorial quality, sharp focus, realistic details." : "Vertical 4:5 composition, high-end social media agency quality, magazine-grade lighting.",
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

/**
 * @param refs gambar referensi desain dari owner (JPEG kecil) — dikirim ke AI image sebagai contoh gaya.
 */
export async function sourceImage(w: WorkspaceRepo, brand: Brand, req: ImageRequest, key: string, refs: Buffer[] = []): Promise<SlideImage | null> {
  const base = { query: req.query, prompt: req.prompt, credit: "" };
  const mode = brand.imageSource;
  if (mode === "none") return null;

  const asset = brand.assets.find((a) => a.id === req.assetId);
  if (asset) return { ...base, url: asset.url, source: "brand" };
  if (mode === "brand") return null;

  // AI image boleh jalan walau ANTHROPIC_API_KEY belum diisi (kunci gambar terpisah).
  if ((mode === "auto" || mode === "ai") && config.imageProvider && (req.prompt || req.query)) {
    try {
      const out = await generateImage(aiPrompt(brand, req), refs);
      if (out.notes) console.warn("AI image memakai cadangan:", out.notes);
      recordImage(out.provider, out.model, out.costUsd);
      return { ...base, url: await store(w, out.data, key), source: "ai" };
    } catch (e) {
      console.error("AI image gagal, coba stok foto:", redact(e instanceof Error ? e.message : String(e)));
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
  return null;
}

/** Foto contoh (Unsplash) untuk galeri pratinjau layout di Brand Kit — bukan untuk konten. */
export async function samplePhotoDataUrl(seed: number) {
  const file = path.join(process.cwd(), "public", "samples", `${(Math.abs(seed) % 6) + 1}.jpg`);
  return `data:image/jpeg;base64,${(await readFile(file)).toString("base64")}`;
}

export function imageSourceStatus() {
  return {
    ai: config.imageProvider,
    stock: config.hasStock,
  };
}
