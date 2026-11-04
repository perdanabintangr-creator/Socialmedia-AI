"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, LayoutGrid, Lightbulb, MessagesSquare, Palette, Settings2 } from "lucide-react";

export const NAV = [
  { href: "/studio", label: "Studio", icon: MessagesSquare, mobile: true },
  { href: "/posts", label: "Konten", icon: LayoutGrid, mobile: true },
  { href: "/ideas", label: "Ide", icon: Lightbulb, mobile: true },
  { href: "/dashboard", label: "Ringkasan", icon: BarChart3, mobile: false },
  { href: "/brand", label: "Brand Kit", icon: Palette, mobile: true },
  { href: "/pengguna", label: "Akun", icon: Settings2, mobile: true },
] as const;

function active(path: string, href: string) {
  return path === href || path.startsWith(href + "/");
}

export function SideNav({ badges }: { badges: Partial<Record<string, number>> }) {
  const path = usePathname();
  return (
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
  );
}

export function TabBar({ badges }: { badges: Partial<Record<string, number>> }) {
  const path = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      aria-label="Navigasi utama"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {NAV.filter((n) => n.mobile).map(({ href, label, icon: Icon }) => {
          const on = active(path, href);
          return (
            <Link key={href} href={href} aria-current={on ? "page" : undefined} className="relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold">
              <Icon size={21} strokeWidth={on ? 2.4 : 1.9} className={on ? "text-brand-600" : "text-slate-400"} />
              <span className={on ? "text-ink" : "text-slate-500"}>{label}</span>
              {badges[href] ? <span className="absolute top-1.5 left-[calc(50%+6px)] h-2 w-2 rounded-full bg-brand-600 ring-2 ring-white" /> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
