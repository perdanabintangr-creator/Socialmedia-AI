"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Copy, Loader2, Trash2, X } from "lucide-react";
import { deletePostsAction, type ActionState } from "@/app/actions";
import { StatusBadge } from "@/components/ui";
import type { PostStatus } from "@/lib/types";

export interface GridPost {
  id: string;
  title: string;
  status: PostStatus;
  slides: number;
  thumb: string;
  scheduledLabel: string | null;
}

/** Grid hasil konten dengan mode pilih untuk menghapus beberapa konten sekaligus. */
export function PostGrid({ posts }: { posts: GridPost[] }) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [res, setRes] = useState<ActionState>(undefined);
  const [pending, start] = useTransition();
  const rejected = posts.filter((p) => p.status === "rejected").map((p) => p.id);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const exit = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const doDelete = (ids: string[]) =>
    start(async () => {
      const r = await deletePostsAction(ids);
      setRes(r);
      setConfirm(null);
      exit();
      router.refresh();
    });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {selecting ? (
          <>
            <button
              type="button"
              onClick={() => setSelected(selected.size === posts.length ? new Set() : new Set(posts.map((p) => p.id)))}
              className="rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-ink ring-1 ring-line hover:ring-slate-300"
            >
              {selected.size === posts.length ? "Batal pilih semua" : "Pilih semua"}
            </button>
            <span className="text-sm text-slate-500">{selected.size} dipilih</span>
            <button
              type="button"
              disabled={!selected.size || pending}
              onClick={() => setConfirm([...selected])}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-soft hover:bg-red-700 disabled:opacity-40"
            >
              <Trash2 size={15} /> Hapus{selected.size ? ` (${selected.size})` : ""}
            </button>
            <button type="button" onClick={exit} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:text-ink">
              <X size={15} /> Selesai
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setSelecting(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-ink ring-1 ring-line hover:ring-slate-300"
            >
              <Check size={15} /> Pilih
            </button>
            {rejected.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirm(rejected)}
                className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                <Trash2 size={15} /> Hapus semua yang ditolak ({rejected.length})
              </button>
            )}
          </>
        )}
      </div>

      {res && (res.ok || res.error) && (
        <p role="status" className={`mb-4 rounded-xl px-4 py-2.5 text-sm ring-1 ${res.ok ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-red-50 text-red-700 ring-red-200"}`}>
          {res.ok ?? res.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
        {posts.map((p) => {
          const on = selected.has(p.id);
          const card = (
            <>
              <div
                className={`relative overflow-hidden rounded-2xl bg-slate-100 shadow-soft ring-1 transition group-hover:-translate-y-0.5 group-hover:shadow-lift ${
                  on ? "ring-2 ring-red-500" : "ring-line"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumb} alt="" className={`aspect-[4/5] w-full object-cover transition ${on ? "scale-95 rounded-xl" : ""}`} loading="lazy" />
                {p.slides > 1 && (
                  <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                    <Copy size={12} /> {p.slides}
                  </span>
                )}
                {selecting && (
                  <span
                    className={`absolute top-2.5 left-2.5 grid h-6 w-6 place-items-center rounded-full ring-2 ${on ? "bg-red-600 text-white ring-white" : "bg-white/80 text-transparent ring-white/90"}`}
                  >
                    <Check size={14} strokeWidth={3} />
                  </span>
                )}
                <span className="absolute bottom-2.5 left-2.5">
                  <StatusBadge status={p.status} />
                </span>
              </div>
              <div className="mt-2.5 line-clamp-2 text-sm font-semibold">{p.title}</div>
              {p.scheduledLabel && (
                <div className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                  <CalendarClock size={12} /> {p.scheduledLabel}
                </div>
              )}
            </>
          );
          return selecting ? (
            <button key={p.id} type="button" aria-pressed={on} onClick={() => toggle(p.id)} className="group text-left">
              {card}
            </button>
          ) : (
            <Link key={p.id} href={`/posts/${p.id}`} className="group">
              {card}
            </Link>
          );
        })}
      </div>

      {confirm && (
        <div role="dialog" aria-modal="true" aria-labelledby="hapus-judul" className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-lift">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-red-50 text-red-600">
              <Trash2 size={20} />
            </span>
            <h2 id="hapus-judul" className="mt-4 text-lg font-extrabold text-ink">
              Hapus {confirm.length} konten?
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Konten hilang dari aplikasi dan tidak bisa dikembalikan. Kuota paket yang sudah terpakai tidak bertambah kembali. Postingan yang sudah terbit tetap ada di Instagram/TikTok.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirm(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Batal
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => doDelete(confirm)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
