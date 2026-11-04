"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Check, Clock, ExternalLink, Loader2, Palette, PenLine, Send, Sparkles, X } from "lucide-react";
import { AGENTS, AGENT_LIST, type AgentId } from "@/lib/agents";
import type { ChatView, IdeaCard, PostCard, StudioState } from "@/lib/studio-view";
import { chatApproveIdeaAction, chatApprovePostAction, chatRejectIdeaAction, sendChatAction, type StudioResult } from "@/app/studio-actions";

const ICONS = { PenLine, Palette, Send };

const SUGGESTIONS = [
  "Buatkan 5 ide konten minggu ini",
  "Bikin carousel tips branding untuk UMKM",
  "Apa jadwal posting minggu ini?",
  "ACC, jadwalkan besok jam 7 malam",
];

function defaultSchedule(time: string) {
  const tomorrow = new Date(Date.now() + 24 * 3600_000);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(tomorrow);
  return `${date}T${time}`;
}
const fmtTime = (iso: string) => new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(iso));
const fmtWib = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso)) + " WIB" : "-";

export function Avatar({ id, size = 36 }: { id: AgentId; size?: number }) {
  const a = AGENTS[id];
  const Icon = ICONS[a.icon];
  return (
    <span className={`grid shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-sm ${a.gradient}`} style={{ width: size, height: size }}>
      <Icon size={size * 0.5} strokeWidth={2.2} />
    </span>
  );
}

export function Studio({ initial }: { initial: StudioState }) {
  const [state, setState] = useState(initial);
  const [text, setText] = useState("");
  const [sending, startSend] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fastUntil, setFastUntil] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastCount = useRef(initial.messages.length);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/studio", { cache: "no-store" });
      if (res.ok) setState(await res.json());
    } catch {
      /* jaringan putus sesaat — coba lagi di polling berikutnya */
    }
  }, []);

  // Polling: cepat saat agen bekerja, santai saat diam.
  const busy = Boolean(state.job) || sending || Date.now() < fastUntil;
  useEffect(() => {
    const id = setInterval(refresh, busy ? 1500 : 7000);
    return () => clearInterval(id);
  }, [busy, refresh]);

  // Saat dibuka: langsung ke pesan terbaru.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, []);

  // Auto-scroll saat ada pesan baru.
  useEffect(() => {
    if (state.messages.length !== lastCount.current || sending) {
      lastCount.current = state.messages.length;
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [state.messages.length, sending, state.job]);

  const run = (fn: () => Promise<StudioResult>) => {
    setError(null);
    setFastUntil(Date.now() + 20_000);
    startSend(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Gagal");
      await refresh();
    });
  };

  const send = (msg: string) => {
    const m = msg.trim();
    if (!m || sending) return;
    setText("");
    setState((s) => ({
      ...s,
      messages: [...s.messages, { id: `tmp-${Date.now()}`, workspace_id: "", role: "user", agent: null, kind: "text", text: m, created_at: new Date().toISOString() }],
    }));
    run(() => sendChatAction(m));
  };

  const startRevise = (title: string) => {
    setText(`Revisi “${title}”: `);
    inputRef.current?.focus();
  };

  const working = state.job ? AGENTS[state.job.agent] : null;

  return (
    <div className="grid h-[calc(100dvh-8.5rem)] min-h-[520px] gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* Tim */}
      <aside className="hidden flex-col gap-3 lg:flex">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold text-slate-500">Tim kontenmu</h2>
          <ul className="mt-3 space-y-3">
            {AGENT_LIST.map((a) => {
              const active = state.job?.agent === a.id;
              return (
                <li key={a.id} className="flex items-start gap-3">
                  <div className="relative">
                    <Avatar id={a.id} size={40} />
                    <span className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full ring-2 ring-white ${active ? "animate-pulse bg-amber-400" : "bg-emerald-400"}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      {a.name} <span className="font-normal text-slate-400">· {a.role}</span>
                    </div>
                    <div className="text-xs text-slate-500">{active ? state.job!.label : a.does}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold text-slate-500">Coba ketik</h2>
          <div className="mt-2 flex flex-col gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} disabled={sending || Boolean(state.job)} className="rounded-lg bg-slate-50 px-3 py-2 text-left text-xs text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50">
                {s}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Chat */}
      <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex -space-x-2">
            {AGENT_LIST.map((a) => (
              <span key={a.id} className="rounded-xl ring-2 ring-white">
                <Avatar id={a.id} size={30} />
              </span>
            ))}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">Studio Konten</div>
            <div className="truncate text-xs text-slate-500">{working ? state.job!.label : "Kata, Rupa, Siar • siap kerja"}</div>
          </div>
        </header>

        <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 px-3 py-4 sm:px-5">
          {state.messages.map((m) => (
            <Message key={m.id} m={m} postingTime={state.postingTime} disabled={sending || Boolean(state.job)} run={run} onRevise={startRevise} />
          ))}
          {(working || sending) && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              {working ? <Avatar id={working.id} size={28} /> : <Loader2 size={18} className="animate-spin" />}
              <span>{working ? state.job!.label : "Mengirim…"}</span>
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </span>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 p-3">
          {error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">{error}</p>}
          <div className="mb-2 flex gap-1.5 overflow-x-auto lg:hidden">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} disabled={sending || Boolean(state.job)} className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 disabled:opacity-50">
                {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
            className="flex items-end gap-2"
          >
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(text);
                }
              }}
              rows={1}
              placeholder="Kasih arahan ke tim…"
              aria-label="Pesan untuk tim"
              className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border-0 bg-slate-100 px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <button type="submit" disabled={!text.trim() || sending} aria-label="Kirim" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40">
              {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

type Run = (fn: () => Promise<StudioResult>) => void;

function Message({ m, postingTime, disabled, run, onRevise }: { m: ChatView; postingTime: string; disabled: boolean; run: Run; onRevise: (title: string) => void }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-sm whitespace-pre-wrap text-white shadow-sm">
          {m.text}
          <div className="mt-1 text-right text-[10px] text-indigo-200">{fmtTime(m.created_at)}</div>
        </div>
      </div>
    );
  }
  const a = AGENTS[m.agent ?? "kata"];
  return (
    <div className="flex gap-2.5">
      <Avatar id={a.id} size={34} />
      <div className="min-w-0 max-w-[92%] flex-1 sm:max-w-[85%]">
        <div className="mb-1 text-xs font-semibold text-slate-700">
          {a.name} <span className="font-normal text-slate-400">· {a.role} · {fmtTime(m.created_at)}</span>
        </div>
        <div className={`inline-block rounded-2xl rounded-tl-md px-4 py-2.5 text-sm whitespace-pre-wrap shadow-sm ring-1 ${m.kind === "error" ? "bg-red-50 text-red-800 ring-red-200" : "bg-white text-slate-800 ring-slate-200"}`}>
          {m.text}
        </div>
        {m.ideas && m.ideas.length > 0 && <Ideas ideas={m.ideas} disabled={disabled} run={run} />}
        {m.post && <PostPreview post={m.post} postingTime={postingTime} disabled={disabled} run={run} onRevise={onRevise} />}
      </div>
    </div>
  );
}

function Ideas({ ideas, disabled, run }: { ideas: IdeaCard[]; disabled: boolean; run: Run }) {
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {ideas.map((i) => (
        <div key={i.id} className={`rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200 ${i.status === "rejected" ? "opacity-50" : ""}`}>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">{i.format === "carousel" ? "Carousel" : "Single post"}</span>
            {i.pillar && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{i.pillar}</span>}
          </div>
          <div className={`mt-2 text-sm font-semibold leading-snug ${i.status === "rejected" ? "line-through" : ""}`}>{i.title}</div>
          <div className="mt-1 text-xs text-slate-500">“{i.hook}”</div>
          <div className="mt-3 flex gap-2">
            {i.status === "pending" && (
              <>
                <button disabled={disabled} onClick={() => run(() => chatApproveIdeaAction(i.id))} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                  <Check size={14} /> ACC
                </button>
                <button disabled={disabled} onClick={() => run(() => chatRejectIdeaAction(i.id))} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50">
                  <X size={14} /> Tolak
                </button>
              </>
            )}
            {i.status === "approved" &&
              (i.post_id ? (
                <Link href={`/posts/${i.post_id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <Check size={14} /> Di-ACC · lihat konten
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                  <Sparkles size={14} /> Sedang dikerjakan
                </span>
              ))}
            {i.status === "rejected" && <span className="text-xs text-slate-500">Ditolak</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

const STATUS_LABEL: Record<PostCard["status"], [string, string]> = {
  review: ["Menunggu ACC", "bg-amber-100 text-amber-800"],
  approved: ["ACC • siap diposting", "bg-sky-100 text-sky-800"],
  scheduled: ["Terjadwal", "bg-indigo-100 text-indigo-800"],
  published: ["Terbit", "bg-emerald-100 text-emerald-800"],
  failed: ["Gagal", "bg-red-100 text-red-700"],
  rejected: ["Ditolak", "bg-slate-200 text-slate-600"],
};

function PostPreview({ post, postingTime, disabled, run, onRevise }: { post: PostCard; postingTime: string; disabled: boolean; run: Run; onRevise: (title: string) => void }) {
  const [when, setWhen] = useState(() => defaultSchedule(postingTime));
  const v = encodeURIComponent(post.version);
  const images = post.media_urls.length ? post.media_urls : Array.from({ length: post.slides }, (_, i) => `/api/render/${post.id}/${i}?v=${v}`);
  const [label, cls] = STATUS_LABEL[post.status];
  const editable = post.status === "review" || post.status === "failed";
  return (
    <div className="mt-2 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex gap-2 overflow-x-auto p-2">
        {images.map((src, i) => (
          <a key={src} href={src} target="_blank" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Slide ${i + 1}`} loading="lazy" className="aspect-[4/5] w-36 rounded-lg bg-slate-100 object-cover ring-1 ring-slate-200 sm:w-44" />
          </a>
        ))}
      </div>
      <div className="space-y-2 border-t border-slate-100 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{post.title}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>
          {post.scheduled_at && post.status !== "review" && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Clock size={12} /> {fmtWib(post.scheduled_at)}
            </span>
          )}
        </div>
        <p className="line-clamp-3 text-xs whitespace-pre-wrap text-slate-600">{post.caption}</p>
        {editable && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Jadwal (WIB)" className="rounded-lg border-0 bg-slate-100 px-2 py-1.5 text-xs ring-1 ring-slate-200" />
            <button disabled={disabled} onClick={() => run(() => chatApprovePostAction(post.id, "schedule", when))} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
              <Check size={14} /> ACC & jadwalkan
            </button>
            <button disabled={disabled} onClick={() => run(() => chatApprovePostAction(post.id, "now", ""))} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50 disabled:opacity-50">
              Posting sekarang
            </button>
            <button disabled={disabled} onClick={() => onRevise(post.title)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50">
              Revisi
            </button>
          </div>
        )}
        <Link href={`/posts/${post.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline">
          Detail & edit manual <ExternalLink size={12} />
        </Link>
      </div>
    </div>
  );
}
