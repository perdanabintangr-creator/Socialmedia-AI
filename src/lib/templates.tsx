/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */
import type { Brand, Slide, TemplateKey } from "./types";

export const CANVAS = { width: 1080, height: 1350 }; // 4:5, aman untuk IG feed & TikTok photo

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
/** Pilih warna teks yang terbaca di atas `bg`. */
function readableOn(bg: string, preferred: string) {
  if (contrast(bg, preferred) >= 4.5) return preferred;
  return contrast(bg, "#FFFFFF") >= contrast(bg, "#111111") ? "#FFFFFF" : "#111111";
}
function alpha(hex: string, a: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

interface Theme {
  bg: string;
  fg: string;
  muted: string;
  accent: string; // warna aksen yang terbaca di atas bg
  pillBg: string;
  pillFg: string;
  dark: boolean;
}

function themeFor(brand: Brand, template: TemplateKey, layout: Slide["layout"]): Theme {
  const c = brand.colors;
  const bold = template === "bold" || (template === "mix" && (layout === "cover" || layout === "cta"));
  const bg = bold ? c.primary : c.background;
  const fg = readableOn(bg, bold ? "#FFFFFF" : c.text);
  const accentCandidates = bold ? [c.accent, c.secondary] : [c.secondary, c.primary, c.accent];
  const accent = accentCandidates.find((x) => contrast(bg, x) >= 3) ?? fg;
  const pillBg = bold ? c.accent : c.primary;
  return {
    bg,
    fg,
    muted: alpha(fg === "#FFFFFF" ? "#FFFFFF" : fg, 0.72),
    accent,
    pillBg,
    pillFg: readableOn(pillBg, "#FFFFFF"),
    dark: luminance(bg) < 0.4,
  };
}

// ---------------------------------------------------------------- teks

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;
const clean = (s: string) =>
  (s || "").replace(/[→➡⇒]/g, "›").replace(/[←⬅]/g, "‹").replace(EMOJI, "").trim();

function fit(text: string, max: number, min: number, idealChars: number) {
  const len = Math.max(text.length, 1);
  if (len <= idealChars) return max;
  return Math.max(min, Math.round(max * Math.sqrt(idealChars / len)));
}

// ---------------------------------------------------------------- komponen

export interface SlideProps {
  brand: Brand;
  slide: Slide;
  template: TemplateKey;
  index: number;
  total: number;
  logos: { onDark: LogoImg | null; onLight: LogoImg | null };
}

export type LogoImg = { src: string; width: number; height: number };

export function SlideView({ brand, slide, template, index, total, logos }: SlideProps) {
  const t = themeFor(brand, template, slide.layout);
  const logo = t.dark ? logos.onDark ?? logos.onLight : logos.onLight ?? logos.onDark;
  const headline = clean(slide.headline);
  const body = clean(slide.body);
  const kicker = clean(slide.kicker);
  const stat = clean(slide.stat);
  const isLast = index === total - 1;

  return (
    <div
      style={{
        width: CANVAS.width,
        height: CANVAS.height,
        display: "flex",
        flexDirection: "column",
        background: t.bg,
        color: t.fg,
        fontFamily: "Body",
        padding: "72px 84px",
        position: "relative",
      }}
    >
      {/* dekorasi */}
      <div
        style={{
          position: "absolute",
          right: -180,
          top: -180,
          width: 520,
          height: 520,
          borderRadius: 9999,
          background: t.dark ? alpha("#FFFFFF", 0.06) : alpha(t.accent, 0.1),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: CANVAS.width,
          height: 14,
          background: t.accent,
        }}
      />

      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {logo ? (
          <img src={logo.src} width={logo.width} height={logo.height} />
        ) : (
          <div style={{ fontFamily: "Heading", fontWeight: 800, fontSize: 40, letterSpacing: -1 }}>
            {brand.name}
          </div>
        )}
        {total > 1 ? (
          <div style={{ fontSize: 28, color: t.muted, fontWeight: 500 }}>
            {`${index + 1}/${total}`}
          </div>
        ) : (
          <div />
        )}
      </div>

      {/* isi */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
        {slide.layout === "cover" && (
          <Cover t={t} kicker={kicker} headline={headline} body={body} />
        )}
        {slide.layout === "point" && (
          <Point t={t} kicker={kicker} headline={headline} body={body} />
        )}
        {slide.layout === "stat" && (
          <Stat t={t} kicker={kicker} headline={headline} body={body} stat={stat} />
        )}
        {slide.layout === "quote" && <Quote t={t} headline={headline} body={body} />}
        {slide.layout === "cta" && <Cta t={t} headline={headline} body={body} />}
      </div>

      {/* footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 28, color: t.muted }}>
        <div>{brand.handle}</div>
        {total > 1 && !isLast ? (
          <div style={{ display: "flex", fontWeight: 700, color: t.accent }}>Geser ›</div>
        ) : (
          <div>{brand.website}</div>
        )}
      </div>
    </div>
  );
}

type Part = { t: Theme; kicker?: string; headline: string; body: string };

function Kicker({ t, text }: { t: Theme; text: string }) {
  if (!text) return null;
  return (
    <div style={{ display: "flex", marginBottom: 36 }}>
      <div
        style={{
          background: t.pillBg,
          color: t.pillFg,
          fontSize: 30,
          fontWeight: 700,
          padding: "12px 28px",
          borderRadius: 9999,
          textTransform: "uppercase",
          letterSpacing: 2,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function Cover({ t, kicker, headline, body }: Part) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <Kicker t={t} text={kicker ?? ""} />
      <div
        style={{
          fontFamily: "Heading",
          fontWeight: 800,
          fontSize: fit(headline, 112, 64, 34),
          lineHeight: 1.05,
          letterSpacing: -2,
        }}
      >
        {headline}
      </div>
      {body ? (
        <div style={{ fontSize: fit(body, 40, 30, 80), marginTop: 40, color: t.muted, lineHeight: 1.35 }}>
          {body}
        </div>
      ) : null}
    </div>
  );
}

function Point({ t, kicker, headline, body }: Part) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {kicker ? (
        <div style={{ fontFamily: "Heading", fontWeight: 800, fontSize: 44, color: t.accent, marginBottom: 24 }}>
          {kicker}
        </div>
      ) : null}
      <div
        style={{
          fontFamily: "Heading",
          fontWeight: 800,
          fontSize: fit(headline, 84, 56, 40),
          lineHeight: 1.1,
          letterSpacing: -1.5,
        }}
      >
        {headline}
      </div>
      <div style={{ width: 120, height: 10, background: t.accent, borderRadius: 9999, margin: "44px 0" }} />
      {body ? (
        <div style={{ fontSize: fit(body, 44, 32, 110), lineHeight: 1.4, color: t.muted }}>{body}</div>
      ) : null}
    </div>
  );
}

function Stat({ t, kicker, headline, body, stat }: Part & { stat: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <Kicker t={t} text={kicker ?? ""} />
      <div
        style={{
          fontFamily: "Heading",
          fontWeight: 800,
          fontSize: fit(stat || "—", 240, 120, 5),
          lineHeight: 1,
          color: t.accent,
          letterSpacing: -6,
        }}
      >
        {stat || "—"}
      </div>
      <div
        style={{
          fontFamily: "Heading",
          fontWeight: 700,
          fontSize: fit(headline, 68, 48, 50),
          lineHeight: 1.15,
          marginTop: 32,
        }}
      >
        {headline}
      </div>
      {body ? (
        <div style={{ fontSize: fit(body, 40, 30, 110), lineHeight: 1.4, color: t.muted, marginTop: 28 }}>
          {body}
        </div>
      ) : null}
    </div>
  );
}

function Quote({ t, headline, body }: Part) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ fontFamily: "Heading", fontWeight: 800, fontSize: 240, lineHeight: 0.8, color: t.accent, height: 150 }}>
        “
      </div>
      <div
        style={{
          fontFamily: "Heading",
          fontWeight: 700,
          fontSize: fit(headline, 80, 52, 60),
          lineHeight: 1.2,
          letterSpacing: -1,
        }}
      >
        {headline}
      </div>
      {body ? (
        <div style={{ fontSize: 36, marginTop: 44, color: t.muted, fontWeight: 500 }}>{`— ${body}`}</div>
      ) : null}
    </div>
  );
}

function Cta({ t, headline, body }: Part) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <div
        style={{
          fontFamily: "Heading",
          fontWeight: 800,
          fontSize: fit(headline, 100, 60, 36),
          lineHeight: 1.08,
          letterSpacing: -2,
        }}
      >
        {headline}
      </div>
      {body ? (
        <div
          style={{
            display: "flex",
            marginTop: 56,
            background: t.pillBg,
            color: t.pillFg,
            fontSize: 40,
            fontWeight: 700,
            padding: "22px 44px",
            borderRadius: 9999,
          }}
        >
          {body}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 28, marginTop: 64, fontSize: 30, color: t.muted }}>
        <div>Like</div>
        <div>•</div>
        <div>Share</div>
        <div>•</div>
        <div>Save</div>
      </div>
    </div>
  );
}
