import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { config } from "@/lib/config";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { logoutAction } from "./auth-actions";

export const metadata: Metadata = {
  title: "Social Media AI",
  description: "Brief → ide → konten → posting otomatis, tinggal ACC.",
};

const NAV = [
  { href: "/", label: "Studio" },
  { href: "/dashboard", label: "Ringkasan" },
  { href: "/ideas", label: "Ide" },
  { href: "/posts", label: "Konten" },
  { href: "/brand", label: "Brand Kit" },
];

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  const path = (await headers()).get("x-pathname");
  // Halaman terlindungi (middleware mengisi x-pathname) tapi akun tidak aktif lagi → keluar.
  if (path && !user) redirect("/login");
  return (
    <html lang="id">
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm text-white">S</span>
              Social Media AI
            </Link>
            <nav className={`flex flex-1 gap-1 overflow-x-auto text-sm ${user ? "" : "invisible"}`}>
              {(user ? [...NAV, { href: "/pengguna", label: user.role === "admin" ? "Pengguna" : "Akun" }] : []).map((n) => (
                <Link key={n.href} href={n.href} className="rounded-lg px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2 text-xs">
              {user && !config.hasAI && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">AI: demo</span>}
              {user && !config.hasPublisher && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">Auto-post: off</span>}
              {user && (
                <form action={logoutAction} className="flex items-center gap-2">
                  <span className="hidden max-w-[10rem] truncate font-medium text-slate-600 sm:inline">{user.name}</span>
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
