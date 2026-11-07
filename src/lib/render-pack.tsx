import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { readMedia } from "./media";
import { PACK_CANVAS, PACK_DEFAULT_PAIR, PackSlide, packWantsImage, type Density, type PackAssets, type PackImg, type PackKey, type PackLogo } from "./packs";
import { pairFonts, type FontPairKey } from "./font-pairs";
import type { Brand, Slide } from "./types";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const fontFiles = new Map<string, Buffer>();
async function fontData(file: string) {
  let d = fontFiles.get(file);
  if (!d) {
    d = await fs.readFile(path.join(FONT_DIR, file));
    fontFiles.set(file, d);
  }
  return d;
}
const loadFonts = (pair: FontPairKey) => Promise.all(pairFonts(pair).map(async (f) => ({ name: f.name, data: await fontData(f.file), weight: f.weight, style: f.style })));

const memo = new Map<string, Promise<unknown>>();
function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (!memo.has(key)) {
    if (memo.size > 120) memo.clear();
    memo.set(key, fn().catch((e) => {
      memo.delete(key);
      throw e;
    }));
  }
  return memo.get(key) as Promise<T>;
}

/** Noise acak (deterministik) sebagai PNG RGBA. */
function noise(w: number, h: number, seed: number, alphaMax: number, light = false) {
  const buf = Buffer.alloc(w * h * 4);
  let x = seed;
  for (let i = 0; i < w * h; i++) {
    x = (x * 1664525 + 1013904223) >>> 0;
    const v = x >>> 24;
    const c = light ? (v > 128 ? 255 : 0) : 0;
    buf[i * 4] = c;
    buf[i * 4 + 1] = c;
    buf[i * 4 + 2] = c;
    buf[i * 4 + 3] = Math.round((v / 255) * alphaMax);
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 4 } });
}

const toUrl = (buf: Buffer, mime: string) => `data:${mime};base64,${buf.toString("base64")}`;

function packAssets(): Promise<PackAssets> {
  return once("pack-assets", async () => {
    const grain = await noise(540, 675, 7, 46, true).png().toBuffer();
    // Kertas: krem + serat halus + vignette tipis
    const fiber = await noise(1080, 1350, 13, 22).png().toBuffer();
    const vignette = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><defs><radialGradient id="g" cx="50%" cy="45%" r="75%"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#5a4320" stop-opacity="0.22"/></radialGradient></defs><rect width="1080" height="1350" fill="url(#g)"/></svg>`,
    );
    const paper = await sharp({ create: { width: 1080, height: 1350, channels: 3, background: "#EFE6D6" } })
      .composite([{ input: fiber }, { input: vignette }])
      .jpeg({ quality: 82 })
      .toBuffer();
    return { grain: toUrl(grain, "image/png"), paper: toUrl(paper, "image/jpeg") };
  });
}

function hex(h: string) {
  const n = parseInt(h.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Foto 4:5 (crop terbaik) + versi duotone warna brand. */
function packImage(url: string, tint: string): Promise<PackImg | null> {
  return once(`pimg:${url}:${tint}`, async () => {
    try {
      const base = sharp(await readMedia(url)).rotate().resize(PACK_CANVAS.width, PACK_CANVAS.height, { fit: "cover", position: sharp.strategy.attention });
      const color = await base.clone().jpeg({ quality: 86 }).toBuffer();
      const duo = await sharp(color).grayscale().normalise().linear(1.12, -8).tint(hex(tint)).jpeg({ quality: 86 }).toBuffer();
      return { src: toUrl(color, "image/jpeg"), duo: toUrl(duo, "image/jpeg"), w: PACK_CANVAS.width, h: PACK_CANVAS.height };
    } catch (e) {
      console.error("Gagal memuat foto pack:", e);
      return null;
    }
  });
}

function packLogo(url: string | null): Promise<PackLogo> {
  if (!url) return Promise.resolve(null);
  return once(`plogo:${url}`, async () => {
    try {
      const png = await sharp(await readMedia(url)).resize({ height: 120, fit: "inside" }).png().toBuffer();
      const m = await sharp(png).metadata();
      return { src: toUrl(png, "image/png"), width: m.width ?? 120, height: m.height ?? 120 };
    } catch {
      return null;
    }
  });
}

export async function renderPackPng(brand: Brand, slides: Slide[], index: number, pack: PackKey, opts: { pair?: FontPairKey | null; density?: Density } = {}) {
  const pair = opts.pair ?? PACK_DEFAULT_PAIR[pack];
  const density = opts.density ?? "visual";
  const slide = slides[index];
  if (!slide) throw new Error("Slide tidak ditemukan");
  const url = packWantsImage(pack, slide.layout) ? slide.image?.url : undefined;
  const [fonts, assets, img, logo] = await Promise.all([loadFonts(pair), packAssets(), url ? packImage(url, brand.colors.primary) : null, packLogo(brand.logoUrl)]);
  const res = new ImageResponse(<PackSlide pack={pack} pair={pair} density={density} brand={brand} slide={slide} index={index} total={slides.length} img={img} logo={logo} assets={assets} />, { ...PACK_CANVAS, fonts });
  return Buffer.from(await res.arrayBuffer());
}
