"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, MessageSquareText, PanelRightClose, Plus, Search, X } from "lucide-react";

export interface ChatLink {
  id: string;
  title: string;
}

const KEY = "sa_history_open";
const WIDE = 1280; // ≥ xl: panel mendorong konten; di bawahnya panel menimpa konten

/** Riwayat chat sebagai panel kanan yang bisa dibuka & di-minimize. */
export function ChatHistory({ chats }: { chats: ChatLink[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const [q, setQ] = useState("");

  // Ingat posisi buka/tutup per perangkat (hanya layar lebar).
  useEffect(() => {
    const isWide = () => window.innerWidth >= WIDE;
    setWide(isWide());
    try {
      if (isWide() && localStorage.getItem(KEY) === "1") setOpen(true);
    } catch {
      // penyimpanan tidak tersedia
    }
    const onResize = () => setWide(isWide());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Layar lebar: konten bergeser ke kiri selebar panel.
  useEffect(() => {
    document.documentElement.style.setProperty("--history-w", open && wide ? "320px" : "0px");
    return () => document.documentElement.style.setProperty("--history-w", "0px");
  }, [open, wide]);

  // Layar kecil: tutup panel setelah pindah halaman (bukan saat pertama dimuat).
  const lastPath = useRef(path);
  useEffect(() => {
    if (lastPath.current === path) return;
    lastPath.current = path;
    if (window.innerWidth < WIDE) setOpen(false);
  }, [path]);

  const toggle = (v: boolean) => {
    setOpen(v);
    try {
      if (wide) localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      // abaikan
    }
  };

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? chats.filter((c) => c.title.toLowerCase().includes(t)) : chats;
  }, [chats, q]);

  return (
    <>
      {/* Tab di tepi kanan (saat panel tertutup) */}
      {!open && (
        <button
          type="button"
          onClick={() => toggle(true)}
          aria-label={`Buka riwayat chat (${chats.length})`}
          className="group fixed top-1/2 right-0 z-30 flex -translate-y-1/2 flex-col items-center gap-2 rounded-l-2xl bg-white py-3 pr-2 pl-2.5 text-slate-500 shadow-lift ring-1 ring-line transition hover:pr-3 hover:text-ink max-lg:top-auto max-lg:bottom-24 max-lg:translate-y-0"
        >
          <History size={18} />
          <span className="text-[11px] font-bold tracking-wide [writing-mode:vertical-rl] max-lg:hidden">Riwayat</span>
          {chats.length > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">{chats.length}</span>}
        </button>
      )}

      {/* Latar gelap (layar kecil) */}
      {open && !wide && <div className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[1px]" onClick={() => toggle(false)} aria-hidden />}

      <aside
        aria-label="Riwayat chat"
        aria-hidden={!open}
        className={`fixed top-0 right-0 z-50 flex h-dvh w-[320px] max-w-[88vw] flex-col border-l border-line bg-canvas transition-[transform,box-shadow] duration-300 ease-out ${
          open ? "translate-x-0 shadow-[-20px_0_60px_-30px_rgb(15_18_34/0.35)]" : "pointer-events-none invisible translate-x-full shadow-none"
        }`}
      >
        <div className="flex items-center gap-2 px-4 pt-5 pb-3">
          <History size={17} className="text-brand-600" />
          <h2 className="flex-1 text-sm font-extrabold tracking-tight text-ink">Riwayat chat</h2>
          <button type="button" onClick={() => toggle(false)} aria-label="Minimize riwayat" title="Minimize" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-ink">
            {wide ? <PanelRightClose size={17} /> : <X size={17} />}
          </button>
        </div>
        <div className="space-y-2 px-4 pb-3">
          <Link
            href="/beranda"
            onClick={() => !wide && toggle(false)}
            className="flex items-center justify-center gap-2 rounded-xl bg-ink px-3 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-ink/90"
          >
            <Plus size={15} strokeWidth={2.6} /> Chat baru
          </Link>
          {chats.length > 5 && (
            <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-line focus-within:ring-2 focus-within:ring-brand-400">
              <Search size={14} className="text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari chat…" aria-label="Cari chat" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
            </label>
          )}
        </div>
        <nav className="scrollbar-none flex-1 overflow-y-auto px-2 pb-6">
          {list.length ? (
            list.map((c) => {
              const on = path === `/chat/${c.id}`;
              return (
                <Link
                  key={c.id}
                  href={`/chat/${c.id}`}
                  aria-current={on ? "page" : undefined}
                  title={c.title}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition ${on ? "bg-white font-semibold text-ink ring-1 ring-line" : "text-slate-600 hover:bg-white/70"}`}
                >
                  <MessageSquareText size={15} className="shrink-0 text-slate-400" />
                  <span className="truncate">{c.title}</span>
                </Link>
              );
            })
          ) : (
            <p className="px-3 py-2 text-sm text-slate-400">{q ? "Tidak ada chat yang cocok." : "Belum ada percakapan."}</p>
          )}
        </nav>
      </aside>
    </>
  );
}
