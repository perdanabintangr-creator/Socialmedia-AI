import Link from "next/link";
import { headers } from "next/headers";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/logo";
import { SideNav, TabBar } from "@/components/app-nav";
import { requireWorkspace } from "@/lib/session";
import { logoutAction } from "@/app/auth-actions";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, w } = await requireWorkspace();
  const [brand, ideas, posts, chats] = await Promise.all([w.getBrand(), w.listIdeas(), w.listPosts(), w.listChats(30)]);
  const path = (await headers()).get("x-pathname") ?? "";
  const fullBleed = path.startsWith("/chat/");

  const badges = {
    "/ideas": ideas.filter((i) => i.status === "pending").length,
    "/posts": posts.filter((p) => p.status === "review" || p.status === "failed").length,
  };
  const initials = (brand.name || user.name).split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  const plan = user.role === "admin" ? "Admin" : "Gratis";

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 border-r border-line bg-canvas px-4 py-5 lg:flex">
        <div className="flex items-center justify-between px-1">
          <Link href="/beranda">
            <Logo size={30} />
          </Link>
        </div>

        {/* Profil brand ala aplikasi sosmed */}
        <Link href="/brand" className="flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-soft ring-1 ring-line transition hover:ring-brand-200">
          <span className="story-ring shrink-0">
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt="" className="block h-10 w-10 bg-white object-contain p-1" />
            ) : (
              <span className="grid h-10 w-10 place-items-center text-xs font-bold text-white" style={{ background: brand.colors.primary }}>
                {initials}
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{brand.name}</span>
            <span className="block truncate text-xs text-slate-500">{brand.handle || "Brand Kit"}</span>
          </span>
        </Link>

        <SideNav badges={badges} chats={chats.map((c) => ({ id: c.id, title: c.title }))} />

        <div className="space-y-2 border-t border-line pt-4">
          <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
            <Link href="/pengguna" className="flex min-w-0 flex-1 items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{user.name.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{user.name}</span>
                <span className="mt-0.5 inline-flex rounded-full bg-white px-2 py-px text-[11px] font-semibold text-slate-500 ring-1 ring-line">{plan}</span>
              </span>
            </Link>
            <form action={logoutAction}>
              <button aria-label="Keluar" title="Keluar" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-ink">
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Header (mobile) */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-canvas/85 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/beranda">
          <Logo size={28} />
        </Link>
        <Link href="/brand" className="max-w-[45%] truncate rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-line">
          {brand.name}
        </Link>
      </header>

      <main className={fullBleed ? "min-w-0" : "mx-auto w-full max-w-6xl overflow-x-clip px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12"}>{children}</main>
      <TabBar badges={badges} />
    </div>
  );
}
