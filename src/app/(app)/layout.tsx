import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/logo";
import { SideNav, TabBar } from "@/components/app-nav";
import { requireWorkspace } from "@/lib/session";
import { logoutAction } from "@/app/auth-actions";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, w } = await requireWorkspace();
  const [brand, ideas, posts] = await Promise.all([w.getBrand(), w.listIdeas(), w.listPosts()]);
  if (!brand.onboarded) redirect("/onboarding");

  const badges = {
    "/ideas": ideas.filter((i) => i.status === "pending").length,
    "/posts": posts.filter((p) => p.status === "review" || p.status === "failed").length,
  };
  const initials = (brand.name || user.name).split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line bg-canvas px-4 py-5 lg:flex">
        <Link href="/studio" className="px-2">
          <Logo size={30} />
        </Link>

        <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-soft ring-1 ring-line">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt="" className="h-9 w-9 rounded-lg bg-slate-50 object-contain p-1 ring-1 ring-line" />
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-lg text-xs font-bold text-white" style={{ background: brand.colors.primary }}>
              {initials}
            </span>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{brand.name}</div>
            <div className="truncate text-xs text-slate-500">Workspace</div>
          </div>
        </div>

        <SideNav badges={badges} />

        <div className="mt-auto flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">{user.name.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{user.name}</div>
            <div className="truncate text-xs text-slate-500">{user.email}</div>
          </div>
          <form action={logoutAction}>
            <button aria-label="Keluar" title="Keluar" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-ink">
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </aside>

      {/* Header (mobile) */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-canvas/85 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/studio">
          <Logo size={28} />
        </Link>
        <span className="max-w-[45%] truncate rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-line">{brand.name}</span>
      </header>

      <main className="mx-auto w-full max-w-6xl overflow-x-clip px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">{children}</main>
      <TabBar badges={badges} />
    </div>
  );
}
