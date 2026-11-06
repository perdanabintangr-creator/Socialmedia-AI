"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { VISUAL_STYLES, VISUAL_STYLE_KEYS, type VisualStyleKey } from "@/lib/types";

export type StyleChoice = VisualStyleKey | "auto";

/** Miniatur postingan per gaya (CSS murni, tanpa foto pihak lain). */
function Thumb({ k }: { k: StyleChoice }) {
  const box = "relative h-[70px] w-[56px] shrink-0 overflow-hidden rounded-lg ring-1 ring-black/5";
  const bar = (w: string, c: string, h = "h-[4px]") => <span className={`block ${h} ${w} rounded-full ${c}`} />;
  switch (k) {
    case "auto":
      return (
        <span className={`${box} bg-social grid place-items-center text-white`}>
          <Sparkles size={20} />
        </span>
      );
    case "brand":
      return (
        <span className={`${box} bg-gradient-to-b from-brand-500 to-brand-700`}>
          <span className="absolute left-1.5 top-1.5 h-2 w-2 rounded-sm bg-white/90" />
          <span className="absolute inset-x-1.5 top-6 h-[22px] rounded-md bg-white/25" />
          <span className="absolute inset-x-1.5 bottom-2 space-y-1">{bar("w-10", "bg-white")}{bar("w-7", "bg-white/70")}</span>
        </span>
      );
    case "berita":
      return (
        <span className={`${box} bg-[#0B0B0D]`}>
          <span className="absolute inset-x-0 top-0 h-[40px] bg-gradient-to-br from-slate-400 via-stone-500 to-slate-700" />
          <span className="absolute inset-x-0 top-[26px] h-[16px] bg-gradient-to-b from-transparent to-[#0B0B0D]" />
          <span className="absolute inset-x-1.5 bottom-2 flex flex-col items-center gap-[3px]">
            {bar("w-11", "bg-white", "h-[3px]")}
            {bar("w-9", "bg-yellow-300", "h-[3px]")}
            {bar("w-10", "bg-white", "h-[3px]")}
          </span>
        </span>
      );
    case "info":
      return (
        <span className={`${box} bg-white`}>
          <span className="absolute inset-x-0 top-0 h-[32px] bg-gradient-to-br from-emerald-300 via-teal-500 to-sky-600" />
          <span className="absolute left-1 top-1 h-3 w-3 rounded-full bg-white shadow" />
          <span className="absolute inset-x-1.5 top-[37px] space-y-[3px]">
            {bar("w-11", "bg-slate-800", "h-[3px]")}
            {bar("w-10", "bg-slate-800", "h-[3px]")}
            {bar("w-7", "bg-slate-800", "h-[3px]")}
          </span>
        </span>
      );
    case "editorial":
      return (
        <span className={`${box} bg-gradient-to-b from-sky-200 via-rose-200 to-amber-200`}>
          <span className="absolute left-1/2 top-2 h-[30px] w-[26px] -translate-x-1/2 rounded-full bg-gradient-to-b from-amber-100 to-orange-200" />
          <span className="absolute inset-x-0 bottom-3 text-center font-serif text-[13px] font-bold italic leading-none text-white drop-shadow">Aa</span>
          <span className="absolute bottom-1 left-1/2 h-[5px] w-6 -translate-x-1/2 rounded-full bg-white" />
        </span>
      );
    case "kreatif":
      return (
        <span className={`${box} bg-gradient-to-b from-sky-400 to-sky-200`}>
          <span className="absolute inset-x-1.5 top-2 space-y-[3px]">{bar("w-11", "bg-white", "h-[5px]")}{bar("w-8", "bg-white", "h-[5px]")}</span>
          <span className="absolute left-1.5 top-[3px] text-[10px] font-bold italic text-lime-300 [font-family:cursive]">wow</span>
          <span className="absolute bottom-2 left-1/2 h-6 w-6 -translate-x-1/2 rotate-12 rounded-lg bg-gradient-to-br from-fuchsia-400 to-indigo-500 shadow-md" />
          <span className="absolute bottom-1 left-1 h-3 w-7 rounded-full bg-white/80" />
        </span>
      );
    case "promo":
      return (
        <span className={`${box} bg-gradient-to-b from-pop to-sun`}>
          <span className="absolute left-1.5 top-2 space-y-[3px]">{bar("w-7", "bg-white", "h-[5px]")}{bar("w-5", "bg-white", "h-[5px]")}</span>
          <span className="absolute right-1 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-yellow-300 text-[7px] font-black text-slate-900">%</span>
          <span className="absolute inset-x-2 bottom-0 h-[26px] rounded-t-full bg-white/35" />
          <span className="absolute bottom-1.5 left-1.5 h-[6px] w-6 rounded-full bg-slate-900" />
        </span>
      );
  }
}

const OPTIONS: { key: StyleChoice; label: string; desc: string }[] = [
  { key: "auto", label: "Otomatis", desc: "AI memilih gaya terbaik untuk tiap konten, mengikuti Brand Kit." },
  ...VISUAL_STYLE_KEYS.map((k) => ({ key: k, label: VISUAL_STYLES[k].label, desc: VISUAL_STYLES[k].desc })),
];

/** Pilihan "arah visual" berbentuk kartu miniatur postingan. */
export function StylePicker({
  value,
  onChange,
  compact = false,
  autoLabel,
}: {
  value: StyleChoice;
  onChange: (v: StyleChoice) => void;
  compact?: boolean;
  autoLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label="Arah visual" className={compact ? "scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0" : "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"}>
      {OPTIONS.map((o) => {
        const on = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.desc}
            onClick={() => onChange(o.key)}
            className={`relative flex items-center gap-2.5 rounded-2xl p-1.5 pr-3 text-left transition ${compact ? "w-[176px] shrink-0 lg:w-auto" : ""} ${
              on ? "bg-brand-50 ring-2 ring-brand-500" : "bg-white ring-1 ring-line hover:ring-slate-300"
            }`}
          >
            <Thumb k={o.key} />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold leading-tight text-ink">{o.key === "auto" && autoLabel ? autoLabel : o.label}</span>
              <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-slate-500">{o.key === "auto" ? "AI pilihkan" : VISUAL_STYLES[o.key].example}</span>
            </span>
            {on && (
              <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-brand-600 text-white">
                <Check size={10} strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Versi form (Brand Kit): kartu + input tersembunyi. */
export function StylePickerField({ name, defaultValue }: { name: string; defaultValue: StyleChoice }) {
  const [v, setV] = useState<StyleChoice>(defaultValue);
  const desc = OPTIONS.find((o) => o.key === v)?.desc;
  return (
    <div>
      <input type="hidden" name={name} value={v} />
      <StylePicker value={v} onChange={setV} />
      {desc && <p className="mt-2 text-xs text-slate-500">{desc}</p>}
    </div>
  );
}
