import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { config } from "@/lib/config";
import { logout } from "./actions";

export const metadata: Metadata = {
  title: "Marqthink Social Autopilot",
  description: "Brief → ide → konten → posting otomatis, tinggal ACC.",
};

const NAV = [
  { href: "/", label: "Studio" },
  { href: "/dashboard", label: "Ringkasan" },
  { href: "/ideas", label: "Ide" },
  { href: "/posts", label: "Konten" },
  { href: "/brand", label: "Brand Kit" },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm text-white">M</span>
              Social Autopilot
            </Link>
            <nav className="flex flex-1 gap-1 overflow-x-auto text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-lg px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2 text-xs">
              {!config.hasAI && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">AI: demo</span>}
              {!config.hasPublisher && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">Auto-post: off</span>}
              {process.env.ADMIN_PASSWORD && (
                <form action={logout}>
                  <button className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">Keluar</button>
                </form>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
