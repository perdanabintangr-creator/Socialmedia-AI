/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */
import type { Brand, FontKey, Slide, SlideLayout, TemplateKey } from "./types";
import { Icon } from "./icons";

export const CANVAS = { width: 1080, height: 1350 }; // 4:5, aman untuk IG feed & TikTok photo
const PAD = 84;

/** Ukuran kotak foto per layout — renderer memotong foto pas di ukuran ini. */
export const IMAGE_BOX: Partial<Record<SlideLayout, { w: number; h: number }>> = {
  cover_photo: { w: 1080, h: 1350 },
  cover_split: { w: 1080, h: 740 },
  cover_type: { w: 420, h: 540 },
  point_photo: { w: 912, h: 500 },
  quote: { w: 168, h: 168 },
  cta: { w: 1080, h: 1350 },
  promo_hero: { w: 1080, h: 860 },
};

export type Img = { src: string; w: number; h: number };
export type LogoImg = { src: string; width: number; height: number };

// ---------------------------------------------------------------- warna

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
  const n = parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
function readableOn(bg: string, preferred: string) {
  if (contrast(bg, preferred) >= 4.5) return preferred;
  return contrast(bg, "#FFFFFF") >= contrast(bg, "#111111") ? "#FFFFFF" : "#111111";
}
export function alpha(hex: string, a: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

interface Theme {
  bg: string;
  fg: string;
  muted: string;
  accent: string; // aksen yang terbaca di atas bg
  pillBg: string;
  pillFg: string;
  surface: string; // latar kartu
  line: string;
  dark: boolean;
  hl: "marker" | "color";
  upper: boolean; // judul kapital (font poster)
}

/** Font poster yang memang dirancang untuk huruf kapital. */
const CAPS_FONTS: FontKey[] = ["anton", "bebas-neue", "archivo-black"];

function makeTheme(brand: Brand, bg: string, preferFg: string): Theme {
  const c = brand.colors;
  const fg = readableOn(bg, preferFg);
  const dark = luminance(bg) < 0.35;
  const accent = [dark ? c.accent : c.secondary, c.accent, c.secondary, c.primary].find((x) => contrast(bg, x) >= 3) ?? fg;
  const pillBg = [c.accent, c.secondary, c.primary].find((x) => contrast(bg, x) >= 1.6) ?? accent;
  return {
    bg,
    fg,
    muted: alpha(fg, 0.74),
    accent,
    pillBg,
    pillFg: readableOn(pillBg, "#FFFFFF"),
    surface: dark ? alpha("#FFFFFF", 0.08) : "#FFFFFF",
    line: alpha(fg, dark ? 0.18 : 0.12),
    dark,
    hl: dark ? "color" : "marker",
    upper: CAPS_FONTS.includes(brand.headingFont),
  };
}

function themeFor(brand: Brand, template: TemplateKey, layout: SlideLayout, index: number, hasPhotoBg: boolean): Theme {
  const c = brand.colors;
  if (hasPhotoBg) return makeTheme(brand, "#0E0F14", "#FFFFFF");
  if (layout === "cover_split") return makeTheme(brand, c.primary, "#FFFFFF"); // panel bawah selalu warna utama
  const isBookend = layout.startsWith("cover") || layout === "cta";
  if (template === "bold") {
    const bg = isBookend || index % 2 === 0 ? c.primary : c.secondary;
    return makeTheme(brand, bg, "#FFFFFF");
  }
  if (template === "promo") {
    // Gaya iklan: latar warna penuh yang berganti, slide promo selalu warna utama.
    const bg = isBookend || layout.startsWith("promo") || index % 2 === 0 ? c.primary : c.secondary;
    return makeTheme(brand, bg, "#FFFFFF");
  }
  if (template === "clean") {
    return layout === "cta" ? makeTheme(brand, c.primary, "#FFFFFF") : makeTheme(brand, c.background, c.text);
  }
  return isBookend ? makeTheme(brand, c.primary, "#FFFFFF") : makeTheme(brand, c.background, c.text);
}

// ---------------------------------------------------------------- teks

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;
export const clean = (s: string) =>
  (s || "").replace(/[→➡⇒]/g, "›").replace(/[←⬅]/g, "‹").replace(EMOJI, "").trim();
const plain = (s: string) => clean(s).replace(/\*/g, "");

function fit(text: string, max: number, min: number, idealChars: number) {
  const len = Math.max(plain(text).length, 1);
  if (len <= idealChars) return max;
  return Math.max(min, Math.round(max * Math.sqrt(idealChars / len)));
}

/** Teks dengan dukungan *highlight*. Dirender per kata agar wrap rapi di satori. */
function Rich({
  text,
  size,
  t,
  weight = 800,
  family = "Heading",
  lineHeight = 1.08,
  color,
  letterSpacing,
}: {
  text: string;
  size: number;
  t: Theme;
  weight?: number;
  family?: string;
  lineHeight?: number;
  color?: string;
  letterSpacing?: number;
}) {
  const words: { w: string; hl: boolean }[] = [];
  clean(text)
    .split(/(\*[^*]+\*)/)
    .filter(Boolean)
    .forEach((seg) => {
      const hl = seg.startsWith("*") && seg.endsWith("*") && seg.length > 2;
      seg
        .replace(/\*/g, "")
        .split(/\s+/)
        .filter(Boolean)
        .forEach((w) => {
          // Tanda baca menempel ke kata sebelumnya ("sempurna." bukan "sempurna .")
          if (/^[.,!?:;)%]+$/.test(w) && words.length) words[words.length - 1].w += w;
          else words.push({ w, hl });
        });
    });
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        width: "100%",
        fontFamily: family,
        fontWeight: weight,
        fontSize: size,
        lineHeight,
        letterSpacing: letterSpacing ?? (t.upper ? 0 : -size * 0.02),
        color: color ?? t.fg,
        textTransform: t.upper && family === "Heading" ? "uppercase" : "none",
      }}
    >
      {words.map((x, i) => (
        <span
          key={i}
          style={{
            marginRight: size * 0.24,
            ...(x.hl
              ? t.hl === "color"
                ? { color: t.accent }
                : { backgroundImage: `linear-gradient(180deg, transparent 58%, ${alpha(t.pillBg, 0.55)} 58%)` }
              : {}),
          }}
        >
          {x.w}
        </span>
      ))}
    </div>
  );
}

function Text({ text, size, color, weight = 500, lineHeight = 1.4, mt = 0 }: { text: string; size: number; color: string; weight?: number; lineHeight?: number; mt?: number }) {
  if (!plain(text)) return null;
  return <div style={{ fontSize: size, color, fontWeight: weight, lineHeight, marginTop: mt }}>{plain(text)}</div>;
}

function Sticker({ t, text, rotate = -3, size = 30 }: { t: Theme; text: string; rotate?: number; size?: number }) {
  if (!plain(text)) return null;
  return (
    <div style={{ display: "flex", marginBottom: 32 }}>
      <div
        style={{
          background: t.pillBg,
          color: t.pillFg,
          fontSize: size,
          fontWeight: 700,
          padding: "12px 26px",
          borderRadius: 9999,
          textTransform: "uppercase",
          letterSpacing: 2,
          transform: `rotate(${rotate}deg)`,
        }}
      >
        {plain(text)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- dekorasi

function SparkleShape({ size, color, style }: { size: number; color: string; style: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute", ...style }}>
      <path d="M50 0 C55 35 65 45 100 50 C65 55 55 65 50 100 C45 65 35 55 0 50 C35 45 45 35 50 0 Z" fill={color} />
    </svg>
  );
}

function DotGrid({ color, style }: { color: string; style: React.CSSProperties }) {
  const dots = [];
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) dots.push(<circle key={`${r}-${c}`} cx={8 + c * 28} cy={8 + r * 28} r={4} fill={color} />);
  return (
    <svg width={160} height={160} viewBox="0 0 160 160" style={{ position: "absolute", ...style }}>
      {dots}
    </svg>
  );
}

/** Bentuk ledakan / starburst khas iklan promo. */
function Burst({ size, color, spikes = 20, depth = 0.8, rotate = 0, style }: { size: number; color: string; spikes?: number; depth?: number; rotate?: number; style: React.CSSProperties }) {
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 ? 50 * depth : 50;
    const a = (i * Math.PI) / spikes - Math.PI / 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute", transform: `rotate(${rotate}deg)`, ...style }}>
      <polygon points={pts.join(" ")} fill={color} />
    </svg>
  );
}

function Wave({ color, style, width = 1080, height = 260 }: { color: string; style: React.CSSProperties; width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 1080 260" preserveAspectRatio="none" style={{ position: "absolute", ...style }}>
      <path d="M0 90 C 160 10 300 170 480 100 S 820 10 1080 80 V 260 H 0 Z" fill={color} />
    </svg>
  );
}

function Decor({ t, template, layout }: { t: Theme; template: TemplateKey; layout: SlideLayout }) {
  if (layout === "cover_photo" || layout === "cover_split" || layout.startsWith("promo")) return null;
  if (template === "promo") {
    return (
      <>
        <Wave color={alpha(t.dark ? "#FFFFFF" : t.pillBg, t.dark ? 0.08 : 0.16)} style={{ left: 0, bottom: 0 }} />
        <Burst size={128} color={t.pillBg} rotate={14} style={{ right: 64, top: 136 }} />
        <SparkleShape size={44} color={alpha(t.fg, 0.55)} style={{ right: 214, top: 120 }} />
      </>
    );
  }
  if (template === "bold") {
    return (
      <>
        <div style={{ position: "absolute", right: -220, bottom: -220, width: 620, height: 620, borderRadius: 9999, background: alpha("#FFFFFF", t.dark ? 0.06 : 0.25) }} />
        <SparkleShape size={110} color={t.pillBg} style={{ right: 96, top: 150 }} />
        <SparkleShape size={46} color={alpha(t.fg, 0.5)} style={{ right: 210, top: 260 }} />
      </>
    );
  }
  if (template === "clean") {
    return t.dark ? null : <div style={{ position: "absolute", right: -160, bottom: -160, width: 420, height: 420, borderRadius: 9999, border: `48px solid ${alpha(t.accent, 0.08)}` }} />;
  }
  return t.dark ? (
    <>
      <div style={{ position: "absolute", right: -200, top: -200, width: 560, height: 560, borderRadius: 9999, background: alpha("#FFFFFF", 0.05) }} />
      <SparkleShape size={70} color={t.pillBg} style={{ right: 110, top: 170 }} />
    </>
  ) : (
    <DotGrid color={alpha(t.accent, 0.35)} style={{ right: 60, top: 140 }} />
  );
}

// ---------------------------------------------------------------- slide

export interface SlideProps {
  brand: Brand;
  slide: Slide;
  template: TemplateKey;
  index: number;
  total: number;
  logos: { onDark: LogoImg | null; onLight: LogoImg | null };
  img: Img | null;
}

/** Layout efektif: layout foto tanpa foto → varian grafis. */
export function effectiveLayout(layout: SlideLayout, hasImg: boolean): SlideLayout {
  if (hasImg) return layout;
  if (layout === "cover_photo" || layout === "cover_split") return "cover_type";
  if (layout === "point_photo") return "point_icon";
  if (layout === "promo_hero") return "promo_offer";
  return layout;
}

export function SlideView({ brand, slide, template, index, total, logos, img }: SlideProps) {
  const layout = effectiveLayout(slide.layout, Boolean(img));
  const photoBg = Boolean(img) && (layout === "cover_photo" || layout === "cta");
  // promo_hero: foto subjek di atas latar warna — tema tetap warna utama, bukan tema foto gelap
  const t = themeFor(brand, template, layout, index, photoBg);
  const headerDark = t.dark || layout === "cover_split";
  const logo = headerDark ? logos.onDark ?? logos.onLight : logos.onLight ?? logos.onDark;
  const headerFg = headerDark ? "#FFFFFF" : t.fg;
  const isLast = index === total - 1;

  const body = (() => {
    switch (layout) {
      case "cover_photo": return <CoverPhoto t={t} s={slide} img={img!} brand={brand} />;
      case "cover_split": return <CoverSplit s={slide} img={img!} brand={brand} />;
      case "cover_type": return <CoverType t={t} s={slide} img={img} />;
      case "point_photo": return <PointPhoto t={t} s={slide} img={img!} index={index} />;
      case "point_icon": return <PointIcon t={t} s={slide} index={index} />;
      case "list": return <List t={t} s={slide} />;
      case "steps": return <Steps t={t} s={slide} />;
      case "compare": return <Compare t={t} s={slide} brand={brand} />;
      case "stat": return <Stat t={t} s={slide} />;
      case "quote": return <QuoteSlide t={t} s={slide} img={img} />;
      case "cta": return <Cta t={t} s={slide} img={img} brand={brand} />;
      case "promo_hero": return <PromoHero t={t} s={slide} img={img!} />;
      case "promo_offer": return <PromoOffer t={t} s={slide} />;
    }
  })();

  return (
    <div
      style={{
        width: CANVAS.width,
        height: CANVAS.height,
        display: "flex",
        position: "relative",
        background: t.bg,
        color: t.fg,
        fontFamily: "Body",
        overflow: "hidden",
      }}
    >
      <Decor t={t} template={template} layout={layout} />
      {body}

      {/* header */}
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 64, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {logo ? (
          <img src={logo.src} width={logo.width} height={logo.height} />
        ) : (
          <div style={{ fontFamily: "Heading", fontWeight: 800, fontSize: 38, letterSpacing: -1, color: headerFg }}>{brand.name}</div>
        )}
        {total > 1 ? (
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: headerFg, opacity: 0.8, letterSpacing: 2 }}>
            {`${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`}
          </div>
        ) : (
          <div />
        )}
      </div>

      {/* footer */}
      <div style={{ position: "absolute", left: PAD, right: PAD, bottom: 56, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26, color: t.muted }}>
        <div style={{ fontWeight: 600 }}>{brand.handle}</div>
        {total > 1 && !isLast ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, color: t.accent }}>
            Geser <Icon name="ArrowRight" size={30} color={t.accent} strokeWidth={2.6} />
          </div>
        ) : (
          <div style={{ fontWeight: 600 }}>{brand.website}</div>
        )}
      </div>
    </div>
  );
}

type P = { t: Theme; s: Slide };
const INNER = CANVAS.width - PAD * 2;
const content: React.CSSProperties = {
  position: "absolute",
  left: PAD,
  width: INNER,
  top: 170,
  bottom: 140,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

// ---------------------------------------------------------------- layouts

function CoverPhoto({ t, s, img, brand }: P & { img: Img; brand: Brand }) {
  const p = brand.colors.primary;
  return (
    <>
      <img src={img.src} width={img.w} height={img.h} style={{ position: "absolute", left: 0, top: 0 }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: CANVAS.width,
          height: CANVAS.height,
          backgroundImage: `linear-gradient(180deg, ${alpha("#000000", 0.45)} 0%, ${alpha("#000000", 0)} 22%, ${alpha(p, 0.35)} 48%, ${alpha(p, 0.92)} 74%, ${p} 100%)`,
        }}
      />
      <div style={{ ...content, justifyContent: "flex-end", bottom: 150 }}>
        <Sticker t={t} text={s.kicker} />
        <Rich t={t} text={s.headline} size={fit(s.headline, 112, 68, 30)} color="#FFFFFF" />
        <Text text={s.body} size={fit(s.body, 38, 30, 80)} color={alpha("#FFFFFF", 0.85)} mt={28} />
      </div>
    </>
  );
}

function CoverSplit({ s, img, brand }: { s: Slide; img: Img; brand: Brand }) {
  const panel = makeTheme(brand, brand.colors.primary, "#FFFFFF");
  return (
    <>
      <img src={img.src} width={img.w} height={img.h} style={{ position: "absolute", left: 0, top: 0 }} />
      <div style={{ position: "absolute", left: 0, top: 0, width: CANVAS.width, height: 240, backgroundImage: `linear-gradient(180deg, ${alpha("#000000", 0.5)}, ${alpha("#000000", 0)})` }} />
      <div style={{ position: "absolute", left: 0, top: img.h, width: CANVAS.width, height: CANVAS.height - img.h, background: panel.bg }} />
      <div style={{ position: "absolute", left: PAD, width: INNER, top: img.h - 36, bottom: 130, display: "flex", flexDirection: "column" }}>
        {plain(s.kicker) ? <Sticker t={panel} text={s.kicker} rotate={-2} /> : <div style={{ height: 76 }} />}
        <Rich t={panel} text={s.headline} size={fit(s.headline, 92, 58, 34)} />
        <Text text={s.body} size={fit(s.body, 34, 28, 70)} color={panel.muted} mt={22} />
      </div>
    </>
  );
}

function CoverType({ t, s, img }: P & { img: Img | null }) {
  return (
    <div style={{ ...content, justifyContent: img ? "flex-end" : "center" }}>
      {img ? (
        <div
          style={{
            position: "absolute",
            right: -20,
            top: 0,
            display: "flex",
            borderRadius: "210px 210px 28px 28px",
            overflow: "hidden",
            border: `10px solid ${t.pillBg}`,
          }}
        >
          <img src={img.src} width={img.w} height={img.h} />
        </div>
      ) : null}
      <Sticker t={t} text={s.kicker} rotate={-4} />
      <div style={{ display: "flex", width: img ? INNER : 900 }}>
        <Rich t={t} text={s.headline} size={fit(s.headline, img ? 92 : 120, img ? 60 : 70, img ? 30 : 30)} lineHeight={1.04} />
      </div>
      <div style={{ display: "flex", width: 820 }}>
        <Text text={s.body} size={fit(s.body, 36, 28, 80)} color={t.muted} mt={28} />
      </div>
    </div>
  );
}

function NumberTag({ t, n, kicker }: { t: Theme; n: number; kicker: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 26 }}>
      <div style={{ fontFamily: "Heading", fontWeight: 800, fontSize: 64, color: t.accent, letterSpacing: -2 }}>
        {String(n).padStart(2, "0")}
      </div>
      {plain(kicker) ? (
        <div style={{ fontSize: 28, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: t.muted }}>{plain(kicker)}</div>
      ) : null}
    </div>
  );
}

function PointPhoto({ t, s, img, index }: P & { img: Img; index: number }) {
  return (
    <div style={{ ...content, top: 160, justifyContent: "flex-start" }}>
      <div style={{ display: "flex", borderRadius: 32, overflow: "hidden", marginBottom: 40, boxShadow: `0 20px 50px ${alpha("#000000", 0.18)}` }}>
        <img src={img.src} width={img.w} height={img.h} />
      </div>
      <NumberTag t={t} n={index} kicker={s.kicker} />
      <Rich t={t} text={s.headline} size={fit(s.headline, 70, 50, 40)} lineHeight={1.12} />
      <Text text={s.body} size={fit(s.body, 34, 28, 100)} color={t.muted} mt={20} />
    </div>
  );
}

function PointIcon({ t, s, index }: P & { index: number }) {
  return (
    <div style={content}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 200, height: 200, borderRadius: 56, background: t.pillBg, marginBottom: 48, transform: "rotate(-6deg)" }}>
        <Icon name={s.icon || "Lightbulb"} size={110} color={t.pillFg} strokeWidth={1.8} />
      </div>
      <NumberTag t={t} n={index} kicker={s.kicker} />
      <Rich t={t} text={s.headline} size={fit(s.headline, 84, 56, 40)} lineHeight={1.1} />
      <div style={{ width: 120, height: 10, background: t.accent, borderRadius: 9999, margin: "40px 0 36px" }} />
      <Text text={s.body} size={fit(s.body, 40, 30, 110)} color={t.muted} />
    </div>
  );
}

function List({ t, s }: P) {
  const items = s.items.slice(0, 5);
  const size = items.length > 4 ? 36 : 40;
  return (
    <div style={content}>
      <Sticker t={t} text={s.kicker} rotate={0} size={26} />
      <Rich t={t} text={s.headline} size={fit(s.headline, 84, 56, 34)} lineHeight={1.08} />
      <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 52 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 26, background: t.surface, borderRadius: 28, padding: "30px 32px", border: `2px solid ${t.line}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: 9999, background: t.pillBg, flexShrink: 0 }}>
              <Icon name="Check" size={34} color={t.pillFg} strokeWidth={3} />
            </div>
            <div style={{ display: "flex", flex: 1, fontSize: size, fontWeight: 600, lineHeight: 1.3, color: t.fg }}>{plain(it)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Steps({ t, s }: P) {
  const items = s.items.slice(0, 4);
  return (
    <div style={content}>
      <Sticker t={t} text={s.kicker} rotate={0} size={26} />
      <Rich t={t} text={s.headline} size={fit(s.headline, 84, 56, 34)} lineHeight={1.08} />
      <div style={{ display: "flex", flexDirection: "column", marginTop: 56 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 30 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 88, height: 88, borderRadius: 9999, background: i === 0 ? t.pillBg : t.surface, border: `4px solid ${t.pillBg}`, fontFamily: "Heading", fontWeight: 800, fontSize: 40, color: i === 0 ? t.pillFg : t.fg }}>
                {i + 1}
              </div>
              {i < items.length - 1 ? <div style={{ width: 4, height: 66, background: t.line }} /> : null}
            </div>
            <div style={{ display: "flex", flex: 1, paddingTop: 18, fontSize: 42, fontWeight: 600, lineHeight: 1.25 }}>{plain(it)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Compare({ t, s, brand }: P & { brand: Brand }) {
  const good = makeTheme(brand, brand.colors.primary, "#FFFFFF");
  const col = (label: string, items: string[], positive: boolean) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        borderRadius: 32,
        padding: "40px 34px",
        minHeight: 560,
        background: positive ? good.bg : t.surface,
        border: positive ? `2px solid ${alpha("#FFFFFF", t.dark ? 0.3 : 0)}` : `2px solid ${t.line}`,
        color: positive ? good.fg : t.fg,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 26 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 52, height: 52, borderRadius: 9999, background: positive ? good.pillBg : alpha(t.fg, 0.12) }}>
          <Icon name={positive ? "Check" : "X"} size={32} color={positive ? good.pillFg : t.fg} strokeWidth={3} />
        </div>
        <div style={{ fontFamily: "Heading", fontWeight: 800, fontSize: 44 }}>{plain(label) || (positive ? "Benar" : "Salah")}</div>
      </div>
      {items.slice(0, 4).map((it, i) => (
        <div key={i} style={{ display: "flex", fontSize: 36, lineHeight: 1.3, fontWeight: 600, marginTop: i ? 26 : 0, paddingTop: i ? 26 : 0, borderTop: i ? `2px solid ${positive ? alpha(good.fg, 0.18) : t.line}` : "none", opacity: positive ? 1 : 0.85 }}>
          {plain(it)}
        </div>
      ))}
    </div>
  );
  return (
    <div style={content}>
      <Rich t={t} text={s.headline} size={fit(s.headline, 84, 56, 30)} lineHeight={1.08} />
      <div style={{ display: "flex", gap: 24, marginTop: 52 }}>
        {col(s.labelA, s.items, false)}
        {col(s.labelB, s.itemsB, true)}
      </div>
    </div>
  );
}

function Ring({ pct, t }: { pct: number; t: Theme }) {
  const r = 150;
  const c = 2 * Math.PI * r;
  return (
    <svg width={380} height={380} viewBox="0 0 380 380">
      <circle cx={190} cy={190} r={r} fill="none" stroke={t.line} strokeWidth={36} />
      <circle cx={190} cy={190} r={r} fill="none" stroke={t.accent} strokeWidth={36} strokeLinecap="round" strokeDasharray={`${(c * Math.min(pct, 100)) / 100} ${c}`} transform="rotate(-90 190 190)" />
    </svg>
  );
}

function Stat({ t, s }: P) {
  const stat = plain(s.stat) || "—";
  const pct = /^(\d{1,3})(?:[.,]\d+)?\s?%$/.exec(stat);
  return (
    <div style={content}>
      <Sticker t={t} text={s.kicker} rotate={0} size={26} />
      {pct ? (
        <div style={{ display: "flex", position: "relative", width: 380, height: 380, marginBottom: 40 }}>
          <Ring pct={Number(pct[1])} t={t} />
          <div style={{ position: "absolute", left: 0, top: 0, width: 380, height: 380, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Heading", fontWeight: 800, fontSize: 110, letterSpacing: -4 }}>
            {stat}
          </div>
        </div>
      ) : (
        <div style={{ fontFamily: "Heading", fontWeight: 800, fontSize: fit(stat, 230, 120, 6), lineHeight: 1, color: t.accent, letterSpacing: -8, marginBottom: 30 }}>{stat}</div>
      )}
      <Rich t={t} text={s.headline} size={fit(s.headline, 76, 52, 44)} weight={800} lineHeight={1.12} />
      <Text text={s.body} size={fit(s.body, 38, 30, 110)} color={t.muted} mt={26} />
    </div>
  );
}

function QuoteSlide({ t, s, img }: P & { img: Img | null }) {
  return (
    <div style={content}>
      <div style={{ display: "flex", marginBottom: 30 }}>
        <Icon name="Quote" size={130} color={t.accent} strokeWidth={1.6} />
      </div>
      <Rich t={t} text={s.headline} size={fit(s.headline, 88, 56, 50)} weight={800} lineHeight={1.15} />
      {plain(s.body) ? (
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 52 }}>
          {img ? (
            <div style={{ display: "flex", borderRadius: 9999, overflow: "hidden", border: `5px solid ${t.pillBg}` }}>
              <img src={img.src} width={img.w} height={img.h} />
            </div>
          ) : (
            <div style={{ width: 64, height: 6, background: t.accent, borderRadius: 9999 }} />
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 36, fontWeight: 700 }}>{plain(s.body)}</div>
            {plain(s.kicker) ? <div style={{ fontSize: 28, color: t.muted, marginTop: 6 }}>{plain(s.kicker)}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Cta({ t, s, img, brand }: P & { img: Img | null; brand: Brand }) {
  return (
    <>
      {img ? (
        <>
          <img src={img.src} width={img.w} height={img.h} style={{ position: "absolute", left: 0, top: 0 }} />
          <div style={{ position: "absolute", left: 0, top: 0, width: CANVAS.width, height: CANVAS.height, background: alpha(brand.colors.primary, 0.82) }} />
        </>
      ) : null}
      <div style={{ ...content, alignItems: "flex-start" }}>
        <Sticker t={t} text={s.kicker} />
        <Rich t={t} text={s.headline} size={fit(s.headline, 104, 62, 32)} />
        <Text text={s.body && s.body !== brand.handle ? s.body : ""} size={36} color={t.muted} mt={28} />
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 56, background: t.pillBg, color: t.pillFg, fontSize: 40, fontWeight: 800, padding: "24px 44px", borderRadius: 9999 }}>
          {`Follow ${brand.handle}`}
        </div>
        <div style={{ display: "flex", gap: 44, marginTop: 64 }}>
          {[
            ["Heart", "Like"],
            ["Send", "Share"],
            ["Bookmark", "Save"],
          ].map(([icon, label]) => (
            <div key={icon} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 30, fontWeight: 600, color: t.fg }}>
              <Icon name={icon} size={40} color={t.accent} strokeWidth={2.4} />
              {label}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- promo / iklan

/** Angka promo di dalam starburst (mis. "Cashback 50%"). */
function OfferBurst({ t, label, stat, size, style }: { t: Theme; label: string; stat: string; size: number; style: React.CSSProperties }) {
  const st = plain(stat);
  return (
    <div style={{ position: "absolute", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", ...style }}>
      <Burst size={size} color={t.pillBg} rotate={-8} style={{ left: 0, top: 0 }} />
      <Burst size={size * 0.9} color={alpha(t.pillFg, 0.12)} spikes={20} depth={0.84} rotate={1} style={{ left: size * 0.05, top: size * 0.05 }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: "rotate(-8deg)", color: t.pillFg }}>
        {plain(label) ? (
          <div style={{ fontFamily: "Heading", fontWeight: 800, fontSize: Math.round(size * 0.1), textTransform: "uppercase", letterSpacing: 1, lineHeight: 1 }}>{plain(label)}</div>
        ) : null}
        <div style={{ fontFamily: "Heading", fontWeight: 800, fontSize: fit(st, Math.round(size * 0.34), Math.round(size * 0.18), 4), lineHeight: 0.95, letterSpacing: t.upper ? 0 : -3, marginTop: 6 }}>{st}</div>
      </div>
    </div>
  );
}

function CtaPill({ t, text, size = 36 }: { t: Theme; text: string; size?: number }) {
  if (!plain(text)) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: t.pillBg, color: t.pillFg, fontSize: size, fontWeight: 800, padding: "20px 38px", borderRadius: 9999, boxShadow: `0 10px 30px ${alpha("#000000", 0.2)}` }}>
      {plain(text)}
      <Icon name="ArrowRight" size={size} color={t.pillFg} strokeWidth={2.8} />
    </div>
  );
}

/** Iklan promo: subjek (orang/produk) besar di latar warna + angka promo dalam starburst. */
function PromoHero({ t, s, img }: P & { img: Img }) {
  const hasStat = Boolean(plain(s.stat));
  const top = CANVAS.height - img.h;
  return (
    <>
      <img src={img.src} width={img.w} height={img.h} style={{ position: "absolute", left: 0, top }} />
      {/* sambungkan foto ke latar supaya terlihat menyatu (seperti subjek cut-out) */}
      <div style={{ position: "absolute", left: 0, top, width: CANVAS.width, height: 240, backgroundImage: `linear-gradient(180deg, ${t.bg} 0%, ${alpha(t.bg, 0)} 100%)` }} />
      <div style={{ position: "absolute", left: 0, bottom: 0, width: CANVAS.width, height: 260, backgroundImage: `linear-gradient(0deg, ${alpha("#000000", 0.45)} 0%, ${alpha("#000000", 0)} 100%)` }} />
      <div style={{ position: "absolute", left: PAD, top: 150, width: hasStat ? 560 : INNER, display: "flex", flexDirection: "column" }}>
        <Sticker t={t} text={s.kicker} rotate={-4} size={28} />
        <Rich t={t} text={s.headline} size={fit(s.headline, hasStat ? 92 : 108, 58, 22)} lineHeight={t.upper ? 0.98 : 1.02} />
      </div>
      {hasStat ? <OfferBurst t={t} label={s.labelA} stat={s.stat} size={380} style={{ left: CANVAS.width - 380 - 36, top: 150 }} /> : null}
      <div style={{ position: "absolute", left: PAD, bottom: 132, width: 620, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 18 }}>
        {plain(s.body) ? (
          <div style={{ display: "flex", background: "#FFFFFF", color: "#14161F", fontSize: 28, fontWeight: 700, padding: "14px 22px", borderRadius: 18, lineHeight: 1.25, boxShadow: `0 10px 30px ${alpha("#000000", 0.18)}` }}>{plain(s.body)}</div>
        ) : null}
        <CtaPill t={t} text={s.labelB} />
      </div>
    </>
  );
}

/** Iklan promo tanpa foto: judul tebal, angka raksasa dalam starburst, benefit, tombol. */
function PromoOffer({ t, s }: P) {
  const hasStat = Boolean(plain(s.stat));
  const items = s.items.map(plain).filter(Boolean).slice(0, 3);
  return (
    <>
      <Wave color={alpha(t.dark ? "#FFFFFF" : t.pillBg, t.dark ? 0.08 : 0.16)} style={{ left: 0, bottom: 0 }} />
      <SparkleShape size={60} color={t.pillBg} style={{ left: 70, top: 640 }} />
      <SparkleShape size={36} color={alpha(t.fg, 0.6)} style={{ right: 90, top: 560 }} />
      <div style={{ ...content, justifyContent: "center" }}>
        <Sticker t={t} text={s.kicker} rotate={-4} size={28} />
        <Rich t={t} text={s.headline} size={fit(s.headline, hasStat ? 96 : 120, 60, 26)} lineHeight={t.upper ? 0.98 : 1.04} />
        {hasStat ? (
          <div style={{ display: "flex", position: "relative", width: INNER, height: 440, marginTop: 10 }}>
            <OfferBurst t={t} label={s.labelA} stat={s.stat} size={430} style={{ left: (INNER - 430) / 2, top: 6 }} />
          </div>
        ) : (
          <div style={{ height: 40 }} />
        )}
        {items.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: hasStat ? 0 : 20 }}>
            {items.map((it, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: t.surface, border: `2px solid ${t.line}`, borderRadius: 9999, padding: "12px 22px", fontSize: 28, fontWeight: 700, color: t.fg }}>
                <Icon name="Check" size={28} color={t.accent} strokeWidth={3} />
                {it}
              </div>
            ))}
          </div>
        ) : null}
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 30 }}>
          <CtaPill t={t} text={s.labelB} />
          {plain(s.body) ? <div style={{ display: "flex", flex: 1, fontSize: 24, color: t.muted, lineHeight: 1.3 }}>{plain(s.body)}</div> : null}
        </div>
      </div>
    </>
  );
}
