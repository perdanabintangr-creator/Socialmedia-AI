/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */
import type React from "react";
import type { Brand, Slide, SlideLayout } from "./types";
import { FONT_PAIRS, type FontPair, type FontPairKey } from "./font-pairs";

/**
 * Design Pack: sistem komposisi ala desainer sosmed (bukan sekadar ganti warna).
 * Setiap pack punya bahasa visual sendiri — tipografi, grid, tekstur, ornamen — dan
 * beberapa varian komposisi per jenis slide yang dipilih bergantian supaya tidak ada
 * dua slide yang terasa sama.
 */

export const PACKS = {
  editorial: { label: "Editorial Magazine", desc: "Serif besar ala majalah, foto full-bleed, garis tipis, nuansa premium." },
  poster: { label: "Bold Poster", desc: "Tipografi raksasa kapital, foto duotone, stiker & pita teks — berani, viral." },
  scrapbook: { label: "Scrapbook", desc: "Kertas bertekstur, foto polaroid + selotip, catatan tulisan tangan — hangat & personal." },
} as const;
export type PackKey = keyof typeof PACKS;
export const PACK_KEYS = Object.keys(PACKS) as PackKey[];

export const PACK_CANVAS = { width: 1080, height: 1350 };
const W = PACK_CANVAS.width;
const H = PACK_CANVAS.height;

export type PackImg = { src: string; duo: string; w: number; h: number };
export type PackLogo = { src: string; width: number; height: number } | null;
export type PackAssets = { grain: string; paper: string };

export const DENSITIES = {
  visual: { label: "Visual", desc: "Judul pendek saja, foto dominan, detail di caption." },
  seimbang: { label: "Seimbang", desc: "Judul + 1 kalimat pendek per slide." },
  edukatif: { label: "Edukatif", desc: "Lebih banyak penjelasan (tips, tutorial)." },
} as const;
export type Density = keyof typeof DENSITIES;

/** Pasangan huruf bawaan tiap pack (dipakai bila customer/AI belum memilih). */
export const PACK_DEFAULT_PAIR: Record<PackKey, FontPairKey> = { editorial: "majalah", poster: "poster", scrapbook: "grotesk" };

export interface PackProps {
  pack: PackKey;
  pair: FontPairKey;
  density: Density;
  brand: Brand;
  slide: Slide;
  index: number;
  total: number;
  img: PackImg | null;
  logo: PackLogo;
  assets: PackAssets;
}

type Role = "cover" | "point" | "list" | "compare" | "stat" | "quote" | "cta";
export function roleOf(layout: SlideLayout): Role {
  if (layout.includes("cover") || layout === "promo_hero" || layout === "logo_reveal") return "cover";
  if (layout === "point_photo" || layout === "point_icon") return "point";
  if (layout === "list" || layout === "steps") return "list";
  if (layout === "compare") return "compare";
  if (layout === "stat" || layout === "promo_offer") return "stat";
  if (layout === "quote") return "quote";
  return "cta";
}

// ---------------------------------------------------------------- util

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;
const clean = (s: string) => (s || "").replace(/[→➡⇒]/g, "›").replace(EMOJI, "").trim();
const plain = (s: string) => clean(s).replace(/\*/g, "");

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lum(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function rgba(hex: string, a: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
const onColor = (bg: string) => (lum(bg) > 0.42 ? "#111111" : "#FFFFFF");

/** Ukuran huruf yang muat: makin panjang teks makin kecil. */
function fit(text: string, max: number, min: number, ideal: number) {
  const len = Math.max(plain(text).length, 1);
  return len <= ideal ? max : Math.max(min, Math.round(max * Math.sqrt(ideal / len)));
}

type Hl = (word: string) => React.CSSProperties;

/** Teks per kata dengan dukungan *highlight* (gaya highlight ditentukan pack). */
function Words({ text, size: base, style, hl, align = "left", upper = false, gap = 0.26, k = 1 }: { text: string; size: number; style: React.CSSProperties; hl?: Hl; align?: "left" | "center" | "right"; upper?: boolean; gap?: number; k?: number }) {
  const size = Math.round(base * k);
  const words: { w: string; on: boolean }[] = [];
  clean(text)
    .split(/(\*[^*]+\*)/)
    .filter(Boolean)
    .forEach((seg) => {
      const on = seg.startsWith("*") && seg.endsWith("*") && seg.length > 2;
      seg
        .replace(/\*/g, "")
        .split(/\s+/)
        .filter(Boolean)
        .forEach((w) => {
          if (/^[.,!?:;)%]+$/.test(w) && words.length) words[words.length - 1].w += w;
          else words.push({ w: upper ? w.toUpperCase() : w, on });
        });
    });
  return (
    <div style={{ display: "flex", flexWrap: "wrap", width: "100%", fontSize: size, justifyContent: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start", ...style }}>
      {words.map((x, i) => (
        <span key={i} style={{ marginRight: size * gap, ...(x.on && hl ? hl(x.w) : {}) }}>
          {x.w}
        </span>
      ))}
    </div>
  );
}

function Para({ text, size, color, family = "Body", weight = 500, mt = 0, width, align = "left", lh = 1.38 }: { text: string; size: number; color: string; family?: string; weight?: number; mt?: number; width?: number; align?: "left" | "center" | "right"; lh?: number }) {
  if (!plain(text)) return null;
  return <div style={{ display: "flex", fontFamily: family, fontSize: size, fontWeight: weight, color, marginTop: mt, lineHeight: lh, textAlign: align, ...(width ? { width } : {}) }}>{plain(text)}</div>;
}

/** Posisi absolut. Satori tidak meregangkan left+right / top+bottom, jadi lebar & tinggi dihitung eksplisit. */
const Abs = (style: React.CSSProperties) => {
  const s: React.CSSProperties = { position: "absolute", display: "flex", ...style };
  if (typeof s.left === "number" && typeof s.right === "number" && s.width === undefined) {
    s.width = W - s.left - s.right;
    delete s.right;
  }
  if (typeof s.right === "number" && typeof s.width === "number" && s.left === undefined) {
    s.left = W - s.right - s.width;
    delete s.right;
  }
  if (typeof s.top === "number" && typeof s.bottom === "number" && s.height === undefined) {
    s.height = H - s.top - s.bottom;
    delete s.bottom;
  }
  return s;
};
const two = (n: number) => String(n).padStart(2, "0");

function Arrow({ size = 40, color, stroke = 3 }: { size?: number; color: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** Faktor ukuran judul: font lebar dikecilkan, font sempit dibesarkan (dibatasi). */
function scaleK(pair: FontPairKey, designedWf: number) {
  const wf: number = (FONT_PAIRS[pair] as FontPair).wf;
  return Math.max(0.62, Math.min(1.2, designedWf / wf));
}

// ================================================================= EDITORIAL

function edPalette(brand: Brand) {
  const bgLight = lum(brand.colors.background) > 0.7 ? brand.colors.background : "#F2EDE4";
  const accent = lum(brand.colors.primary) < 0.4 ? brand.colors.primary : "#1A1A1A";
  return { paper: bgLight, ink: "#141210", accent, muted: "#5F5A53" };
}
const edHl = (color: string): Hl => () => ({ fontFamily: "HeadI", fontStyle: "italic", color });

function EdChrome({ brand, index, total, dark, logo }: { brand: Brand; index: number; total: number; dark: boolean; logo: PackLogo }) {
  const fg = dark ? "#FFFFFF" : "#141210";
  return (
    <>
      <div style={Abs({ left: 72, right: 72, top: 60, justifyContent: "space-between", alignItems: "center" })}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {logo ? <img src={logo.src} width={Math.round((logo.width / logo.height) * 44)} height={44} /> : null}
          <div style={{ display: "flex", fontFamily: "Head", fontSize: 40, color: fg, letterSpacing: -0.5 }}>{brand.name}</div>
        </div>
        <div style={{ display: "flex", fontFamily: "Body", fontWeight: 500, fontSize: 22, letterSpacing: 4, color: fg, opacity: 0.7 }}>{total > 1 ? `${two(index + 1)} — ${two(total)}` : "ISSUE"}</div>
      </div>
      <div style={Abs({ left: 72, right: 72, top: 128, height: 1.5, background: dark ? rgba("#FFFFFF", 0.35) : rgba("#141210", 0.25) })} />
      <div style={Abs({ left: 72, right: 72, bottom: 54, justifyContent: "space-between", fontFamily: "Body", fontWeight: 500, fontSize: 21, letterSpacing: 3.5, color: fg, opacity: 0.65 })}>
        <div style={{ display: "flex" }}>{brand.handle.toUpperCase()}</div>
        <div style={{ display: "flex" }}>{index < total - 1 && total > 1 ? "GESER →" : (brand.website || "").toUpperCase()}</div>
      </div>
    </>
  );
}

function Editorial({ brand, slide: s, index, total, img, logo, assets, pair, density }: PackProps) {
  const k = scaleK(pair, 0.4);
  const vis = density === "visual";
  const sub = (t: string) => (vis ? "" : t); // mode Visual: penjelasan pindah ke caption
  const p = edPalette(brand);
  const role = roleOf(s.layout);
  const month = new Intl.DateTimeFormat("id-ID", { month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date()).toUpperCase();
  const grain = <img src={assets.grain} width={W} height={H} style={{ position: "absolute", left: 0, top: 0, opacity: 0.35 }} />;

  if (role === "cover") {
    const hs = fit(s.headline, 136, 84, 26);
    return (
      <Frame bg={p.ink}>
        {img ? <img src={img.src} width={W} height={H} style={{ position: "absolute", left: 0, top: 0, objectFit: "cover", objectPosition: "50% 50%" }} /> : null}
        <div style={Abs({ left: 0, top: 0, width: W, height: H, backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 46%, rgba(0,0,0,0.78) 78%, rgba(0,0,0,0.92) 100%)` })} />
        {grain}
        {/* masthead */}
        <div style={Abs({ left: 64, right: 64, top: 52, flexDirection: "column" })}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Body", fontWeight: 500, fontSize: 21, letterSpacing: 4, color: "rgba(255,255,255,0.8)" }}>
            <span>{`EDISI ${two(new Date().getDate())}`}</span>
            <span>{month}</span>
            <span>{brand.handle.toUpperCase()}</span>
          </div>
          <div style={{ display: "flex", height: 1.5, background: "rgba(255,255,255,0.5)", marginTop: 16 }} />
          <div style={{ display: "flex", fontFamily: "Head", fontSize: Math.min(176, Math.round(940 / Math.max(plain(brand.name).length * 0.5, 3))), color: "#FFFFFF", letterSpacing: -4, lineHeight: 1, marginTop: 6 }}>{brand.name}</div>
        </div>
        <div style={Abs({ left: 64, right: 64, bottom: 70, flexDirection: "column" })}>
          {plain(s.kicker) ? (
            <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 22 }}>
              <div style={{ display: "flex", width: 56, height: 2, background: "#FFFFFF" }} />
              <div style={{ display: "flex", fontFamily: "Body", fontWeight: 700, fontSize: 24, letterSpacing: 5, color: "#FFFFFF" }}>{plain(s.kicker).toUpperCase()}</div>
            </div>
          ) : null}
          <Words k={k} text={s.headline} size={hs} style={{ fontFamily: "Head", color: "#FFFFFF", lineHeight: 0.98, letterSpacing: -hs * 0.025 }} hl={edHl("#FFFFFF")} gap={0.22} />
          <Para text={sub(s.body)} size={30} color="rgba(255,255,255,0.82)" mt={26} width={820} />
        </div>
      </Frame>
    );
  }

  if (role === "point") {
    const n = index; // slide 2 = poin 01
    const variant = index % 2;
    const hs = fit(s.headline, 76, 52, 34);
    if (img && variant === 1) {
      // Foto atas full-bleed + caption "Fig."; teks di kertas
      return (
        <Frame bg={p.paper}>
          <img src={img.src} width={W} height={vis ? 960 : 820} style={{ position: "absolute", left: 0, top: 0, objectFit: "cover", objectPosition: "50% 50%" }} />
          <div style={Abs({ left: 0, top: 0, width: W, height: 220, backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.5), rgba(0,0,0,0))" })} />
          <div style={Abs({ left: 72, top: vis ? 900 : 760, fontFamily: "Body", fontWeight: 500, fontSize: 20, letterSpacing: 3, color: "#FFFFFF", opacity: 0.9 })}>{`FIG. ${two(n)} — ${plain(s.kicker).toUpperCase()}`}</div>
          {grain}
          <div style={Abs({ left: 72, right: 72, top: vis ? 1010 : 870, alignItems: "flex-start", gap: 34 })}>
            <div style={{ display: "flex", fontFamily: "HeadI", fontStyle: "italic", fontSize: 190, lineHeight: 0.8, color: p.accent, letterSpacing: -6 }}>{two(n)}</div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingTop: 6 }}>
              <Words k={k} text={s.headline} size={hs} style={{ fontFamily: "Head", color: p.ink, lineHeight: 1.02, letterSpacing: -1 }} hl={edHl(p.accent)} gap={0.22} />
              <Para text={sub(s.body)} size={27} color={p.muted} mt={18} />
            </div>
          </div>
          <EdChrome brand={brand} index={index} total={total} dark logo={logo} />
        </Frame>
      );
    }
    if (img) {
      // Split vertikal: teks kiri, foto kanan setinggi kanvas
      return (
        <Frame bg={p.paper}>
          <img src={img.src} width={500} height={H} style={{ position: "absolute", left: W - 500, top: 0, objectFit: "cover", objectPosition: "50% 50%" }} />
          {grain}
          <div style={Abs({ left: 72, width: 440, top: 200, bottom: 120, flexDirection: "column", justifyContent: "space-between" })}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontFamily: "Body", fontWeight: 700, fontSize: 22, letterSpacing: 5, color: p.accent }}>{plain(s.kicker).toUpperCase() || `BAGIAN ${two(n)}`}</div>
              <div style={{ display: "flex", fontFamily: "HeadI", fontStyle: "italic", fontSize: 260, lineHeight: 0.85, color: p.ink, letterSpacing: -10, marginTop: 10 }}>{two(n)}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <Words k={k} text={s.headline} size={fit(s.headline, 70, 48, 30)} style={{ fontFamily: "Head", color: p.ink, lineHeight: 1.02, letterSpacing: -1 }} hl={edHl(p.accent)} gap={0.22} />
              <div style={{ display: "flex", width: 80, height: 2, background: p.ink, marginTop: 28 }} />
              <Para text={sub(s.body)} size={26} color={p.muted} mt={22} />
            </div>
          </div>
          <EdChrome brand={brand} index={index} total={total} dark={false} logo={logo} />
        </Frame>
      );
    }
    return (
      <Frame bg={p.paper}>
        {grain}
        <div style={Abs({ left: 300, top: 120, fontFamily: "HeadI", fontStyle: "italic", fontSize: 640, lineHeight: 1, color: rgba(p.accent, 0.12), letterSpacing: -30 })}>{two(n)}</div>
        <div style={Abs({ left: 72, right: 72, bottom: 160, flexDirection: "column" })}>
          <div style={{ display: "flex", fontFamily: "Body", fontWeight: 700, fontSize: 22, letterSpacing: 5, color: p.accent }}>{`${two(n)} · ${plain(s.kicker).toUpperCase()}`}</div>
          <div style={{ display: "flex", marginTop: 20 }}>
            <Words k={k} text={s.headline} size={fit(s.headline, 104, 64, 30)} style={{ fontFamily: "Head", color: p.ink, lineHeight: 1, letterSpacing: -2 }} hl={edHl(p.accent)} gap={0.22} />
          </div>
          <Para text={sub(s.body)} size={30} color={p.muted} mt={28} width={760} />
        </div>
        <EdChrome brand={brand} index={index} total={total} dark={false} logo={logo} />
      </Frame>
    );
  }

  if (role === "quote") {
    return (
      <Frame bg={p.ink}>
        {grain}
        <div style={Abs({ left: 50, top: 200, fontFamily: "HeadI", fontStyle: "italic", fontSize: 520, lineHeight: 1, color: rgba(brand.colors.accent, 0.9) })}>“</div>
        <div style={Abs({ left: 90, right: 90, top: 560, flexDirection: "column" })}>
          <Words k={k} text={s.headline} size={fit(s.headline, 98, 60, 34)} style={{ fontFamily: "Head", color: "#FFFFFF", lineHeight: 1.04, letterSpacing: -1.5 }} hl={edHl(brand.colors.accent)} gap={0.22} />
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 50 }}>
            <div style={{ display: "flex", width: 60, height: 2, background: "#FFFFFF" }} />
            <div style={{ display: "flex", fontFamily: "Body", fontWeight: 700, fontSize: 24, letterSpacing: 4, color: "#FFFFFF" }}>{(plain(s.body) || brand.name).toUpperCase()}</div>
          </div>
        </div>
        <EdChrome brand={brand} index={index} total={total} dark logo={logo} />
      </Frame>
    );
  }

  if (role === "list" || role === "compare") {
    const items = role === "compare" ? [...s.items.map((x) => `${plain(s.labelA) || "A"}: ${x}`), ...s.itemsB.map((x) => `${plain(s.labelB) || "B"}: ${x}`)] : s.items;
    return (
      <Frame bg={p.paper}>
        {grain}
        <div style={Abs({ left: 72, right: 72, top: 190, bottom: 130, flexDirection: "column" })}>
          <div style={{ display: "flex", fontFamily: "Body", fontWeight: 700, fontSize: 22, letterSpacing: 5, color: p.accent }}>{plain(s.kicker).toUpperCase() || "DAFTAR ISI"}</div>
          <div style={{ display: "flex", marginTop: 14 }}>
            <Words k={k} text={s.headline} size={fit(s.headline, 84, 56, 30)} style={{ fontFamily: "Head", color: p.ink, lineHeight: 1, letterSpacing: -1.5 }} hl={edHl(p.accent)} gap={0.22} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
            {items.slice(0, 6).map((it, i) => (
              <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 30, paddingTop: 22, paddingBottom: 22, borderTop: `1.5px solid ${rgba(p.ink, 0.22)}` }}>
                <div style={{ display: "flex", fontFamily: "HeadI", fontStyle: "italic", fontSize: 54, color: p.accent, width: 70 }}>{two(i + 1)}</div>
                <div style={{ display: "flex", flex: 1, fontFamily: "Body", fontWeight: 500, fontSize: fit(it, 34, 26, 50), color: p.ink, lineHeight: 1.3 }}>{plain(it)}</div>
              </div>
            ))}
          </div>
        </div>
        <EdChrome brand={brand} index={index} total={total} dark={false} logo={logo} />
      </Frame>
    );
  }

  if (role === "stat") {
    return (
      <Frame bg={p.paper}>
        {grain}
        <div style={Abs({ left: 72, right: 72, top: 220, bottom: 140, flexDirection: "column", justifyContent: "center" })}>
          <div style={{ display: "flex", fontFamily: "Head", fontSize: fit(s.stat, 360, 180, 4), color: p.ink, lineHeight: 0.9, letterSpacing: -12 }}>{plain(s.stat)}</div>
          <div style={{ display: "flex", width: 120, height: 3, background: p.accent, marginTop: 30, marginBottom: 30 }} />
          <Words k={k} text={s.headline} size={fit(s.headline, 70, 48, 34)} style={{ fontFamily: "Head", color: p.ink, lineHeight: 1.05 }} hl={edHl(p.accent)} gap={0.22} />
          <Para text={s.body} size={28} color={p.muted} mt={20} />
        </div>
        <EdChrome brand={brand} index={index} total={total} dark={false} logo={logo} />
      </Frame>
    );
  }

  // CTA
  return (
    <Frame bg={p.ink}>
      {img ? <img src={img.duo} width={W} height={H} style={{ position: "absolute", left: 0, top: 0, objectFit: "cover", opacity: 0.5 }} /> : null}
      {grain}
      {img ? null : (
        <div style={Abs({ left: 60, top: 190, width: W - 120, flexDirection: "column" })}>
          <div style={{ display: "flex", fontFamily: "HeadI", fontStyle: "italic", fontSize: Math.min(300, Math.round(1500 / Math.max(plain(brand.name).length, 5))), lineHeight: 0.9, color: rgba("#FFFFFF", 0.1), letterSpacing: -8 }}>{brand.name}</div>
          <div style={{ display: "flex", height: 1.5, background: rgba("#FFFFFF", 0.3), marginTop: 30 }} />
        </div>
      )}
      <div style={Abs({ left: 72, right: 72, bottom: 150, flexDirection: "column" })}>
        <div style={{ display: "flex", fontFamily: "Body", fontWeight: 700, fontSize: 22, letterSpacing: 5, color: brand.colors.accent }}>{plain(s.kicker).toUpperCase() || "SAMPAI JUMPA"}</div>
        <div style={{ display: "flex", marginTop: 16 }}>
          <Words k={k} text={s.headline} size={fit(s.headline, 120, 70, 26)} style={{ fontFamily: "Head", color: "#FFFFFF", lineHeight: 0.98, letterSpacing: -2.5 }} hl={edHl(brand.colors.accent)} gap={0.22} />
        </div>
        <Para text={s.body} size={28} color="rgba(255,255,255,0.75)" mt={24} width={800} />
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 46, paddingBottom: 10, borderBottom: "2px solid #FFFFFF", alignSelf: "flex-start" }}>
          <div style={{ display: "flex", fontFamily: "Body", fontWeight: 700, fontSize: 30, color: "#FFFFFF", letterSpacing: 1 }}>{plain(s.labelB) || `Follow ${brand.handle}`}</div>
          <Arrow color="#FFFFFF" size={36} />
        </div>
      </div>
      <EdChrome brand={brand} index={index} total={total} dark logo={logo} />
    </Frame>
  );
}

// ================================================================= POSTER

function poPalette(brand: Brand) {
  const c = brand.colors;
  const field = c.primary;
  const pop = lum(c.accent) > 0.3 ? c.accent : "#FFD23F";
  return { field, pop, ink: "#0E0E0E", onField: onColor(field), onPop: onColor(pop) };
}

/** Ukuran huruf Anton supaya kata terpanjang muat selebar kolom. */
function posterSize(text: string, width: number, max: number, wf = 0.47) {
  const words = plain(text).toUpperCase().split(/\s+/);
  const longest = Math.max(...words.map((w) => w.length), 4);
  const total = plain(text).length;
  const byWord = width / (longest * wf);
  const byTotal = Math.sqrt((width * 560) / Math.max(total, 1)) * 1.05 * (0.47 / wf);
  return Math.round(Math.min(max, byWord, byTotal));
}

function Marquee({ text, color, bg, top, rotate = -4 }: { text: string; color: string; bg: string; top: number; rotate?: number }) {
  const unit = `${plain(text).toUpperCase()}  /  `;
  return (
    <div style={Abs({ left: -60, width: W + 120, top, height: 84, background: bg, alignItems: "center", transform: `rotate(${rotate}deg)`, overflow: "hidden" })}>
      <div style={{ display: "flex", fontFamily: "Head", fontSize: 46, color, letterSpacing: 2, whiteSpace: "nowrap" }}>{unit.repeat(8)}</div>
    </div>
  );
}

function Burst({ text, size, bg, fg, style }: { text: string; size: number; bg: string; fg: string; style: React.CSSProperties }) {
  const spikes = 18;
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 50 : 42;
    const a = (Math.PI * i) / spikes;
    pts.push(`${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`);
  }
  return (
    <div style={{ position: "absolute", display: "flex", width: size, height: size, alignItems: "center", justifyContent: "center", ...style }}>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute", left: 0, top: 0 }}>
        <polygon points={pts.join(" ")} fill={bg} />
      </svg>
      <div style={{ display: "flex", width: size * 0.7, justifyContent: "center", textAlign: "center", fontFamily: "Head", fontSize: fit(text, size * 0.2, size * 0.11, 8), lineHeight: 1, color: fg }}>{plain(text).toUpperCase()}</div>
    </div>
  );
}

function PoChrome({ brand, index, total, fg, logo }: { brand: Brand; index: number; total: number; fg: string; logo: PackLogo }) {
  return (
    <>
      <div style={Abs({ left: 64, right: 64, top: 56, justifyContent: "space-between", alignItems: "center" })}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {logo ? <img src={logo.src} width={Math.round((logo.width / logo.height) * 52)} height={52} /> : null}
          <div style={{ display: "flex", fontFamily: "Head", fontSize: 36, color: fg, letterSpacing: 1 }}>{brand.name.toUpperCase()}</div>
        </div>
        {total > 1 ? <div style={{ display: "flex", fontFamily: "Head", fontSize: 36, color: fg }}>{`${index + 1}/${total}`}</div> : <div />}
      </div>
      <div style={Abs({ left: 64, right: 64, bottom: 50, justifyContent: "space-between", alignItems: "center", fontFamily: "BodyB", fontWeight: 900, fontSize: 24, color: fg, letterSpacing: 1 })}>
        <div style={{ display: "flex" }}>{brand.handle}</div>
        {index < total - 1 && total > 1 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            GESER <Arrow color={fg} size={30} stroke={3.5} />
          </div>
        ) : (
          <div />
        )}
      </div>
    </>
  );
}

function Poster({ brand, slide: s, index, total, img, logo, assets, pair, density }: PackProps) {
  const k = 1; // ukuran poster dihitung langsung dari lebar font
  const fp: FontPair = FONT_PAIRS[pair];
  const up = fp.upper;
  const pw = up ? fp.wf : fp.wf * 1.12;
  const vis = density === "visual";
  const sub = (t: string) => (vis ? "" : t); // mode Visual: penjelasan pindah ke caption
  const p = poPalette(brand);
  const role = roleOf(s.layout);
  const grain = <img src={assets.grain} width={W} height={H} style={{ position: "absolute", left: 0, top: 0, opacity: 0.45 }} />;
  const hlBox = (bg: string, fg: string): Hl => () => ({ background: bg, color: fg, paddingLeft: 10, paddingRight: 10, marginLeft: -4 });

  if (role === "cover") {
    const size = posterSize(s.headline, W - 120, 210, pw);
    return (
      <Frame bg={p.field}>
        {img ? <img src={img.duo} width={W} height={H} style={{ position: "absolute", left: 0, top: 0, objectFit: "cover", objectPosition: "50% 50%" }} /> : null}
        <div style={Abs({ left: 0, top: 0, width: W, height: H, backgroundImage: `linear-gradient(180deg, ${rgba(p.field, 0.1)} 0%, ${rgba(p.field, 0.2)} 40%, ${rgba("#000000", 0.75)} 100%)` })} />
        {grain}
        <div style={Abs({ left: 56, right: 56, bottom: 230, flexDirection: "column" })}>
          <Words k={k} text={s.headline} size={size} upper={up} style={{ fontFamily: "Head", color: "#FFFFFF", lineHeight: 0.92, letterSpacing: 0 }} hl={hlBox(p.pop, p.onPop)} gap={0.2} />
          <Para text={sub(s.body)} size={30} color="rgba(255,255,255,0.9)" family="BodyB" weight={700} mt={24} width={760} />
        </div>
        {plain(s.kicker) ? <Burst text={s.kicker} size={250} bg={p.pop} fg={p.onPop} style={{ left: W - 44 - 250, top: 150, transform: "rotate(12deg)" }} /> : null}
        <Marquee text={`${brand.name}  /  ${plain(s.kicker) || brand.handle}`} color={p.onPop} bg={p.pop} top={H - 170} rotate={-3} />
        <PoChrome brand={brand} index={index} total={total} fg="#FFFFFF" logo={logo} />
      </Frame>
    );
  }

  if (role === "point") {
    const n = index;
    const variant = index % 2;
    const size = posterSize(s.headline, W - 128, img ? 112 : 150, pw);
    const bg = variant ? p.pop : p.field;
    const fg = onColor(bg);
    return (
      <Frame bg={bg}>
        {grain}
        <div style={Abs({ left: 40, top: 110, fontFamily: "Head", fontSize: 420, lineHeight: 1, color: "transparent", WebkitTextStroke: `4px ${rgba(fg, 0.55)}` } as React.CSSProperties)}>{two(n)}</div>
        {img ? (
          <div style={Abs({ right: 56, top: 170, width: vis ? 760 : 600, height: vis ? 700 : 560, border: `14px solid ${fg === "#FFFFFF" ? "#FFFFFF" : p.ink}`, transform: `rotate(${variant ? -3 : 3}deg)`, boxShadow: "0 30px 60px rgba(0,0,0,0.35)" })}>
            <img src={variant ? img.src : img.duo} width={vis ? 732 : 572} height={vis ? 672 : 532} style={{ objectFit: "cover", objectPosition: "50% 50%" }} />
          </div>
        ) : null}
        <div style={Abs({ left: 64, width: W - 128, bottom: 118, flexDirection: "column" })}>
          {plain(s.kicker) ? (
            <div style={{ display: "flex", alignSelf: "flex-start", background: fg, color: bg, fontFamily: "BodyB", fontWeight: 900, fontSize: 26, letterSpacing: 2, paddingLeft: 16, paddingRight: 16, paddingTop: 6, paddingBottom: 6, marginBottom: 22 }}>{plain(s.kicker).toUpperCase()}</div>
          ) : null}
          <Words k={k} text={s.headline} size={size} upper={up} style={{ fontFamily: "Head", color: fg, lineHeight: 0.95 }} hl={() => ({ color: variant ? p.field : p.pop })} gap={0.2} />
          <Para text={sub(s.body)} size={28} color={rgba(fg, 0.85)} family="BodyB" weight={700} mt={20} width={860} />
        </div>
        <PoChrome brand={brand} index={index} total={total} fg={fg} logo={logo} />
      </Frame>
    );
  }

  if (role === "quote") {
    return (
      <Frame bg={p.ink}>
        {grain}
        <div style={Abs({ left: 60, right: 60, top: 220, bottom: 200, flexDirection: "column", justifyContent: "center" })}>
          <div style={{ display: "flex", fontFamily: "Head", fontSize: 220, color: p.pop, lineHeight: 0.6, marginBottom: 30 }}>“</div>
          <Words k={k} text={s.headline} size={posterSize(s.headline, W - 120, 150, pw)} upper={up} style={{ fontFamily: "Head", color: "#FFFFFF", lineHeight: 0.95 }} hl={hlBox(p.pop, p.onPop)} gap={0.2} />
          <div style={{ display: "flex", fontFamily: "BodyB", fontWeight: 900, fontSize: 28, color: p.pop, marginTop: 36, letterSpacing: 2 }}>{`— ${(plain(s.body) || brand.name).toUpperCase()}`}</div>
        </div>
        <PoChrome brand={brand} index={index} total={total} fg="#FFFFFF" logo={logo} />
      </Frame>
    );
  }

  if (role === "list" || role === "compare" || role === "stat") {
    const items = role === "compare" ? [...s.items, ...s.itemsB] : s.items;
    return (
      <Frame bg={p.field}>
        {grain}
        <div style={Abs({ left: 64, right: 64, top: 170, bottom: 130, flexDirection: "column" })}>
          {role === "stat" ? <div style={{ display: "flex", fontFamily: "Head", fontSize: 340, color: p.pop, lineHeight: 0.9 }}>{plain(s.stat)}</div> : null}
          <Words k={k} text={s.headline} size={posterSize(s.headline, W - 128, 120, pw)} upper={up} style={{ fontFamily: "Head", color: p.onField, lineHeight: 0.95 }} hl={hlBox(p.pop, p.onPop)} gap={0.2} />
          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 40 }}>
            {items.slice(0, 5).map((it, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 22, background: i % 2 ? rgba(p.onField, 0.1) : p.pop, color: i % 2 ? p.onField : p.onPop, paddingLeft: 26, paddingRight: 26, paddingTop: 18, paddingBottom: 18 }}>
                <div style={{ display: "flex", fontFamily: "Head", fontSize: 48 }}>{two(i + 1)}</div>
                <div style={{ display: "flex", flex: 1, fontFamily: "BodyB", fontWeight: 900, fontSize: fit(it, 32, 24, 44), lineHeight: 1.2 }}>{plain(it)}</div>
              </div>
            ))}
          </div>
          <Para text={role === "stat" ? s.body : ""} size={28} color={rgba(p.onField, 0.85)} family="BodyB" weight={700} mt={20} />
        </div>
        <PoChrome brand={brand} index={index} total={total} fg={p.onField} logo={logo} />
      </Frame>
    );
  }

  // CTA
  return (
    <Frame bg={p.pop}>
      {img ? <img src={img.duo} width={W} height={560} style={{ position: "absolute", left: 0, top: 0, objectFit: "cover", objectPosition: "50% 50%" }} /> : null}
      {grain}
      <div style={Abs({ left: 64, right: 64, top: img ? 600 : 260, flexDirection: "column" })}>
        <Words k={k} text={s.headline} size={posterSize(s.headline, W - 128, img ? 130 : 170, pw)} upper={up} style={{ fontFamily: "Head", color: p.onPop, lineHeight: 0.93 }} hl={hlBox(p.ink, "#FFFFFF")} gap={0.2} />
        <Para text={s.body} size={28} color={rgba(p.onPop, 0.85)} family="BodyB" weight={700} mt={22} width={860} />
        <div style={{ display: "flex", alignSelf: "flex-start", alignItems: "center", gap: 16, background: p.ink, color: "#FFFFFF", fontFamily: "Head", fontSize: 44, paddingLeft: 34, paddingRight: 30, paddingTop: 16, paddingBottom: 16, marginTop: 40 }}>
          {(plain(s.labelB) || `FOLLOW ${brand.handle}`).toUpperCase()}
          <Arrow color="#FFFFFF" size={44} stroke={3.5} />
        </div>
      </div>
      {plain(s.kicker) ? <Burst text={s.kicker} size={230} bg={p.field} fg={p.onField} style={{ left: W - 40 - 230, top: img ? 430 : 120, transform: "rotate(-10deg)" }} /> : null}
      <PoChrome brand={brand} index={index} total={total} fg={img ? "#FFFFFF" : p.onPop} logo={logo} />
    </Frame>
  );
}

// ================================================================= SCRAPBOOK

function sbPalette(brand: Brand) {
  const c = brand.colors;
  const marker = lum(c.accent) > 0.25 ? c.accent : "#FFD84D";
  return { ink: "#1C1A17", marker, red: lum(c.primary) < 0.5 ? c.primary : "#C2412D", note: "#FFF6C9" };
}

function Tape({ style: raw }: { style: React.CSSProperties }) {
  const style = { ...raw };
  if (typeof style.right === "number") {
    style.left = W - style.right - 170;
    delete style.right;
  }
  return <div style={{ position: "absolute", display: "flex", width: 170, height: 52, background: "rgba(232,220,190,0.78)", boxShadow: "0 2px 6px rgba(0,0,0,0.12)", ...style }} />;
}

function Polaroid({ img, w, h, rotate, caption, style: raw }: { img: PackImg; w: number; h: number; rotate: number; caption?: string; style: React.CSSProperties }) {
  const style = { ...raw };
  if (typeof style.right === "number") {
    style.left = W - style.right - (w + 44);
    delete style.right;
  }
  return (
    <div style={{ position: "absolute", display: "flex", flexDirection: "column", background: "#FFFFFF", padding: 22, paddingBottom: caption ? 18 : 22, transform: `rotate(${rotate}deg)`, boxShadow: "0 24px 50px rgba(40,30,10,0.28)", ...style }}>
      <img src={img.src} width={w} height={h} style={{ objectFit: "cover", objectPosition: "50% 50%" }} />
      {caption ? <div style={{ display: "flex", fontFamily: "Hand", fontSize: 44, color: "#2A2620", marginTop: 10, paddingLeft: 6 }}>{caption}</div> : null}
    </div>
  );
}

function Scribble({ color, style, flip = false }: { color: string; style: React.CSSProperties; flip?: boolean }) {
  return (
    <svg width={190} height={120} viewBox="0 0 190 120" style={{ position: "absolute", ...(typeof style.right === "number" ? { left: W - style.right - 190, top: style.top } : style), ...(flip ? { transform: "scaleX(-1)" } : {}) }}>
      <path d="M8 96 C 50 20, 120 10, 170 40" fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" />
      <path d="M150 22 L 172 41 L 146 52" fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SbChrome({ brand, index, total, logo }: { brand: Brand; index: number; total: number; logo: PackLogo }) {
  return (
    <>
      <div style={Abs({ left: 64, right: 64, top: 52, justifyContent: "space-between", alignItems: "center" })}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {logo ? <img src={logo.src} width={Math.round((logo.width / logo.height) * 54)} height={54} /> : null}
          <div style={{ display: "flex", fontFamily: "Hand", fontSize: 46, color: "#1C1A17" }}>{brand.name}</div>
        </div>
        {total > 1 ? <div style={{ display: "flex", fontFamily: "Hand", fontSize: 44, color: "#1C1A17" }}>{`${index + 1} / ${total}`}</div> : <div />}
      </div>
      <div style={Abs({ left: 64, right: 64, bottom: 48, justifyContent: "space-between", alignItems: "center", fontFamily: "Body", fontWeight: 700, fontSize: 24, color: "#1C1A17" })}>
        <div style={{ display: "flex" }}>{brand.handle}</div>
        {index < total - 1 && total > 1 ? <div style={{ display: "flex", fontFamily: "Hand", fontSize: 42 }}>geser yuk →</div> : <div />}
      </div>
    </>
  );
}

function Scrapbook({ brand, slide: s, index, total, img, logo, assets, pair, density }: PackProps) {
  const k = scaleK(pair, 0.56);
  const vis = density === "visual";
  const sub = (t: string) => (vis ? "" : t); // mode Visual: penjelasan pindah ke caption
  const p = sbPalette(brand);
  const role = roleOf(s.layout);
  const paper = <img src={assets.paper} width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }} />;
  const marker: Hl = () => ({ backgroundImage: `linear-gradient(176deg, transparent 52%, ${rgba(p.marker, 0.85)} 52%, ${rgba(p.marker, 0.85)} 92%, transparent 92%)` });
  const head = (text: string, size: number, color = p.ink) => <Words k={k} text={text} size={size} style={{ fontFamily: "Head", fontWeight: 400, color, lineHeight: 1.04, letterSpacing: -size * k * 0.02 }} hl={marker} gap={0.24} />;

  if (role === "cover") {
    return (
      <Frame bg="#EFE6D6">
        {paper}
        {img ? (
          <>
            <Polaroid img={img} w={700} h={620} rotate={-4} style={{ left: 150, top: 140 }} />
            <Tape style={{ left: 160, top: 132, transform: "rotate(-30deg)" }} />
            <Tape style={{ left: 760, top: 150, transform: "rotate(24deg)" }} />
          </>
        ) : null}
        {plain(s.kicker) ? (
          <div style={Abs({ right: 70, top: img ? 720 : 180, width: 230, height: 230, borderRadius: 999, background: p.red, alignItems: "center", justifyContent: "center", transform: "rotate(10deg)", boxShadow: "0 12px 26px rgba(0,0,0,0.2)" })}>
            <div style={{ display: "flex", width: 180, justifyContent: "center", textAlign: "center", fontFamily: "Hand", fontSize: fit(s.kicker, 48, 32, 12), lineHeight: 1, color: "#FFFFFF" }}>{plain(s.kicker)}</div>
          </div>
        ) : null}
        <div style={Abs({ left: 64, right: 64, bottom: 130, flexDirection: "column" })}>
          {head(s.headline, fit(s.headline, 110, 70, 28))}
          <div style={{ display: "flex", alignItems: "center", marginTop: 18 }}>
            <Para text={sub(s.body)} size={30} color="#3B362F" family="Body" weight={500} width={760} />
          </div>
        </div>
        <SbChrome brand={brand} index={index} total={total} logo={logo} />
      </Frame>
    );
  }

  if (role === "point") {
    const n = index;
    const left = index % 2 === 1;
    return (
      <Frame bg="#EFE6D6">
        {paper}
        {img ? (
          <>
            <Polaroid img={img} w={vis ? 640 : 540} h={vis ? 660 : 560} rotate={left ? -5 : 4} caption={plain(s.kicker) ? plain(s.kicker).toLowerCase() : undefined} style={left ? { left: 70, top: 150 } : { right: 70, top: 150 }} />
            <Tape style={left ? { left: 230, top: 132, transform: "rotate(-6deg)" } : { right: 230, top: 138, transform: "rotate(5deg)" }} />
          </>
        ) : null}
        <div style={Abs({ ...(left ? { right: 80 } : { left: 80 }), top: img ? 230 : 200, width: 300, height: 300, alignItems: "center", justifyContent: "center" })}>
          <svg width={300} height={300} viewBox="0 0 300 300" style={{ position: "absolute", left: 0, top: 0 }}>
            <path d="M150 28 C 240 24, 284 90, 270 160 C 256 240, 170 282, 100 262 C 34 242, 18 160, 40 100 C 58 54, 110 30, 168 36" fill="none" stroke={p.red} strokeWidth={7} strokeLinecap="round" />
          </svg>
          <div style={{ display: "flex", fontFamily: "Hand", fontSize: 170, color: p.red, lineHeight: 1 }}>{String(n)}</div>
        </div>
        {img ? <Scribble color={p.red} style={left ? { right: 230, top: 560 } : { left: 220, top: 560 }} flip={!left} /> : null}
        <div style={Abs({ left: 64, right: 64, top: img ? (vis ? 980 : 860) : 620, flexDirection: "column" })}>
          {head(s.headline, fit(s.headline, 80, 54, 34))}
{sub(s.body) ? (
          <div style={{ display: "flex", marginTop: 22, alignSelf: "flex-start", background: p.note, paddingLeft: 26, paddingRight: 26, paddingTop: 14, paddingBottom: 16, transform: "rotate(-1deg)", boxShadow: "0 8px 18px rgba(0,0,0,0.12)" }}>
            <Para text={s.body} size={28} color="#3B362F" family="Body" weight={500} />
          </div>
          ) : null}
        </div>
        <SbChrome brand={brand} index={index} total={total} logo={logo} />
      </Frame>
    );
  }

  if (role === "quote") {
    return (
      <Frame bg="#EFE6D6">
        {paper}
        <div style={Abs({ left: 110, right: 110, top: 280, height: 680, background: p.note, transform: "rotate(-2deg)", boxShadow: "0 24px 50px rgba(40,30,10,0.22)", padding: 70, flexDirection: "column", justifyContent: "center" })}>
          <div style={{ display: "flex", fontFamily: "Hand", fontSize: 140, color: p.red, lineHeight: 0.6, marginBottom: 20 }}>“</div>
          {head(s.headline, fit(s.headline, 84, 54, 30))}
          <div style={{ display: "flex", fontFamily: "Hand", fontSize: 50, color: "#3B362F", marginTop: 34 }}>{`— ${plain(s.body) || brand.name}`}</div>
        </div>
        <Tape style={{ left: 450, top: 250, transform: "rotate(4deg)" }} />
        <SbChrome brand={brand} index={index} total={total} logo={logo} />
      </Frame>
    );
  }

  if (role === "list" || role === "compare" || role === "stat") {
    const items = role === "compare" ? [...s.items, ...s.itemsB] : s.items;
    return (
      <Frame bg="#EFE6D6">
        {paper}
        <div style={Abs({ left: 80, right: 80, top: 180, bottom: 140, flexDirection: "column" })}>
          {role === "stat" ? <div style={{ display: "flex", fontFamily: "Hand", fontSize: 260, color: p.red, lineHeight: 0.9 }}>{plain(s.stat)}</div> : null}
          {head(s.headline, fit(s.headline, 84, 56, 30))}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 40 }}>
            {items.slice(0, 5).map((it, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 22 }}>
                <div style={{ display: "flex", width: 56, height: 56, border: `4px solid ${p.ink}`, borderRadius: 10, alignItems: "center", justifyContent: "center", transform: `rotate(${i % 2 ? 4 : -3}deg)` }}>
                  <div style={{ display: "flex", fontFamily: "Hand", fontSize: 54, color: p.red, lineHeight: 1, marginTop: -8 }}>✓</div>
                </div>
                <div style={{ display: "flex", flex: 1, fontFamily: "Body", fontWeight: 700, fontSize: fit(it, 34, 26, 44), color: p.ink, lineHeight: 1.25 }}>{plain(it)}</div>
              </div>
            ))}
          </div>
          <Para text={role === "stat" ? s.body : ""} size={28} color="#3B362F" mt={20} />
        </div>
        <SbChrome brand={brand} index={index} total={total} logo={logo} />
      </Frame>
    );
  }

  // CTA
  return (
    <Frame bg="#EFE6D6">
      {paper}
      {img ? (
        <>
          <Polaroid img={img} w={460} h={460} rotate={6} style={{ right: 80, top: 150 }} />
          <Tape style={{ right: 230, top: 136, transform: "rotate(-4deg)" }} />
        </>
      ) : null}
      <div style={Abs({ left: 70, top: img ? 230 : 200, width: 420, flexDirection: "column" })}>
        <div style={{ display: "flex", fontFamily: "Hand", fontSize: 64, color: p.red, lineHeight: 1, transform: "rotate(-4deg)" }}>{plain(s.kicker) || "psst…"}</div>
        <Scribble color={p.red} style={{ left: 150, top: 80 }} />
      </div>
      <div style={Abs({ left: 64, right: 64, top: img ? 720 : 500, flexDirection: "column" })}>
        {head(s.headline, fit(s.headline, 96, 60, 28))}
        <Para text={s.body} size={30} color="#3B362F" family="Body" weight={500} mt={20} width={860} />
        <div style={{ display: "flex", alignSelf: "flex-start", alignItems: "center", gap: 14, background: p.ink, color: "#FFFFFF", fontFamily: "BodyB", fontWeight: 900, fontSize: 32, paddingLeft: 30, paddingRight: 26, paddingTop: 16, paddingBottom: 16, borderRadius: 999, marginTop: 36, transform: "rotate(-1.5deg)" }}>
          {plain(s.labelB) || `Follow ${brand.handle}`}
          <Arrow color="#FFFFFF" size={34} />
        </div>
      </div>
      <SbChrome brand={brand} index={index} total={total} logo={logo} />
    </Frame>
  );
}

// ================================================================= root

function Frame({ bg, children }: { bg: string; children: React.ReactNode }) {
  return <div style={{ width: W, height: H, display: "flex", position: "relative", background: bg, overflow: "hidden", fontFamily: "Body" }}>{children}</div>;
}

export function PackSlide(props: PackProps) {
  if (props.pack === "poster") return <Poster {...props} />;
  if (props.pack === "scrapbook") return <Scrapbook {...props} />;
  return <Editorial {...props} />;
}

/** Foto yang perlu dimuat per slide: semua role kecuali kutipan (kecuali pack memakainya). */
export function packWantsImage(pack: PackKey, layout: SlideLayout) {
  const r = roleOf(layout);
  return r === "cover" || r === "point" || r === "cta";
}

