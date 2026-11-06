"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CheckCheck, Home, Stethoscope, LayoutGrid, Lightbulb, MessageSquareText, Palette, Plus, Settings2, TrendingUp } from "lucide-react";

export const NAV = [
  { href: "/beranda", label: "Beranda", short: "Beranda", icon: Home, mobile: true },
  { href: "/acc", label: "Mode ACC", short: "ACC", icon: CheckCheck, mobile: true },
  { href: "/posts", label: "Hasil konten", short: "Konten", icon: LayoutGrid, mobile: false },
  { href: "/ideas", label: "Bank ide", short: "Ide", icon: Lightbulb, mobile: false },
  { href: "/kalender", label: "Kalender konten", short: "Kalender", icon: CalendarDays, mobile: true },
  { href: "/performa", label: "Performa", short: "Performa", icon: TrendingUp, mobile: true },
  { href: "/audit", label: "Audit akun", short: "Audit", icon: Stethoscope, mobile: false },
  { href: "/brand", label: "Brand Kit", short: "Brand", icon: Palette, mobile: false },
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
      <nav className="flex flex-col gap-0.5" aria-label="Navigasi utama">
        {NAV.map(({ href, label, icon: Icon }) => {
          const on = active(path, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                on ? "bg-white text-ink shadow-soft ring-1 ring-line" : "text-slate-500 hover:bg-white/70 hover:text-ink"
              }`}
            >
              <span className={`grid h-7 w-7 place-items-center rounded-lg transition ${on ? "bg-social text-white" : "text-slate-400 group-hover:text-slate-600"}`}>
                <Icon size={16} strokeWidth={on ? 2.4 : 2} />
              </span>
              <span className="flex-1">{label}</span>
              {badges[href] ? (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-pop px-1.5 text-[11px] font-bold text-white">{badges[href]}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="flex min-h-[132px] flex-1 flex-col">
        <div className="flex items-center justify-between px-3 pb-1.5">
          <span className="text-xs font-bold tracking-wide text-slate-400 uppercase">Riwayat chat</span>
          <Link href="/beranda" title="Chat baru" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-brand-600 hover:bg-white">
            <Plus size={13} strokeWidth={2.6} /> Baru
          </Link>
        </div>
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
              <Icon size={21} strokeWidth={on ? 2.4 : 1.9} className={on ? "text-ink" : "text-slate-400"} />
              {on && <span className="bg-social absolute top-0 h-0.5 w-8 rounded-full" />}
              <span className={on ? "text-ink" : "text-slate-500"}>{n.short}</span>
              {badges[n.href] ? <span className="absolute top-1.5 left-[calc(50%+6px)] h-2 w-2 rounded-full bg-pop ring-2 ring-white" /> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
