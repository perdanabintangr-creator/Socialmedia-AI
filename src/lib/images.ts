import "server-only";
import sharp from "sharp";
import { config } from "./config";
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
}

const NO_TEXT = "No text, no letters, no words, no logos, no watermark.";

function aiPrompt(brand: Brand, req: ImageRequest) {
  return [
    req.prompt || req.query,
    `Art direction: ${brand.imageStyle}`,
    `Subtle color harmony with brand colors ${brand.colors.primary}, ${brand.colors.secondary} and ${brand.colors.accent}.`,
    "Vertical 4:5 composition, high-end social media agency quality, magazine-grade lighting.",
    NO_TEXT,
  ].join(" ");
}

async function generateOpenAI(prompt: string): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      prompt,
      size: "1024x1536",
      quality: process.env.OPENAI_IMAGE_QUALITY || "medium",
      n: 1,
    }),
  });
  const json = (await res.json().catch(() => null)) as { data?: { b64_json?: string }[]; error?: { message?: string } } | null;
  const b64 = json?.data?.[0]?.b64_json;
  if (!res.ok || !b64) throw new Error(`OpenAI image: ${json?.error?.message ?? res.status}`);
  return Buffer.from(b64, "base64");
}

async function generateGemini(prompt: string): Promise<Buffer> {
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "4:5" } },
    }),
  });
  type Part = { inlineData?: { data?: string }; inline_data?: { data?: string } };
  const json = (await res.json().catch(() => null)) as { candidates?: { content?: { parts?: Part[] } }[]; error?: { message?: string } } | null;
  const part = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data || p.inline_data?.data);
  const b64 = part?.inlineData?.data ?? part?.inline_data?.data;
  if (!res.ok || !b64) throw new Error(`Gemini image: ${json?.error?.message ?? res.status}`);
  return Buffer.from(b64, "base64");
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

export async function sourceImage(w: WorkspaceRepo, brand: Brand, req: ImageRequest, key: string, seed = 0): Promise<SlideImage | null> {
  const base = { query: req.query, prompt: req.prompt, credit: "" };
  const mode = brand.imageSource;
  if (mode === "none") return null;

  const asset = brand.assets.find((a) => a.id === req.assetId);
  if (asset) return { ...base, url: asset.url, source: "brand" };
  if (mode === "brand") return null;

  if (!config.hasAI) {
    // Mode demo: pakai foto brand bergantian, kalau tidak ada pakai gambar abstrak.
    if (brand.assets.length) return { ...base, url: brand.assets[seed % brand.assets.length].url, source: "brand" };
    return { ...base, url: await store(w, await demoImage(brand, seed + 1), key), source: "demo" };
  }

  if ((mode === "auto" || mode === "ai") && config.imageProvider && (req.prompt || req.query)) {
    try {
      const prompt = aiPrompt(brand, req);
      const data = config.imageProvider === "gemini" ? await generateGemini(prompt) : await generateOpenAI(prompt);
      return { ...base, url: await store(w, data, key), source: "ai" };
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
