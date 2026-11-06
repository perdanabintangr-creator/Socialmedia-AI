"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarRange, Check, CheckCheck, ExternalLink, Loader2, MessageSquareText, Send, Sparkles, Wand2, X } from "lucide-react";
import {
  accAction,
  accManyAction,
  autoReviseAction,
  chatReviseAction,
  rejectAction,
  resumeBatchAction,
  setPlannedAction,
  startMonthPlanAction,
  type AccResult,
} from "@/app/acc-actions";
import { StylePicker, type StyleChoice } from "@/components/style-picker";
import type { BatchProgress } from "@/lib/month";

export interface AccItem {
  id: string;
  title: string;
  format: "single" | "carousel";
  slides: number;
  caption: string;
  notes: string | null;
  status: string;
  error: string | null;
  revisions: number;
  revising: boolean;
  plannedLocal: string | null;
  version: string;
}

const COUNTS = [8, 12, 20, 30];

/** Muat ulang data berkala selama ada pekerjaan AI berjalan. */
function useAutoRefresh(active: boolean, ms = 6000) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), ms);
    return () => clearInterval(id);
  }, [active, ms, router]);
}

function Toast({ res, onClose }: { res: AccResult | null; onClose: () => void }) {
  useEffect(() => {
    if (!res) return;
    const id = setTimeout(onClose, 6000);
    return () => clearTimeout(id);
  }, [res, onClose]);
  if (!res?.message) return null;
  return (
    <div
      role="status"
      className={`fixed bottom-24 left-1/2 z-50 max-w-[92vw] -translate-x-1/2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-lift ring-1 lg:bottom-8 ${
        res.ok ? "bg-ink text-white ring-black/10" : "bg-red-50 text-red-700 ring-red-200"
      }`}
    >
      {res.message}
    </div>
  );
}

// ------------------------------------------------------------------ Konten sebulan

export function MonthPlan({
  progress,
  quotaLeft,
  planLabel,
  defaultStyle,
  failed,
  compact = false,
}: {
  progress: BatchProgress | null;
  quotaLeft: number;
  planLabel: string;
  defaultStyle: StyleChoice;
  failed: { title: string; error: string }[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(!compact);
  const [count, setCount] = useState(() => COUNTS.find((c) => c <= quotaLeft && c >= 12) ?? Math.min(12, Math.max(1, quotaLeft)));
  const [brief, setBrief] = useState("");
  const [style, setStyle] = useState<StyleChoice>(defaultStyle);
  const [res, setRes] = useState<AccResult | null>(null);
  const [pending, start] = useTransition();
  const resumed = useRef(false);
  const running = Boolean(progress?.running);
  useAutoRefresh(running, 8000);

  // Antrean terhenti (fungsi sebelumnya terputus): lanjutkan otomatis sekali.
  useEffect(() => {
    if (progress?.stalled && !resumed.current) {
      resumed.current = true;
      void resumeBatchAction();
    }
  }, [progress?.stalled]);

  if (running && progress) {
    const pct = Math.round((progress.done / Math.max(1, progress.total)) * 100);
    return (
      <section id="bulanan" className="mb-8 overflow-hidden rounded-3xl bg-ink p-6 text-white shadow-lift">
        <div className="flex flex-wrap items-center gap-3">
          <span className="bg-social grid h-10 w-10 place-items-center rounded-2xl">
            <Loader2 size={18} className="animate-spin" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">Tim AI sedang membuat konten bulananmu</p>
            <p className="text-sm text-white/60">
              {progress.done} dari {progress.total} selesai{progress.failed ? ` · ${progress.failed} gagal` : ""}. Kamu bisa mulai ACC yang sudah jadi di bawah sambil menunggu.
            </p>
          </div>
          <span className="text-2xl font-extrabold tabular-nums">{pct}%</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="bg-social h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(4, pct)}%` }} />
        </div>
      </section>
    );
  }

  const max = Math.max(0, quotaLeft);
  if (!open) {
    return (
      <section id="bulanan" className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 pr-4 shadow-soft ring-1 ring-line">
        <span className="bg-social grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white">
          <CalendarRange size={16} />
        </span>
        <p className="min-w-0 flex-1 text-sm">
          <b className="text-ink">Konten sebulan, sekali klik</b>
          <span className="block text-slate-500">
            {progress?.total ? `Rencana terakhir: ${progress.done}/${progress.total} konten dibuat.` : "AI susun kalender 1 bulan + semua desainnya."}
          </span>
        </p>
        <button type="button" onClick={() => setOpen(true)} className="bg-social inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-soft hover:brightness-105">
          <Wand2 size={15} /> Buat rencana
        </button>
      </section>
    );
  }
  return (
    <section id="bulanan" className="mb-8 rounded-3xl bg-white p-5 shadow-soft ring-1 ring-line sm:p-6">
      <div className="flex flex-wrap items-start gap-3">
        <span className="bg-social grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white">
          <CalendarRange size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold tracking-tight text-ink">Konten sebulan, sekali klik</h2>
          <p className="text-sm text-slate-500">
            AI menyusun kalender 1 bulan (campuran edukasi, interaksi, testimoni, behind the scenes & promo), lalu membuat semua desain & caption-nya. Kamu tinggal ACC.
          </p>
        </div>
      </div>

      {progress && progress.total > 0 && !running && (
        <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-100">
          Rencana terakhir selesai: {progress.done} dari {progress.total} konten dibuat{progress.failed ? `, ${progress.failed} gagal` : ""}.
          {failed.length > 0 && <span className="block text-xs text-emerald-800/70">Gagal: {failed.slice(0, 3).map((f) => `“${f.title}” (${f.error})`).join(", ")}</span>}
        </p>
      )}

      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData();
          fd.set("count", String(count));
          fd.set("brief", brief);
          if (style !== "auto") fd.set("style", style);
          start(async () => {
            const r = await startMonthPlanAction(fd);
            setRes(r);
          });
        }}
      >
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Jumlah konten</p>
          <div className="flex flex-wrap gap-2">
            {COUNTS.map((c) => (
              <button
                key={c}
                type="button"
                disabled={c > max}
                aria-pressed={count === c}
                onClick={() => setCount(c)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${
                  count === c ? "bg-brand-50 text-brand-700 ring-2 ring-brand-500" : "bg-white text-slate-600 ring-1 ring-line hover:ring-slate-300"
                }`}
              >
                {c} konten
                <span className="ml-1 text-xs font-normal text-slate-400">· {c >= 30 ? "tiap hari" : `${Math.round((c / 30) * 7)}x/minggu`}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Sisa kuota paket {planLabel}: {quotaLeft >= 999 ? "tanpa batas" : `${quotaLeft} konten`}.
          </p>
        </div>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Fokus bulan ini (opsional)</span>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={2}
            placeholder="Mis. “bulan ini launching fitur baru tanggal 20, ada promo 12.12, perbanyak testimoni pelanggan”"
            className="w-full resize-none rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm ring-1 ring-line outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-400"
          />
        </label>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Arah visual</p>
          <StylePicker value={style} onChange={setStyle} compact />
        </div>
        <button
          type="submit"
          disabled={pending || max < 1}
          className="bg-social inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-soft transition hover:brightness-105 disabled:opacity-40"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
          {pending ? "Menyusun kalender…" : `Buatkan ${Math.min(count, max)} konten sebulan`}
        </button>
        {max < 1 && <p className="text-sm text-red-600">Kuota konten habis. Naik paket untuk membuat rencana bulanan.</p>}
      </form>
      <Toast res={res} onClose={() => setRes(null)} />
    </section>
  );
}

// ------------------------------------------------------------------ Daftar ACC

const QUICK = ["Hook lebih nendang", "Teks lebih singkat", "Ganti foto cover", "Warna lebih cerah", "Lebih formal", "Tambah CTA beli"];

export function AccList({ items, batchRunning }: { items: AccItem[]; batchRunning: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [res, setRes] = useState<AccResult | null>(null);
  const [bulk, startBulk] = useTransition();
  useAutoRefresh(items.some((i) => i.revising) && !batchRunning, 6000);

  const ready = items.filter((i) => !i.revising);
  const allOn = ready.length > 0 && ready.every((i) => selected.has(i.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  if (!items.length) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-line px-6 py-14 text-center">
        <CheckCheck className="mx-auto text-slate-300" size={36} />
        <p className="mt-3 font-bold text-ink">{batchRunning ? "Konten pertama sedang dibuat…" : "Semua konten sudah beres"}</p>
        <p className="mt-1 text-sm text-slate-500">
          {batchRunning ? "Begitu jadi, konten langsung muncul di sini." : "Buat konten sebulan di atas, atau minta konten baru lewat chat."}
        </p>
      </div>
    );
  }

  return (
    <section>
      <div className="sticky top-0 z-20 -mx-1 mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-canvas/90 px-1 py-2 backdrop-blur">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={allOn}
            onChange={() => setSelected(allOn ? new Set() : new Set(ready.map((i) => i.id)))}
            className="h-4 w-4 accent-brand-600"
          />
          Pilih semua ({items.length} menunggu ACC)
        </label>
        <button
          type="button"
          disabled={!selected.size || bulk}
          onClick={() =>
            startBulk(async () => {
              const r = await accManyAction([...selected]);
              setRes(r);
              setSelected(new Set());
            })
          }
          className="ml-auto inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-soft transition hover:bg-emerald-700 disabled:opacity-40"
        >
          {bulk ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />}
          ACC terpilih{selected.size ? ` (${selected.size})` : ""}
        </button>
      </div>

      <ul className="space-y-4">
        {items.map((it) => (
          <AccCard key={it.id} it={it} checked={selected.has(it.id)} onCheck={() => toggle(it.id)} onResult={setRes} />
        ))}
      </ul>
      <Toast res={res} onClose={() => setRes(null)} />
    </section>
  );
}

function AccCard({ it, checked, onCheck, onResult }: { it: AccItem; checked: boolean; onCheck: () => void; onResult: (r: AccResult) => void }) {
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"idle" | "chat">("idle");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const run = (label: string, fn: () => Promise<AccResult>) => {
    setBusy(label);
    start(async () => {
      const r = await fn();
      onResult(r);
      setBusy(null);
      if (r.ok && label === "chat") {
        setMode("idle");
        setText("");
      }
    });
  };
  const locked = it.revising || pending;
  const thumbs = Array.from({ length: Math.min(it.slides, 6) }, (_, i) => `/api/render/${it.id}/${i}?v=${encodeURIComponent(it.version)}`);

  return (
    <li className={`relative overflow-hidden rounded-3xl bg-white shadow-soft ring-1 transition ${checked ? "ring-2 ring-emerald-500" : "ring-line"}`}>
      {it.revising && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-white/75 backdrop-blur-[2px]">
          <span className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-lift">
            <Sparkles size={15} className="animate-pulse" /> AI sedang merevisi konten ini…
          </span>
        </div>
      )}
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row">
        <div className="flex items-start gap-3 lg:w-[46%]">
          <input type="checkbox" checked={checked} onChange={onCheck} disabled={locked} aria-label={`Pilih ${it.title}`} className="mt-2 h-4 w-4 shrink-0 accent-emerald-600" />
          <div className="scrollbar-none flex min-w-0 gap-2 overflow-x-auto pb-1">
            {thumbs.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt={`Slide ${i + 1}`}
                loading="lazy"
                className={`aspect-[4/5] shrink-0 rounded-xl bg-slate-100 object-cover ring-1 ring-black/5 ${i === 0 ? "w-40" : "w-28 self-end"}`}
              />
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 flex-1 text-base font-extrabold leading-snug text-ink">{it.title}</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              {it.format === "carousel" ? `Carousel · ${it.slides} slide` : "Single post"}
            </span>
            {it.revisions > 0 && <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">Revisi ke-{it.revisions}</span>}
          </div>
          {it.status === "failed" && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-red-600">
              <AlertTriangle size={13} /> Gagal terbit sebelumnya{it.error ? `: ${it.error}` : ""}
            </p>
          )}
          <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">{it.caption}</p>
          {it.notes && <p className="mt-2 line-clamp-2 text-xs text-slate-400">Catatan AI: {it.notes}</p>}

          <label className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            Tayang
            <input
              type="datetime-local"
              defaultValue={it.plannedLocal ?? ""}
              disabled={locked}
              onBlur={(e) => {
                const v = e.target.value;
                if (v && v !== it.plannedLocal) run("date", () => setPlannedAction(it.id, v));
              }}
              className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm font-medium text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-brand-400"
            />
            {!it.plannedLocal && <span className="font-normal text-slate-400">kosong = besok di jam posting brand</span>}
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={locked}
              onClick={() => run("acc", () => accAction(it.id))}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-soft hover:bg-emerald-700 disabled:opacity-40"
            >
              {busy === "acc" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} ACC
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => run("auto", () => autoReviseAction(it.id))}
              title="AI mengkritik & memperbaiki hook, teks, visual, dan caption sendiri"
              className="bg-social inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-soft hover:brightness-105 disabled:opacity-40"
            >
              {busy === "auto" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Revisi otomatis
            </button>
            <button
              type="button"
              disabled={locked}
              aria-expanded={mode === "chat"}
              onClick={() => setMode(mode === "chat" ? "idle" : "chat")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-ink ring-1 ring-line hover:ring-brand-300 disabled:opacity-40"
            >
              <MessageSquareText size={15} /> Revisi dengan arahan
            </button>
            <Link href={`/posts/${it.id}`} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 hover:text-ink">
              <ExternalLink size={14} /> Detail
            </Link>
            <button
              type="button"
              disabled={locked}
              onClick={() => run("reject", () => rejectAction(it.id))}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              <X size={15} /> Tolak
            </button>
          </div>

          {mode === "chat" && (
            <form
              className="mt-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-line"
              onSubmit={(e) => {
                e.preventDefault();
                run("chat", () => chatReviseAction(it.id, text));
              }}
            >
              <div className="mb-2 flex flex-wrap gap-1.5">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setText((t) => (t ? `${t}, ${q.toLowerCase()}` : q))}
                    className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-line hover:ring-brand-300"
                  >
                    {q}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  autoFocus
                  aria-label={`Arahan revisi untuk ${it.title}`}
                  placeholder="Mis. “slide 2 fotonya ganti orang lagi ngopi, judul cover lebih singkat”"
                  className="min-w-0 flex-1 rounded-xl bg-white px-3.5 py-2.5 text-sm ring-1 ring-line outline-none focus:ring-2 focus:ring-brand-400"
                />
                <button type="submit" disabled={!text.trim() || locked} className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 text-sm font-bold text-white disabled:opacity-40">
                  {busy === "chat" ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Kirim
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </li>
  );
}
