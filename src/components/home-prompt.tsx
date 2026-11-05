"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, CalendarCheck, Images, Lightbulb, Loader2, Megaphone, Sparkles } from "lucide-react";
import { startChatAction } from "@/app/studio-actions";

const FORMATS = [
  { key: "carousel", label: "Carousel", hint: " (format carousel)" },
  { key: "single", label: "Single post", hint: " (format single post)" },
] as const;

const ACTIONS = [
  { icon: Lightbulb, title: "Ide konten", desc: "5 ide minggu ini sesuai brand", prompt: "Buatkan 5 ide konten minggu ini", send: true },
  { icon: Images, title: "Bikin carousel", desc: "Carousel edukasi 5–8 slide", prompt: "Bikin carousel tentang ", send: false },
  { icon: Megaphone, title: "Promo produk", desc: "Single post promo siap posting", prompt: "Bikin single post promo untuk ", send: false },
  { icon: CalendarCheck, title: "Cek jadwal", desc: "Lihat yang akan tayang", prompt: "Apa jadwal posting minggu ini?", send: true },
];

/** Kotak perintah besar di Beranda: setiap kiriman membuka percakapan baru. */
export function HomePrompt() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [format, setFormat] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = (raw: string) => {
    const msg = raw.trim();
    if (!msg || pending) return;
    const hint = FORMATS.find((f) => f.key === format)?.hint ?? "";
    setError(null);
    start(async () => {
      const res = await startChatAction(msg + hint);
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
        className="rounded-3xl bg-white p-3 shadow-lift ring-1 ring-line transition focus-within:ring-2 focus-within:ring-brand-400"
      >
        <div className="flex gap-3 px-2 pt-1">
          <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white">
            <Sparkles size={16} />
          </span>
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit(text);
              }
            }}
            rows={2}
            autoFocus
            aria-label="Ceritakan kebutuhan kontenmu"
            placeholder="Ceritakan kebutuhan kontenmu, mis. “buatkan carousel promo beli 2 gratis 1 untuk akhir bulan”"
            className="min-h-[60px] flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-relaxed outline-none placeholder:text-slate-400 focus-visible:outline-none"
          />
        </div>
        <div className="mt-2 flex items-center gap-2 pl-12">
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
            disabled={!text.trim() || pending}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink/85 disabled:opacity-30"
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />} Kirim
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      <p className="mt-10 mb-4 text-center text-sm font-semibold text-slate-500">Atau pilih salah satu</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ACTIONS.map(({ icon: Icon, title, desc, prompt, send }) => (
          <button
            key={title}
            type="button"
            disabled={pending}
            onClick={() => {
              if (send) return submit(prompt);
              setText(prompt);
              ref.current?.focus();
            }}
            className="group flex flex-col items-start rounded-2xl bg-white p-4 text-left shadow-soft ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-lift hover:ring-brand-200 disabled:opacity-60"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
              <Icon size={19} />
            </span>
            <div className="mt-4 font-bold">{title}</div>
            <div className="mt-0.5 text-sm text-slate-500">{desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
