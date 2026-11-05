import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { CANVAS, IMAGE_BOX, SlideView, effectiveLayout, type Img, type LogoImg } from "./templates";
import { readMedia } from "./media";
import { FONT_OPTIONS, styledBrand, type Brand, type FontKey, type Post, type PostReference, type Slide } from "./types";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const fontCache = new Map<string, Buffer>();

/** Ambil file font dengan ketebalan terdekat yang tersedia (font display hanya punya satu ketebalan). */
async function font(key: FontKey, wanted: 500 | 700 | 800) {
  const opt = FONT_OPTIONS[key] ?? FONT_OPTIONS["plus-jakarta-sans"];
  const weight = [...opt.weights].sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted))[0];
  const file = `${opt === FONT_OPTIONS[key] ? key : "plus-jakarta-sans"}-latin-${weight}-normal.woff`;
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

// Cache kecil di memori (logo & foto yang sudah dipotong).
const cache = new Map<string, Promise<LogoImg | Img | null>>();
function cached<T extends LogoImg | Img | null>(key: string, fn: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) {
    if (cache.size > 200) cache.clear();
    cache.set(key, fn());
  }
  return cache.get(key) as Promise<T>;
}

function loadLogo(url: string | null): Promise<LogoImg | null> {
  if (!url) return Promise.resolve(null);
  return cached(`logo:${url}`, async () => {
    try {
      const png = await sharp(await readMedia(url)).resize({ height: 144 }).png().toBuffer();
      const meta = await sharp(png).metadata();
      const height = 68;
      const width = Math.round(((meta.width ?? 144) / (meta.height ?? 144)) * height);
      return { src: `data:image/png;base64,${png.toString("base64")}`, width: Math.min(width, 400), height };
    } catch (e) {
      console.error("Gagal memuat logo:", e);
      return null;
    }
  });
}

/** Potong foto pas ke kotak layout (cover crop, fokus ke bagian paling menarik). */
function loadSlideImage(slide: Slide): Promise<Img | null> {
  const box = IMAGE_BOX[slide.layout];
  const url = slide.image?.url;
  if (!box || !url) return Promise.resolve(null);
  return cached(`img:${url}:${box.w}x${box.h}`, async () => {
    try {
      const jpg = await sharp(await readMedia(url))
        .rotate()
        .resize(box.w, box.h, { fit: "cover", position: sharp.strategy.attention })
        .jpeg({ quality: 88 })
        .toBuffer();
      return { src: `data:image/jpeg;base64,${jpg.toString("base64")}`, w: box.w, h: box.h };
    } catch (e) {
      console.error("Gagal memuat gambar slide:", e);
      return null;
    }
  });
}

type Renderable = Pick<Post, "slides" | "template"> & { reference?: PostReference | null };

/** Render satu slide jadi PNG. Warna/font mengikuti referensi desain konten bila ada. */
export async function renderSlidePng(baseBrand: Brand, post: Renderable, index: number) {
  const brand = styledBrand(baseBrand, post.reference);
  const slide = post.slides[index];
  if (!slide) throw new Error("Slide tidak ditemukan");
  const [fonts, onDark, onLight, img] = await Promise.all([
    loadFonts(brand),
    loadLogo(brand.logoUrl),
    loadLogo(brand.logoAltUrl),
    loadSlideImage(slide),
  ]);
  const res = new ImageResponse(
    <SlideView
      brand={brand}
      slide={slide}
      template={post.template}
      index={index}
      total={post.slides.length}
      logos={{ onDark, onLight }}
      img={img && effectiveLayout(slide.layout, true) === slide.layout ? img : null}
    />,
    { ...CANVAS, fonts },
  );
  return Buffer.from(await res.arrayBuffer());
}

/** Render semua slide jadi JPEG (Instagram & TikTok photo hanya menerima JPEG/WebP). */
export async function renderSlidesJpeg(brand: Brand, post: Renderable) {
  const out: Buffer[] = [];
  for (let i = 0; i < post.slides.length; i++) {
    const png = await renderSlidePng(brand, post, i);
    out.push(await sharp(png).flatten({ background: "#ffffff" }).jpeg({ quality: 92, mozjpeg: true }).toBuffer());
  }
  return out;
}
