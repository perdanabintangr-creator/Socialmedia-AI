"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, Check, Clock, ExternalLink, Loader2, Palette, PenLine, Send, Smartphone, Sparkles, X } from "lucide-react";
import { PhonePreview } from "./phone-preview";
import { AGENTS, AGENT_LIST, type AgentId } from "@/lib/agents";
import type { ChatView, IdeaCard, PostCard, StudioState } from "@/lib/studio-view";
import { chatApproveIdeaAction, chatApprovePostAction, chatRejectIdeaAction, sendChatAction, type StudioResult } from "@/app/studio-actions";

const ICONS = { PenLine, Palette, Send };
const ChatIdCtx = createContext("");

export const SUGGESTIONS = [
  "Buatkan 5 ide konten minggu ini",
  "Bikin carousel tips untuk pelanggan baru",
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

/** Satu percakapan dengan tim agen. */
export function ChatRoom({ chatId, title, initial }: { chatId: string; title: string; initial: StudioState }) {
  const [state, setState] = useState(initial);
  const [text, setText] = useState("");
  const [sending, startSend] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fastUntil, setFastUntil] = useState(() => Date.now() + 15_000);
  const [preview, setPreview] = useState<PostCard | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastCount = useRef(initial.messages.length);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/studio?chat=${encodeURIComponent(chatId)}`, { cache: "no-store" });
      if (res.ok) setState(await res.json());
    } catch {
      /* jaringan putus sesaat — coba lagi di polling berikutnya */
    }
  }, [chatId]);

  // Polling: cepat saat agen bekerja, santai saat diam.
  const busy = Boolean(state.job) || sending || Date.now() < fastUntil;
  useEffect(() => {
    const id = setInterval(refresh, busy ? 1500 : 7000);
    return () => clearInterval(id);
  }, [busy, refresh]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, []);

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
      messages: [...s.messages, { id: `tmp-${Date.now()}`, workspace_id: "", chat_id: chatId, role: "user", agent: null, kind: "text", text: m, created_at: new Date().toISOString() }],
    }));
    run(() => sendChatAction(chatId, m));
  };

  const startRevise = (t: string) => {
    setText(`Revisi “${t}”: `);
    inputRef.current?.focus();
  };

  const working = state.job ? AGENTS[state.job.agent] : null;
  const empty = state.messages.length === 0;

  return (
    <ChatIdCtx.Provider value={chatId}>
      <div className="flex h-[calc(100dvh-7.75rem)] flex-col lg:h-dvh">
        <header className="flex items-center gap-3 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-10">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-bold">{title}</h1>
            <p className="truncate text-xs text-slate-500">{working ? state.job!.label : "Kata, Rupa & Siar siap kerja"}</p>
          </div>
          <div className="flex -space-x-2">
            {AGENT_LIST.map((a) => (
              <span key={a.id} className="relative rounded-xl ring-2 ring-canvas" title={`${a.name} · ${a.role}`}>
                <Avatar id={a.id} size={30} />
                {state.job?.agent === a.id && <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400 ring-2 ring-canvas" />}
              </span>
            ))}
          </div>
        </header>

        <div ref={listRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
            {empty && !sending && (
              <div className="py-10 text-center">
                <div className="mx-auto flex w-fit -space-x-2">
                  {AGENT_LIST.map((a) => (
                    <span key={a.id} className="rounded-2xl ring-4 ring-canvas">
                      <Avatar id={a.id} size={48} />
                    </span>
                  ))}
                </div>
                <h2 className="mt-5 text-xl font-bold">Mau bikin konten apa?</h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Kata menulis, Rupa mendesain, Siar menjadwalkan. Kasih arahan singkat atau pilih salah satu di bawah.</p>
                <div className="mx-auto mt-6 grid max-w-xl gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.slice(0, 3).map((s) => (
                    <button key={s} onClick={() => send(s)} className="rounded-xl bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 shadow-soft ring-1 ring-line hover:ring-brand-300">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {state.messages.map((m) => (
              <Message key={m.id} m={m} postingTime={state.postingTime} disabled={sending || Boolean(state.job)} run={run} onRevise={startRevise} onPreview={setPreview} />
            ))}
            {(working || sending) && (
              <div className="flex items-center gap-2.5 text-sm text-slate-500">
                {working ? <Avatar id={working.id} size={30} /> : <Loader2 size={18} className="animate-spin" />}
                <span>{working ? state.job!.label : "Mengirim…"}</span>
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 pb-4 sm:px-6 lg:px-10 lg:pb-6">
          <div className="mx-auto max-w-3xl">
            {error && <p role="alert" className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">{error}</p>}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(text);
              }}
              className="flex items-end gap-2 rounded-2xl bg-white p-2 shadow-lift ring-1 ring-line focus-within:ring-2 focus-within:ring-brand-400"
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
                placeholder="Balas atau kasih arahan baru…"
                aria-label="Pesan untuk tim"
                className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] outline-none placeholder:text-slate-400 focus-visible:outline-none"
              />
              <button type="submit" disabled={!text.trim() || sending} aria-label="Kirim" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink text-white transition hover:bg-ink/85 disabled:opacity-30">
                {sending ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} />}
              </button>
            </form>
            <p className="mt-2 text-center text-[11px] text-slate-400">Enter untuk kirim · Shift + Enter untuk baris baru</p>
          </div>
        </div>
      </div>

      {preview && (
        <div role="dialog" aria-modal="true" aria-label="Preview di HP" className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/60 p-4 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div className="relative w-full max-w-sm animate-fade-up py-6" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreview(null)} aria-label="Tutup" className="absolute -top-1 right-0 grid h-9 w-9 place-items-center rounded-full bg-white text-ink shadow-soft">
              <X size={18} />
            </button>
            <PhonePreview
              images={preview.media_urls.length ? preview.media_urls : Array.from({ length: preview.slides }, (_, i) => `/api/render/${preview.id}/${i}?v=${encodeURIComponent(preview.version)}`)}
              brandName={state.brand.name}
              handle={state.brand.handle}
              logoUrl={state.brand.logoUrl}
              primary={state.brand.primary}
              caption={preview.caption}
              hashtags={preview.hashtags}
            />
          </div>
        </div>
      )}
    </ChatIdCtx.Provider>
  );
}

type Run = (fn: () => Promise<StudioResult>) => void;

function Message({ m, postingTime, disabled, run, onRevise, onPreview }: { m: ChatView; postingTime: string; disabled: boolean; run: Run; onRevise: (title: string) => void; onPreview: (p: PostCard) => void }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm whitespace-pre-wrap text-white shadow-sm">
          {m.text}
          <div className="mt-1 text-right text-[10px] text-brand-200">{fmtTime(m.created_at)}</div>
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
        {m.post && <PostPreview post={m.post} postingTime={postingTime} disabled={disabled} run={run} onRevise={onRevise} onPreview={onPreview} />}
      </div>
    </div>
  );
}

function Ideas({ ideas, disabled, run }: { ideas: IdeaCard[]; disabled: boolean; run: Run }) {
  const chatId = useContext(ChatIdCtx);
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {ideas.map((i) => (
        <div key={i.id} className={`rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200 ${i.status === "rejected" ? "opacity-50" : ""}`}>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">{i.format === "carousel" ? "Carousel" : "Single post"}</span>
            {i.pillar && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{i.pillar}</span>}
          </div>
          <div className={`mt-2 text-sm font-semibold leading-snug ${i.status === "rejected" ? "line-through" : ""}`}>{i.title}</div>
          <div className="mt-1 text-xs text-slate-500">“{i.hook}”</div>
          <div className="mt-3 flex gap-2">
            {i.status === "pending" && (
              <>
                <button disabled={disabled} onClick={() => run(() => chatApproveIdeaAction(chatId, i.id))} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                  <Check size={14} /> ACC
                </button>
                <button disabled={disabled} onClick={() => run(() => chatRejectIdeaAction(chatId, i.id))} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50">
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
  scheduled: ["Terjadwal", "bg-brand-100 text-brand-800"],
  published: ["Terbit", "bg-emerald-100 text-emerald-800"],
  failed: ["Gagal", "bg-red-100 text-red-700"],
  rejected: ["Ditolak", "bg-slate-200 text-slate-600"],
};

function PostPreview({ post, postingTime, disabled, run, onRevise, onPreview }: { post: PostCard; postingTime: string; disabled: boolean; run: Run; onRevise: (title: string) => void; onPreview: (p: PostCard) => void }) {
  const chatId = useContext(ChatIdCtx);
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
            <button disabled={disabled} onClick={() => run(() => chatApprovePostAction(chatId, post.id, "schedule", when))} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
              <Check size={14} /> ACC & jadwalkan
            </button>
            <button disabled={disabled} onClick={() => run(() => chatApprovePostAction(chatId, post.id, "now", ""))} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50 disabled:opacity-50">
              Posting sekarang
            </button>
            <button disabled={disabled} onClick={() => onRevise(post.title)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50">
              Revisi
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <button onClick={() => onPreview(post)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:underline">
            <Smartphone size={13} /> Lihat di HP
          </button>
          <Link href={`/posts/${post.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-ink hover:underline">
            Detail & edit <ExternalLink size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}
