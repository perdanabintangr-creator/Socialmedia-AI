"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, LayoutGrid, Lightbulb, MessageSquareText, Palette, Plus, Settings2 } from "lucide-react";

export const NAV = [
  { href: "/beranda", label: "Beranda", icon: Home, mobile: true },
  { href: "/posts", label: "Hasil konten", short: "Konten", icon: LayoutGrid, mobile: true },
  { href: "/ideas", label: "Bank ide", short: "Ide", icon: Lightbulb, mobile: false },
  { href: "/kalender", label: "Kalender konten", short: "Kalender", icon: CalendarDays, mobile: true },
  { href: "/brand", label: "Brand Kit", short: "Brand", icon: Palette, mobile: true },
] as const;

const active = (path: string, href: string) => path === href || path.startsWith(href + "/");

export interface ChatLink {
  id: string;
  title: string;
}

export function SideNav({ badges, chats }: { badges: Partial<Record<string, number>>; chats: ChatLink[] }) {
  const path = usePathname();
  return (
    <>
      <Link
        href="/beranda"
        className="flex items-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-ink/85"
      >
        <Plus size={18} /> Chat baru
      </Link>

      <nav className="flex flex-col gap-0.5" aria-label="Navigasi utama">
        {NAV.map(({ href, label, icon: Icon }) => {
          const on = active(path, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                on ? "bg-white text-ink shadow-soft ring-1 ring-line" : "text-slate-500 hover:bg-white/70 hover:text-ink"
              }`}
            >
              <Icon size={18} strokeWidth={on ? 2.4 : 2} className={on ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600"} />
              <span className="flex-1">{label}</span>
              {badges[href] ? (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white">{badges[href]}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="px-3 pb-1.5 text-xs font-bold tracking-wide text-slate-400 uppercase">Riwayat</div>
        <div className="scrollbar-none -mx-1 flex-1 overflow-y-auto px-1">
          {chats.length ? (
            chats.map((c) => {
              const on = path === `/chat/${c.id}`;
              return (
                <Link
                  key={c.id}
                  href={`/chat/${c.id}`}
                  aria-current={on ? "page" : undefined}
                  title={c.title}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${on ? "bg-white font-semibold text-ink ring-1 ring-line" : "text-slate-600 hover:bg-white/70"}`}
                >
                  <MessageSquareText size={15} className="shrink-0 text-slate-400" />
                  <span className="truncate">{c.title}</span>
                </Link>
              );
            })
          ) : (
            <p className="px-3 py-2 text-sm text-slate-400">Belum ada percakapan.</p>
          )}
        </div>
      </div>
    </>
  );
}

export function TabBar({ badges }: { badges: Partial<Record<string, number>> }) {
  const path = usePathname();
  const items = [...NAV.filter((n) => n.mobile), { href: "/pengguna", label: "Akun", short: "Akun", icon: Settings2, mobile: true }];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      aria-label="Navigasi utama"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {items.map((n) => {
          const on = active(path, n.href) || (n.href === "/beranda" && path.startsWith("/chat/"));
          const Icon = n.icon;
          return (
            <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined} className="relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold">
              <Icon size={21} strokeWidth={on ? 2.4 : 1.9} className={on ? "text-brand-600" : "text-slate-400"} />
              <span className={on ? "text-ink" : "text-slate-500"}>{"short" in n ? n.short : n.label}</span>
              {badges[n.href] ? <span className="absolute top-1.5 left-[calc(50%+6px)] h-2 w-2 rounded-full bg-brand-600 ring-2 ring-white" /> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
