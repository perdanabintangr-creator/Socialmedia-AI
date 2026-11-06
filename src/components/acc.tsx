"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CalendarRange,
  Check,
  CheckCheck,
  ExternalLink,
  Lightbulb,
  Loader2,
  Palette,
  Send,
  Sparkles,
  Undo2,
  Wand2,
  X,
} from "lucide-react";
import {
  accAction,
  accManyAction,
  acceptIdeasAction,
  autoReviseAction,
  cancelScheduleAction,
  chatReviseAction,
  moveIdeaAction,
  proposePlanAction,
  rejectAction,
  rejectIdeasAction,
  resumeBatchAction,
  setPlannedAction,
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
  whenLabel: string | null;
  version: string;
}

export interface PlanIdea {
  id: string;
  title: string;
  hook: string;
  pillar: string;
  format: "single" | "carousel";
  plannedLocal: string;
  whenLabel: string;
}

const PERIODS = {
  week: { label: "Seminggu", counts: [3, 5, 7], days: 7 },
  month: { label: "Sebulan", counts: [8, 12, 20, 30], days: 30 },
} as const;

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
    const id = setTimeout(onClose, 7000);
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

function SectionHead({ icon: Icon, title, count, desc, children }: { icon: typeof Lightbulb; title: string; count?: number; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
          <Icon size={18} className="text-brand-600" /> {title}
          {count !== undefined && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{count}</span>}
        </h2>
        {desc && <p className="mt-0.5 text-sm text-slate-500">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ 1. Rencana ide

export function Planner({
  quotaLeft,
  planLabel,
  defaultStyle,
  compact = false,
}: {
  quotaLeft: number;
  planLabel: string;
  defaultStyle: StyleChoice;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(!compact);
  const [period, setPeriod] = useState<keyof typeof PERIODS>("week");
  const [count, setCount] = useState(5);
  const [brief, setBrief] = useState("");
  const [style, setStyle] = useState<StyleChoice>(defaultStyle);
  const [res, setRes] = useState<AccResult | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <section id="rencana" className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 pr-4 shadow-soft ring-1 ring-line">
        <span className="bg-social grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white">
          <CalendarRange size={16} />
        </span>
        <p className="min-w-0 flex-1 text-sm">
          <b className="text-ink">Rencana konten autopilot</b>
          <span className="block text-slate-500">Minta ide untuk seminggu atau sebulan berikutnya.</span>
        </p>
        <button type="button" onClick={() => setOpen(true)} className="bg-social inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-soft hover:brightness-105">
          <Wand2 size={15} /> Susun ide baru
        </button>
      </section>
    );
  }

  return (
    <section id="rencana" className="mb-8 rounded-3xl bg-white p-5 shadow-soft ring-1 ring-line sm:p-6">
      <div className="flex flex-wrap items-start gap-3">
        <span className="bg-social grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white">
          <CalendarRange size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold tracking-tight text-ink">Konten autopilot</h2>
          <ol className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            <li><b className="text-ink">1.</b> AI susun ide + jadwal</li>
            <li><b className="text-ink">2.</b> Kamu ACC idenya</li>
            <li><b className="text-ink">3.</b> Konten dibuat & dijadwalkan otomatis</li>
            <li><b className="text-ink">4.</b> Tinggal tunggu tayang</li>
          </ol>
        </div>
      </div>

      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData();
          fd.set("period", period);
          fd.set("count", String(count));
          fd.set("brief", brief);
          if (style !== "auto") fd.set("style", style);
          start(async () => {
            const r = await proposePlanAction(fd);
            setRes(r);
            if (r.ok) setBrief("");
          });
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Periode">
            {(Object.keys(PERIODS) as (keyof typeof PERIODS)[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={period === k}
                onClick={() => {
                  setPeriod(k);
                  setCount(k === "week" ? 5 : 12);
                }}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition ${period === k ? "bg-white text-ink shadow-soft" : "text-slate-500 hover:text-ink"}`}
              >
                {PERIODS[k].label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {PERIODS[period].counts.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={count === c}
                onClick={() => setCount(c)}
                className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                  count === c ? "bg-brand-50 text-brand-700 ring-2 ring-brand-500" : "bg-white text-slate-600 ring-1 ring-line hover:ring-slate-300"
                }`}
              >
                {c} ide
                <span className="ml-1 text-xs font-normal text-slate-400">
                  · {period === "week" ? (c >= 7 ? "tiap hari" : `${c}x/minggu`) : c >= 30 ? "tiap hari" : `${Math.round((c / 30) * 7)}x/minggu`}
                </span>
              </button>
            ))}
          </div>
        </div>
        <p className="-mt-2 text-xs text-slate-400">
          Menyusun ide tidak memakai kuota. Kuota baru terpakai saat ide di-ACC dan dibuatkan kontennya (sisa paket {planLabel}:{" "}
          {quotaLeft >= 999 ? "tanpa batas" : `${quotaLeft} konten`}).
        </p>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Fokus periode ini (opsional)</span>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={2}
            placeholder="Mis. “minggu ini launching fitur baru hari Kamis, ada promo 12.12, perbanyak testimoni pelanggan”"
            className="w-full resize-none rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm ring-1 ring-line outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-400"
          />
        </label>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Arah visual</p>
          <StylePicker value={style} onChange={setStyle} compact />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="bg-social inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-soft transition hover:brightness-105 disabled:opacity-40"
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Lightbulb size={16} />}
            {pending ? "Menyusun ide…" : `Susun ${count} ide ${period === "week" ? "seminggu" : "sebulan"}`}
          </button>
          {compact && (
            <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-slate-500 hover:text-ink">
              Tutup
            </button>
          )}
        </div>
      </form>
      <Toast res={res} onClose={() => setRes(null)} />
    </section>
  );
}

// ------------------------------------------------------------------ progres antrean

export function QueueProgress({ progress }: { progress: BatchProgress | null }) {
  const resumed = useRef(false);
  useAutoRefresh(Boolean(progress?.running), 8000);
  useEffect(() => {
    if (progress?.stalled && !resumed.current) {
      resumed.current = true;
      void resumeBatchAction();
    }
  }, [progress?.stalled]);
  if (!progress?.running) return null;
  const pct = Math.round((progress.done / Math.max(1, progress.total)) * 100);
  return (
    <section className="mb-8 overflow-hidden rounded-3xl bg-ink p-5 text-white shadow-lift sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="bg-social grid h-10 w-10 place-items-center rounded-2xl">
          <Loader2 size={18} className="animate-spin" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">Tim AI sedang membuat & menjadwalkan kontenmu</p>
          <p className="text-sm text-white/60">
            {progress.done} dari {progress.total} selesai{progress.failed ? ` · ${progress.failed} gagal` : ""}. Konten yang jadi langsung masuk jadwal — tidak perlu ditunggui.
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

// ------------------------------------------------------------------ 2. Ide menunggu ACC

export function IdeaPlan({ ideas }: { ideas: PlanIdea[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [res, setRes] = useState<AccResult | null>(null);
  const [pending, start] = useTransition();
  if (!ideas.length) return null;
  const allOn = ideas.every((i) => selected.has(i.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const accept = (ids: string[]) =>
    start(async () => {
      setRes(await acceptIdeasAction(ids));
      setSelected(new Set());
    });

  return (
    <section className="mb-10">
      <SectionHead icon={Lightbulb} title="Ide menunggu ACC" count={ideas.length} desc="ACC ide yang kamu suka. Kontennya langsung dibuat dan dijadwalkan otomatis di tanggalnya.">
        <button
          type="button"
          disabled={pending}
          onClick={() => accept(selected.size ? [...selected] : ideas.map((i) => i.id))}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-soft hover:bg-emerald-700 disabled:opacity-40"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />}
          {selected.size ? `ACC terpilih (${selected.size})` : `ACC semua (${ideas.length})`}
        </button>
      </SectionHead>
      <div className="overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-line">
        <label className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs font-semibold text-slate-500 sm:px-5">
          <input type="checkbox" checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(ideas.map((i) => i.id)))} className="h-4 w-4 accent-emerald-600" />
          Pilih semua
        </label>
        <ul className="divide-y divide-line">
          {ideas.map((i) => (
            <IdeaRow key={i.id} idea={i} checked={selected.has(i.id)} onCheck={() => toggle(i.id)} onResult={setRes} disabled={pending} />
          ))}
        </ul>
      </div>
      <Toast res={res} onClose={() => setRes(null)} />
    </section>
  );
}

function IdeaRow({ idea, checked, onCheck, onResult, disabled }: { idea: PlanIdea; checked: boolean; onCheck: () => void; onResult: (r: AccResult) => void; disabled: boolean }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<AccResult>) => start(async () => onResult(await fn()));
  return (
    <li className={`flex flex-col gap-3 px-4 py-4 transition sm:flex-row sm:items-center sm:px-5 ${checked ? "bg-emerald-50/50" : ""} ${pending ? "opacity-60" : ""}`}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <input type="checkbox" checked={checked} onChange={onCheck} aria-label={`Pilih ide ${idea.title}`} className="mt-1 h-4 w-4 shrink-0 accent-emerald-600" />
        <div className="w-[92px] shrink-0 rounded-xl bg-slate-50 px-2 py-1.5 text-center ring-1 ring-line">
          <span className="block text-[11px] font-semibold leading-tight text-slate-500">{idea.whenLabel.split(" · ")[0]}</span>
          <span className="block text-sm font-extrabold leading-tight text-ink">{idea.whenLabel.split(" · ")[1]}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-snug text-ink">{idea.title}</p>
          <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">“{idea.hook}”</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-semibold">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{idea.format === "carousel" ? "Carousel" : "Single post"}</span>
            {idea.pillar && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">{idea.pillar}</span>}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-7 sm:pl-0">
        <input
          type="datetime-local"
          defaultValue={idea.plannedLocal}
          aria-label="Jadwal tayang"
          disabled={disabled || pending}
          onBlur={(e) => {
            const v = e.target.value;
            if (v && v !== idea.plannedLocal) run(() => moveIdeaAction(idea.id, v));
          }}
          className="rounded-lg bg-slate-50 px-2 py-1.5 text-xs font-medium text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-brand-400"
        />
        <button
          type="button"
          disabled={disabled || pending}
          onClick={() => run(() => acceptIdeasAction([idea.id]))}
          className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          <Check size={15} /> ACC
        </button>
        <button
          type="button"
          disabled={disabled || pending}
          onClick={() => run(() => rejectIdeasAction([idea.id]))}
          aria-label={`Lewati ide ${idea.title}`}
          className="rounded-xl px-2.5 py-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
        >
          <X size={16} />
        </button>
      </div>
    </li>
  );
}

// ------------------------------------------------------------------ 3. Konten (terjadwal otomatis / menunggu ACC)

const QUICK = ["Ganti foto cover", "Visual lebih premium", "Warna lebih cerah", "Pakai foto orang Indonesia", "Hook lebih nendang", "Teks lebih singkat"];

export function ContentList({ items, variant }: { items: AccItem[]; variant: "scheduled" | "review" }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [res, setRes] = useState<AccResult | null>(null);
  const [bulk, startBulk] = useTransition();
  useAutoRefresh(items.some((i) => i.revising), 6000);
  if (!items.length) return null;
  const ready = items.filter((i) => !i.revising);
  const allOn = ready.length > 0 && ready.every((i) => selected.has(i.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <section className="mb-10">
      {variant === "scheduled" ? (
        <SectionHead
          icon={CalendarClock}
          title="Terjadwal otomatis"
          count={items.length}
          desc="Sudah jadi dan akan tayang sendiri. Mau diubah? Pakai Revisi otomatis atau Revisi visual — setelah direvisi, jadwalnya tetap."
        />
      ) : (
        <SectionHead icon={CheckCheck} title="Konten menunggu ACC" count={items.length} desc="Konten dari chat atau yang jadwalnya kamu batalkan.">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <input type="checkbox" checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(ready.map((i) => i.id)))} className="h-4 w-4 accent-emerald-600" />
            Pilih semua
          </label>
          <button
            type="button"
            disabled={!selected.size || bulk}
            onClick={() =>
              startBulk(async () => {
                setRes(await accManyAction([...selected]));
                setSelected(new Set());
              })
            }
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-soft hover:bg-emerald-700 disabled:opacity-40"
          >
            {bulk ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />}
            ACC terpilih{selected.size ? ` (${selected.size})` : ""}
          </button>
        </SectionHead>
      )}
      <ul className="space-y-4">
        {items.map((it) => (
          <ContentCard key={it.id} it={it} variant={variant} checked={selected.has(it.id)} onCheck={() => toggle(it.id)} onResult={setRes} />
        ))}
      </ul>
      <Toast res={res} onClose={() => setRes(null)} />
    </section>
  );
}

function ContentCard({
  it,
  variant,
  checked,
  onCheck,
  onResult,
}: {
  it: AccItem;
  variant: "scheduled" | "review";
  checked: boolean;
  onCheck: () => void;
  onResult: (r: AccResult) => void;
}) {
  const [pending, start] = useTransition();
  const [chat, setChat] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const run = (label: string, fn: () => Promise<AccResult>) => {
    setBusy(label);
    start(async () => {
      const r = await fn();
      onResult(r);
      setBusy(null);
      if (r.ok && label === "chat") {
        setChat(false);
        setText("");
      }
    });
  };
  const locked = it.revising || pending;
  const scheduled = variant === "scheduled";
  const thumbs = Array.from({ length: Math.min(it.slides, 6) }, (_, i) => `/api/render/${it.id}/${i}?v=${encodeURIComponent(it.version)}`);

  return (
    <li className={`relative overflow-hidden rounded-3xl bg-white shadow-soft ring-1 transition ${checked ? "ring-2 ring-emerald-500" : "ring-line"}`}>
      {it.revising && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-white/75 backdrop-blur-[2px]">
          <span className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-lift">
            <Sparkles size={15} className="animate-pulse" /> AI sedang merevisi{scheduled ? " — jadwal tetap" : ""}…
          </span>
        </div>
      )}
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row">
        <div className="flex items-start gap-3 lg:w-[46%]">
          {!scheduled && <input type="checkbox" checked={checked} onChange={onCheck} disabled={locked} aria-label={`Pilih ${it.title}`} className="mt-2 h-4 w-4 shrink-0 accent-emerald-600" />}
          <div className="scrollbar-none flex min-w-0 gap-2 overflow-x-auto pb-1">
            {thumbs.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt={`Slide ${i + 1}`} loading="lazy" className={`aspect-[4/5] shrink-0 rounded-xl bg-slate-100 object-cover ring-1 ring-black/5 ${i === 0 ? "w-40" : "w-28 self-end"}`} />
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {scheduled && it.whenLabel && (
            <span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
              <CalendarClock size={13} /> Tayang {it.whenLabel}
            </span>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 flex-1 text-base font-extrabold leading-snug text-ink">{it.title}</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{it.format === "carousel" ? `Carousel · ${it.slides} slide` : "Single post"}</span>
            {it.revisions > 0 && <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">Revisi ke-{it.revisions}</span>}
          </div>
          {it.error && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-red-600">
              <AlertTriangle size={13} /> {it.error}
            </p>
          )}
          <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">{it.caption}</p>
          {it.notes && <p className="mt-2 line-clamp-2 text-xs text-slate-400">Catatan AI: {it.notes}</p>}

          <label className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            {scheduled ? "Ubah jadwal" : "Tayang"}
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
            {!scheduled && !it.plannedLocal && <span className="font-normal text-slate-400">kosong = besok di jam posting brand</span>}
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            {!scheduled && (
              <button
                type="button"
                disabled={locked}
                onClick={() => run("acc", () => accAction(it.id))}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-soft hover:bg-emerald-700 disabled:opacity-40"
              >
                {busy === "acc" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} ACC
              </button>
            )}
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
              aria-expanded={chat}
              onClick={() => setChat(!chat)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-ink ring-1 ring-line hover:ring-brand-300 disabled:opacity-40"
            >
              <Palette size={15} /> Revisi visual
            </button>
            <Link href={`/posts/${it.id}`} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 hover:text-ink">
              <ExternalLink size={14} /> Detail
            </Link>
            {scheduled ? (
              <button
                type="button"
                disabled={locked}
                onClick={() => run("cancel", () => cancelScheduleAction(it.id))}
                className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-ink disabled:opacity-40"
              >
                <Undo2 size={15} /> Batalkan jadwal
              </button>
            ) : (
              <button
                type="button"
                disabled={locked}
                onClick={() => run("reject", () => rejectAction(it.id))}
                className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                <X size={15} /> Tolak
              </button>
            )}
          </div>

          {chat && (
            <form
              className="mt-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-line"
              onSubmit={(e) => {
                e.preventDefault();
                run("chat", () => chatReviseAction(it.id, text));
              }}
            >
              <p className="mb-2 text-xs font-semibold text-slate-500">Mau visualnya diubah seperti apa?</p>
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
                  placeholder="Mis. “cover pakai foto barista lagi menuang kopi, warna lebih hangat, judul lebih besar”"
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
