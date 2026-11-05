"use client";

import { useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Link2, Loader2, Plus } from "lucide-react";
import { ActionForm, Submit } from "@/components/forms";
import { addLinkAction } from "@/app/insight-actions";

// ---------------------------------------------------------------- ikon platform

export function TikTokGlyph({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.6 3c.3 2.2 1.7 3.8 3.9 4v3.1c-1.4.1-2.7-.3-3.9-1v6.1c0 3.7-3.1 6.2-6.5 5.7-2.4-.4-4.3-2.4-4.6-4.8-.4-3.4 2.4-6.4 5.8-6.2v3.2c-.3-.1-.7-.1-1-.1-1.4.1-2.4 1.4-2.2 2.8.2 1.1 1.1 2 2.2 2.1 1.5.1 2.7-1 2.7-2.5V3h3.6Z" />
    </svg>
  );
}

export function InstagramGlyph({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export const PLATFORM_STYLE = {
  tiktok: { label: "TikTok", chip: "bg-ink text-white", ring: "from-cyan-400 via-ink to-rose-500" },
  instagram: { label: "Instagram", chip: "bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600 text-white", ring: "from-amber-400 via-pink-500 to-violet-600" },
} as const;

export function PlatformChip({ platform, size = "sm" }: { platform: "tiktok" | "instagram"; size?: "sm" | "md" }) {
  const s = PLATFORM_STYLE[platform];
  const Icon = platform === "tiktok" ? TikTokGlyph : InstagramGlyph;
  return (
    <span className={`inline-grid shrink-0 place-items-center rounded-full ${s.chip} ${size === "md" ? "h-8 w-8" : "h-6 w-6"}`} title={s.label}>
      <Icon size={size === "md" ? 16 : 13} />
      <span className="sr-only">{s.label}</span>
    </span>
  );
}

// ---------------------------------------------------------------- gambar dengan cadangan

export function Thumb({ src, platform, className = "" }: { src: string | null; platform: "tiktok" | "instagram"; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span className={`grid place-items-center bg-gradient-to-br ${PLATFORM_STYLE[platform].ring} text-white/90 ${className}`}>
        {platform === "tiktok" ? <TikTokGlyph size={22} /> : <InstagramGlyph size={22} />}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className={`object-cover ${className}`} />;
}

// ---------------------------------------------------------------- input link

function detect(v: string): "tiktok" | "instagram" | null {
  if (/tiktok\.com/i.test(v)) return "tiktok";
  if (/instagram\.com|instagr\.am/i.test(v)) return "instagram";
  return null;
}

export function AddLinkForm() {
  const [value, setValue] = useState("");
  const platform = detect(value);
  return (
    <ActionForm action={addLinkAction} resetOnOk>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex min-w-0 flex-1 items-center">
          <span className="sr-only">Link TikTok atau Instagram</span>
          <span className="pointer-events-none absolute left-3">
            {platform ? <PlatformChip platform={platform} /> : <Link2 size={18} className="ml-0.5 text-slate-400" />}
          </span>
          <input
            name="url"
            inputMode="url"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Tempel link postingan, reels, video, atau profil…"
            className="w-full rounded-2xl border-0 bg-white py-3.5 pr-4 pl-12 text-[15px] ring-1 ring-line transition placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
        </label>
        <Submit variant="primary" pendingText="Membaca…" className="rounded-2xl! px-6 py-3.5">
          <Plus size={17} /> Pantau
        </Submit>
      </div>
    </ActionForm>
  );
}

// ---------------------------------------------------------------- grafik tren (satu seri)

export interface TrendPoint {
  label: string; // tanggal tampilan
  value: number;
}

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));
const fmtCompact = (n: number) => new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/** Garis tren dengan crosshair + tooltip. Satu seri: judul kartu yang menamainya, tanpa legenda. */
export function TrendChart({ points, unit }: { points: TrendPoint[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const { min, max, ticks } = useMemo(() => {
    const vals = points.map((p) => p.value);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (hi === lo) {
      hi += Math.max(1, hi * 0.1);
      lo = Math.max(0, lo - Math.max(1, lo * 0.1));
    }
    const pad = (hi - lo) * 0.12;
    lo = Math.max(0, lo - pad);
    hi = hi + pad;
    return { min: lo, max: hi, ticks: [hi, (hi + lo) / 2, lo] };
  }, [points]);

  const x = (i: number) => (points.length === 1 ? 50 : (i / (points.length - 1)) * 100);
  const y = (v: number) => 100 - ((v - min) / (max - min)) * 100;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const area = `${line} L100,100 L0,100 Z`;
  const h = hover === null ? null : points[hover];

  const onMove = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    setHover(Math.round(t * (points.length - 1)));
  };

  return (
    <figure>
      <div className="flex gap-3">
        <div className="flex h-48 flex-col justify-between py-0 text-right text-[11px] text-slate-400 tabular-nums" aria-hidden="true">
          {ticks.map((t, i) => (
            <span key={i} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {fmtCompact(t)}
            </span>
          ))}
        </div>
        <div
          ref={box}
          className="relative h-48 flex-1 touch-pan-y"
          onMouseMove={(e) => onMove(e.clientX)}
          onMouseLeave={() => setHover(null)}
          onTouchStart={(e) => onMove(e.touches[0].clientX)}
          onTouchMove={(e) => onMove(e.touches[0].clientX)}
          onTouchEnd={() => setHover(null)}
          role="img"
          aria-label={`Grafik ${unit}: dari ${fmt(points[0].value)} ke ${fmt(points.at(-1)!.value)}`}
        >
          {/* garis bantu: tipis & samar */}
          {[0, 50, 100].map((t) => (
            <span key={t} className="absolute inset-x-0 border-t border-dashed border-slate-200" style={{ top: `${t}%` }} />
          ))}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            <defs>
              <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#trend-fill)" />
            <path d={line} fill="none" stroke="var(--color-brand-600)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          {/* titik terakhir diberi label langsung */}
          <span
            className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600 ring-2 ring-white"
            style={{ left: `${x(points.length - 1)}%`, top: `${y(points.at(-1)!.value)}%` }}
          />
          {h && hover !== null && (
            <>
              <span className="pointer-events-none absolute inset-y-0 w-px bg-slate-300" style={{ left: `${x(hover)}%` }} />
              <span
                className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600 ring-2 ring-white"
                style={{ left: `${x(hover)}%`, top: `${y(h.value)}%` }}
              />
              <span
                className="pointer-events-none absolute -top-2 z-10 -translate-y-full rounded-xl bg-ink px-3 py-2 text-xs whitespace-nowrap text-white shadow-lift"
                style={{ left: `${x(hover)}%`, transform: `translate(${x(hover) > 70 ? "-100%" : x(hover) < 30 ? "0" : "-50%"}, -100%)` }}
              >
                <span className="block text-white/60">{h.label}</span>
                <span className="font-bold tabular-nums">
                  {fmt(h.value)} {unit}
                </span>
              </span>
            </>
          )}
        </div>
      </div>
      <figcaption className="mt-2 flex justify-between pl-10 text-[11px] text-slate-400">
        <span>{points[0].label}</span>
        <span>{points.at(-1)!.label}</span>
      </figcaption>
    </figure>
  );
}

/** Garis mini tanpa sumbu: arah tren per konten. */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const d = values.map((v, i) => `${i ? "L" : "M"}${(i / (values.length - 1)) * 100},${100 - ((v - lo) / span) * 100}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-6 w-16 overflow-visible" aria-hidden="true">
      <path d={d} fill="none" stroke="var(--color-brand-500)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

export function Spinner() {
  return <Loader2 size={15} className="animate-spin" />;
}

/** Tombol kirim untuk <form action={serverAction}> biasa, dengan status memuat. */
export function FormButton({
  children,
  pendingText,
  className = "",
  label,
}: {
  children: React.ReactNode;
  pendingText?: React.ReactNode;
  className?: string;
  label?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-label={label} title={label} className={`disabled:cursor-wait disabled:opacity-60 ${className}`}>
      {pending ? (pendingText ?? <Spinner />) : children}
    </button>
  );
}
