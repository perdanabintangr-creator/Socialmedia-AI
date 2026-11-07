"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, CalendarCheck, CalendarRange, Stethoscope, Images, Lightbulb, Loader2, Megaphone, Sparkles, TrendingUp } from "lucide-react";
import { startChatAction } from "@/app/studio-actions";
import { AttachButton, DropOverlay, PinHint, RefTray, useReferences } from "@/components/reference-input";
import { StylePicker, type StyleChoice } from "@/components/style-picker";
import { VISUAL_STYLES } from "@/lib/types";

const FORMATS = [
  { key: "carousel", label: "Carousel", hint: " (format carousel)" },
  { key: "single", label: "Single post", hint: " (format single post)" },
] as const;

const ACTIONS = [
  { icon: Lightbulb, title: "Ide konten", desc: "5 ide minggu ini sesuai brand", prompt: "Buatkan 5 ide konten minggu ini", send: true, tint: "from-amber-100 to-orange-50 text-orange-600" },
  { icon: Images, title: "Carousel", desc: "Carousel edukasi 5–8 slide", prompt: "Bikin carousel tentang ", send: false, tint: "from-brand-100 to-brand-50 text-brand-600" },
  { icon: Megaphone, title: "Promo", desc: "Single post promo siap posting", prompt: "Bikin single post promo untuk ", send: false, tint: "from-pink-100 to-rose-50 text-pop" },
  { icon: CalendarCheck, title: "Jadwal", desc: "Lihat yang akan tayang", prompt: "Apa jadwal posting minggu ini?", send: true, tint: "from-sky-100 to-cyan-50 text-sky-600" },
];

/** Kotak perintah besar di Beranda: setiap kiriman membuka percakapan baru. */
export function HomePrompt({ defaultStyle = "auto" }: { defaultStyle?: StyleChoice }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [format, setFormat] = useState<string | null>(null);
  const [style, setStyle] = useState<StyleChoice>(defaultStyle);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);
  const refs = useReferences();

  const submit = (raw: string) => {
    const msg = raw.trim();
    if ((!msg && !refs.items.length) || pending) return;
    const hint = FORMATS.find((f) => f.key === format)?.hint ?? "";
    setError(null);
    const fd = new FormData();
    fd.set("text", msg ? msg + hint : hint ? `Buatkan konten yang mirip dengan referensi ini${hint}` : "");
    refs.appendTo(fd);
    if (style !== "auto") fd.set("style", style);
    start(async () => {
      const res = await startChatAction(fd);
      if (!res.ok || !res.chatId) return setError(res.error ?? "Gagal memulai percakapan");
      router.push(`/chat/${res.chatId}`);
    });
  };

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
        {...refs.dropZone}
        className="relative rounded-3xl bg-white p-3 shadow-lift ring-1 ring-line transition focus-within:ring-2 focus-within:ring-brand-400"
      >
        <DropOverlay show={refs.dragging} />
        <div className="flex gap-3 px-2 pt-1">
          <span className="bg-social mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white">
            <Sparkles size={16} />
          </span>
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={refs.onPaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit(text);
              }
            }}
            rows={2}
            autoFocus
            aria-label="Ceritakan kebutuhan kontenmu"
            placeholder="Ceritakan kebutuhan kontenmu, mis. “buatkan carousel promo beli 2 gratis 1”. Punya contoh desain? Tempel gambar (Ctrl+V), seret ke sini, atau tempel link Pinterest."
            className="min-h-[60px] flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-relaxed outline-none placeholder:text-slate-400 focus-visible:outline-none"
          />
        </div>
        {(refs.items.length > 0 || refs.note) && (
          <div className="mt-2 pl-12">
            <RefTray refs={refs} />
          </div>
        )}
        <div className="pl-12 empty:hidden">
          <PinHint text={text} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-12">
          <AttachButton refs={refs} />
          {FORMATS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={format === f.key}
              onClick={() => setFormat(format === f.key ? null : f.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${format === f.key ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200" : "text-slate-500 ring-1 ring-line hover:text-ink"}`}
            >
              {f.label}
            </button>
          ))}
          <button
            type="submit"
            disabled={(!text.trim() && !refs.items.length) || pending}
            className="bg-social ml-auto inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:brightness-105 disabled:opacity-30 disabled:saturate-0"
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />} Kirim
          </button>
        </div>
      </form>
      <div className="mt-4">
        <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Arah visual</p>
          <p className="truncate text-xs text-slate-400">
            {style === "auto" ? "AI pilihkan gaya terbaik" : VISUAL_STYLES[style].desc}
          </p>
        </div>
        <StylePicker value={style} onChange={setStyle} compact />
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      {/* Aksi cepat sebagai "story" */}
      <div className="scrollbar-none -mx-4 mt-8 flex justify-start gap-5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:justify-center sm:gap-8 sm:px-0">
        {ACTIONS.map(({ icon: Icon, title, desc, prompt, send, tint }) => (
          <button
            key={title}
            type="button"
            disabled={pending}
            aria-label={`${title}: ${desc}`}
            title={desc}
            onClick={() => {
              if (send) return submit(prompt);
              setText(prompt);
              ref.current?.focus();
            }}
            className="group flex w-[72px] shrink-0 flex-col items-center gap-2 disabled:opacity-60"
          >
            <span className="story-ring transition group-hover:scale-105 group-active:scale-95">
              <span className={`grid h-16 w-16 place-items-center bg-gradient-to-br ${tint}`}>
                <Icon size={24} />
              </span>
            </span>
            <span className="text-xs font-semibold text-slate-600 group-hover:text-ink">{title}</span>
          </button>
        ))}
        <Link href="/acc#rencana" aria-label="Autopilot: ide seminggu atau sebulan, konten dibuat dan dijadwalkan otomatis" className="group flex w-[72px] shrink-0 flex-col items-center gap-2">
          <span className="story-ring transition group-hover:scale-105 group-active:scale-95">
            <span className="grid h-16 w-16 place-items-center bg-gradient-to-br from-violet-100 to-fuchsia-50 text-violet-600">
              <CalendarRange size={24} />
            </span>
          </span>
          <span className="text-xs font-semibold text-slate-600 group-hover:text-ink">Autopilot</span>
        </Link>
        <Link href="/audit" aria-label="Audit: konsultan AI menilai akun IG/TikTok kamu" className="group flex w-[72px] shrink-0 flex-col items-center gap-2">
          <span className="story-ring transition group-hover:scale-105 group-active:scale-95">
            <span className="grid h-16 w-16 place-items-center bg-gradient-to-br from-rose-100 to-orange-50 text-rose-600">
              <Stethoscope size={24} />
            </span>
          </span>
          <span className="text-xs font-semibold text-slate-600 group-hover:text-ink">Audit</span>
        </Link>
        <Link href="/performa" aria-label="Performa: cek likes dan komentar" className="group flex w-[72px] shrink-0 flex-col items-center gap-2">
          <span className="story-ring transition group-hover:scale-105 group-active:scale-95">
            <span className="grid h-16 w-16 place-items-center bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-600">
              <TrendingUp size={24} />
            </span>
          </span>
          <span className="text-xs font-semibold text-slate-600 group-hover:text-ink">Performa</span>
        </Link>
      </div>
    </div>
  );
}
