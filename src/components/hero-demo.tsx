"use client";

import { useEffect, useState } from "react";
import { Check, Palette, PenLine, Send } from "lucide-react";

const SCENES = [
  {
    ask: "Bikin carousel promo beli 2 gratis 1 buat akhir bulan ya",
    replies: [
      { who: "Kata", text: "Siap! Hook-nya: “Akhir bulan, dompet aman.” 6 slide + caption sudah jadi." },
      { who: "Rupa", text: "Desain sudah kurapikan pakai warna & logo brand kamu." },
      { who: "Siar", text: "Terjadwal Jumat 19.00 ke Instagram & TikTok." },
    ],
  },
  {
    ask: "Kasih 5 ide konten minggu ini dong",
    replies: [
      { who: "Kata", text: "Ini 5 ide: 2 edukasi, 1 behind the scenes, 2 promo. Pilih yang kamu suka." },
      { who: "Rupa", text: "Ide nomor 3 cocok pakai foto produk kamu. Mau langsung kubuatkan?" },
    ],
  },
  {
    ask: "Hook slide pertama kurang nendang, ganti ya",
    replies: [
      { who: "Kata", text: "Sudah kuganti: “3 kesalahan yang bikin kopi kamu pahit.”" },
      { who: "Rupa", text: "Cover juga kuperbarui. Cek di preview HP ya!" },
    ],
  },
];

const AGENT = {
  Kata: { icon: PenLine, tone: "from-amber-300 to-orange-400" },
  Rupa: { icon: Palette, tone: "from-brand-400 to-brand-600" },
  Siar: { icon: Send, tone: "from-sky-400 to-blue-600" },
} as const;

/** Demo percakapan di hero: pertanyaan diketik, lalu tim AI menjawab bergantian. */
export function HeroDemo() {
  const [scene, setScene] = useState(0);
  const [typed, setTyped] = useState(0);
  const [shown, setShown] = useState(0);
  const s = SCENES[scene];

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTyped(s.ask.length);
      setShown(s.replies.length);
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    if (typed < s.ask.length) t = setTimeout(() => setTyped((n) => n + 1), 32);
    else if (shown < s.replies.length) t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 700 : 1100);
    else
      t = setTimeout(() => {
        setScene((n) => (n + 1) % SCENES.length);
        setTyped(0);
        setShown(0);
      }, 3200);
    return () => clearTimeout(t);
  }, [typed, shown, s]);

  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-label="Contoh percakapan dengan tim AI" role="img">
      <div className="pointer-events-none absolute -inset-6 rounded-[40px] bg-gradient-to-br from-brand-200/60 via-white/0 to-sky-200/50 blur-2xl" />
      <div className="relative overflow-hidden rounded-3xl bg-white/90 shadow-lift ring-1 ring-line backdrop-blur">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="ml-2 text-xs font-semibold text-slate-400">Kasih arahan, tim AI yang kerjakan</span>
        </div>
        <div className="flex h-[340px] flex-col gap-3 p-4 sm:p-5">
          <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-3 text-sm leading-relaxed text-white">
            {s.ask.slice(0, typed)}
            {typed < s.ask.length && <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-white align-middle" />}
          </div>
          {s.replies.slice(0, shown).map((r, i) => {
            const a = AGENT[r.who as keyof typeof AGENT];
            const Icon = a.icon;
            const last = scene === 0 && i === 2;
            return (
              <div key={`${scene}-${i}`} className="flex animate-fade-up items-start gap-2.5">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white ${a.tone}`}>
                  <Icon size={15} />
                </span>
                <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-slate-50 px-3.5 py-2.5 text-sm leading-relaxed ring-1 ring-line">
                  <div className="text-[11px] font-bold text-slate-400">{r.who}</div>
                  {r.text}
                  {last && (
                    <span className="mt-2 flex w-fit items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white">
                      <Check size={12} /> ACC
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-center gap-1.5 pb-4">
          {SCENES.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === scene ? "w-6 bg-brand-600" : "w-1.5 bg-slate-300"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
