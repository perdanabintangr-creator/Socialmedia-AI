import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { CANVAS, SlideView, type LogoImg } from "./templates";
import { LOCAL_MEDIA } from "./db";
import { config } from "./config";
import type { Brand, FontKey, Post } from "./types";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const fontCache = new Map<string, Buffer>();

async function font(key: FontKey, weight: 500 | 700 | 800) {
  const file = `${key}-latin-${weight}-normal.woff`;
  let data = fontCache.get(file);
  if (!data) {
    data = await fs.readFile(path.join(FONT_DIR, file));
    fontCache.set(file, data);
  }
  return data;
}

async function loadFonts(brand: Brand) {
  return [
    { name: "Heading", data: await font(brand.headingFont, 700), weight: 700 as const, style: "normal" as const },
    { name: "Heading", data: await font(brand.headingFont, 800), weight: 800 as const, style: "normal" as const },
    { name: "Body", data: await font(brand.bodyFont, 500), weight: 500 as const, style: "normal" as const },
    { name: "Body", data: await font(brand.bodyFont, 700), weight: 700 as const, style: "normal" as const },
  ];
}

const logoCache = new Map<string, LogoImg | null>();

async function loadLogo(url: string | null): Promise<LogoImg | null> {
  if (!url) return null;
  if (logoCache.has(url)) return logoCache.get(url)!;
  try {
    let buf: Buffer;
    const localPrefix = `${config.appUrl}/api/media/`;
    if (url.startsWith(localPrefix)) {
      buf = await fs.readFile(path.join(LOCAL_MEDIA, url.slice(localPrefix.length)));
    } else {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`logo ${res.status}`);
      buf = Buffer.from(await res.arrayBuffer());
    }
    // Normalisasi ke PNG (satori paling aman dengan PNG), tinggi 72px @2x.
    const png = await sharp(buf).resize({ height: 144, withoutEnlargement: false }).png().toBuffer();
    const meta = await sharp(png).metadata();
    const height = 72;
    const width = Math.round(((meta.width ?? 144) / (meta.height ?? 144)) * height);
    const logo = { src: `data:image/png;base64,${png.toString("base64")}`, width: Math.min(width, 420), height };
    logoCache.set(url, logo);
    return logo;
  } catch (e) {
    console.error("Gagal memuat logo:", e);
    logoCache.set(url, null);
    return null;
  }
}

/** Render satu slide jadi PNG. */
export async function renderSlidePng(brand: Brand, post: Pick<Post, "slides" | "template">, index: number) {
  const slide = post.slides[index];
  if (!slide) throw new Error("Slide tidak ditemukan");
  const [fonts, onDark, onLight] = await Promise.all([
    loadFonts(brand),
    loadLogo(brand.logoUrl),
    loadLogo(brand.logoAltUrl),
  ]);
  const img = new ImageResponse(
    <SlideView
      brand={brand}
      slide={slide}
      template={post.template}
      index={index}
      total={post.slides.length}
      logos={{ onDark, onLight }}
    />,
    { ...CANVAS, fonts },
  );
  return Buffer.from(await img.arrayBuffer());
}

/** Render semua slide jadi JPEG (Instagram & TikTok photo hanya menerima JPEG/WebP). */
export async function renderSlidesJpeg(brand: Brand, post: Pick<Post, "slides" | "template">) {
  const out: Buffer[] = [];
  for (let i = 0; i < post.slides.length; i++) {
    const png = await renderSlidePng(brand, post, i);
    out.push(await sharp(png).flatten({ background: "#ffffff" }).jpeg({ quality: 92, mozjpeg: true }).toBuffer());
  }
  return out;
}
