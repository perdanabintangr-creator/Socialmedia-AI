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

async function rawFont(file: string) {
  let data = fontCache.get(file);
  if (!data) {
    data = await fs.readFile(path.join(FONT_DIR, file));
    fontCache.set(file, data);
  }
  return data;
}

async function loadFonts(brand: Brand) {
  return [
    // Aksen gaya: serif italic (Editorial) & tulisan tangan (Kreatif 3D)
    { name: "Serif", data: await rawFont("dm-serif-display-latin-400-italic.woff"), weight: 400 as const, style: "italic" as const },
    { name: "Script", data: await rawFont("caveat-latin-700-normal.woff"), weight: 700 as const, style: "normal" as const },
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

function loadLogo(url: string | null, big = 0): Promise<LogoImg | null> {
  if (!url) return Promise.resolve(null);
  return cached(`logo:${url}:${big}`, async () => {
    try {
      // Logo besar (teaser): potong ruang kosong di sekelilingnya supaya tampil penuh.
      const src = big ? await sharp(await readMedia(url)).trim().toBuffer().catch(async () => readMedia(url)) : await readMedia(url);
      const png = await sharp(src).resize({ height: big || 144, width: big || undefined, fit: "inside" }).png().toBuffer();
      const meta = await sharp(png).metadata();
      if (big) {
        // Logo "ubin" (sudut tidak transparan & hampir persegi) tampil langsung tanpa ubin putih.
        const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const at = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3];
        const inset = Math.round(info.width * 0.12);
        const edgesOpaque = [at(inset, Math.round(info.height / 2)), at(info.width - inset, Math.round(info.height / 2)), at(Math.round(info.width / 2), inset), at(Math.round(info.width / 2), info.height - inset)].every((a) => a > 200);
        const square = Math.abs(info.width - info.height) / Math.max(info.width, info.height) < 0.12;
        return { src: `data:image/png;base64,${png.toString("base64")}`, width: meta.width ?? big, height: meta.height ?? big, solid: edgesOpaque && square };
      }
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
  const [fonts, onDark, onLight, img, big] = await Promise.all([
    loadFonts(brand),
    loadLogo(brand.logoUrl),
    loadLogo(brand.logoAltUrl),
    loadSlideImage(slide),
    slide.layout === "logo_reveal" ? loadLogo(brand.logoAltUrl ?? brand.logoUrl, 560) : Promise.resolve(null),
  ]);
  const res = new ImageResponse(
    <SlideView
      brand={brand}
      slide={slide}
      template={post.template}
      index={index}
      total={post.slides.length}
      logos={{ onDark, onLight, big }}
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

// ---------------------------------------------------------------- Story 9:16

export const STORY = { width: 1080, height: 1920 };

const relLum = (hex: string) => {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
const inkOn = (hex: string) => (relLum(hex) > 0.45 ? "#14161F" : "#FFFFFF");

export interface StoryOptions {
  sticker?: string; // label kecil di atas slide, mis. "Postingan baru"
  cta?: string; // ajakan di bawah, mis. "Cek di feed kami"
}

/**
 * Versi Story 9:16 dari satu slide: slide utuh di tengah (tidak ada teks yang terpotong),
 * latar = slide yang di-blur & digelapkan, logo di atas, stiker & ajakan di bawah.
 * Area atas ±200 px dan bawah ±250 px dibiarkan aman dari tombol bawaan Instagram.
 */
const storyCache = new Map<string, Promise<Buffer>>();

export function renderStoryPng(baseBrand: Brand, post: Renderable & { id?: string; updated_at?: string }, index: number, opts: StoryOptions = {}) {
  const key = JSON.stringify([post.id, post.updated_at, index, opts, baseBrand.logoUrl, baseBrand.colors, baseBrand.headingFont, baseBrand.handle, post.reference?.colors ?? null]);
  if (!post.id || !post.updated_at) return renderStoryUncached(baseBrand, post, index, opts);
  let hit = storyCache.get(key);
  if (!hit) {
    if (storyCache.size > 40) storyCache.delete(storyCache.keys().next().value!);
    hit = renderStoryUncached(baseBrand, post, index, opts);
    hit.catch(() => storyCache.delete(key));
    storyCache.set(key, hit);
  }
  return hit;
}

async function renderStoryUncached(baseBrand: Brand, post: Renderable, index: number, opts: StoryOptions = {}) {
  const brand = styledBrand(baseBrand, post.reference);
  const slidePng = await renderSlidePng(baseBrand, post, index);
  const W = 920;
  const H = Math.round((W * 1350) / 1080);
  const [card, bg, fonts, logo] = await Promise.all([
    sharp(slidePng).resize(W, H).jpeg({ quality: 92 }).toBuffer(),
    // Blur murah: kecilkan dulu, blur, lalu besarkan lagi (hasil sama halusnya, jauh lebih cepat).
    sharp(await sharp(slidePng).resize(108, 192, { fit: "cover" }).blur(3).modulate({ brightness: 0.62, saturation: 1.15 }).png().toBuffer())
      .resize(STORY.width, STORY.height, { kernel: "cubic" })
      .jpeg({ quality: 78 })
      .toBuffer(),
    loadFonts(brand),
    loadLogo(brand.logoUrl ?? brand.logoAltUrl),
  ]);
  const accent = brand.colors.accent;
  const sticker = opts.sticker ?? (post.slides.length > 1 ? "Carousel baru" : "Postingan baru");
  const cta = opts.cta ?? "Cek di feed kami";
  const top = 250;

  const res = new ImageResponse(
    (
      <div style={{ width: STORY.width, height: STORY.height, display: "flex", position: "relative", fontFamily: "Body", color: "#FFFFFF" }}>
        <img src={`data:image/jpeg;base64,${bg.toString("base64")}`} width={STORY.width} height={STORY.height} style={{ position: "absolute", left: 0, top: 0 }} />
        {/* header brand: logo utama dirancang untuk latar gelap */}
        <div style={{ position: "absolute", left: 80, right: 80, top: 120, display: "flex", alignItems: "center", gap: 18 }}>
          {logo ? (
            <img src={logo.src} width={logo.width} height={logo.height} />
          ) : (
            <div style={{ fontFamily: "Heading", fontWeight: 800, fontSize: 40 }}>{brand.name}</div>
          )}
          {brand.handle ? <div style={{ fontSize: 30, fontWeight: 700, opacity: 0.85 }}>{brand.handle}</div> : null}
        </div>
        {/* slide */}
        <div style={{ position: "absolute", left: (STORY.width - W) / 2, top, width: W, height: H, display: "flex", borderRadius: 36, overflow: "hidden", boxShadow: "0 40px 90px rgba(0,0,0,0.45)" }}>
          <img src={`data:image/jpeg;base64,${card.toString("base64")}`} width={W} height={H} />
        </div>
        {/* stiker */}
        <div style={{ position: "absolute", left: 80, top: top - 34, display: "flex", transform: "rotate(-4deg)" }}>
          <div style={{ background: accent, color: inkOn(accent), fontFamily: "Heading", fontWeight: 800, fontSize: 34, padding: "14px 30px", borderRadius: 9999, textTransform: "uppercase", letterSpacing: 1.5, boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}>
            {sticker}
          </div>
        </div>
        {/* ajakan */}
        <div style={{ position: "absolute", left: 0, right: 0, top: top + H + 70, display: "flex", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#FFFFFF", color: "#14161F", fontSize: 38, fontWeight: 800, padding: "22px 44px", borderRadius: 9999, boxShadow: "0 16px 40px rgba(0,0,0,0.3)" }}>
            {cta}
            <div style={{ display: "flex", width: 46, height: 46, borderRadius: 9999, background: accent, color: inkOn(accent), alignItems: "center", justifyContent: "center", fontSize: 30 }}>›</div>
          </div>
        </div>
      </div>
    ),
    { ...STORY, fonts },
  );
  return Buffer.from(await res.arrayBuffer());
}

export async function renderStoryJpeg(brand: Brand, post: Renderable & { id?: string; updated_at?: string }, index: number, opts: StoryOptions = {}) {
  return sharp(await renderStoryPng(brand, post, index, opts)).flatten({ background: "#000000" }).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
}
