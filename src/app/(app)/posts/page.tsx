import Link from "next/link";
import { Plus } from "lucide-react";
import { PostGrid } from "@/components/post-grid";
import { requireWorkspace } from "@/lib/session";
import { PageTitle, formatWIB } from "@/components/ui";
import type { PostStatus } from "@/lib/types";

export const metadata = { title: "Hasil konten" };
export const dynamic = "force-dynamic";

const TABS: { key: string; label: string; match: PostStatus[] }[] = [
  { key: "all", label: "Semua", match: ["review", "approved", "scheduled", "published", "failed", "rejected"] },
  { key: "review", label: "Menunggu ACC", match: ["review", "failed"] },
  { key: "scheduled", label: "Siap / Terjadwal", match: ["approved", "scheduled"] },
  { key: "published", label: "Terbit", match: ["published"] },
];

export default async function PostsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { w } = await requireWorkspace();
  const { status = "all" } = await searchParams;
  const tab = TABS.find((t) => t.key === status) ?? TABS[0];
  const all = await w.listPosts();
  const posts = all.filter((p) => tab.match.includes(p.status));
  const count = (t: (typeof TABS)[number]) => all.filter((p) => t.match.includes(p.status)).length;

  return (
    <div>
      <PageTitle title="Hasil konten" subtitle="Semua desain dari tim AI. Klik untuk cek preview di HP, revisi, lalu ACC.">
        <Link href="/beranda" className="bg-social inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-soft hover:brightness-105">
          <Plus size={16} /> Konten baru
        </Link>
      </PageTitle>

      <div className="scrollbar-none mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => {
          const on = t.key === tab.key;
          return (
            <Link
              key={t.key}
              href={`/posts?status=${t.key}`}
              aria-current={on ? "page" : undefined}
              className={`relative -mb-px flex items-center gap-2 px-3.5 py-3 text-sm font-semibold whitespace-nowrap transition ${on ? "text-ink" : "text-slate-500 hover:text-ink"}`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${on ? "bg-ink text-white" : "bg-slate-100 text-slate-500"}`}>{count(t)}</span>
              {on && <span className="bg-social absolute inset-x-2 bottom-0 h-0.5 rounded-full" />}
            </Link>
          );
        })}
      </div>

      {posts.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border-2 border-dashed border-line px-6 py-16 text-center">
          <p className="font-semibold">Belum ada konten di sini</p>
          <p className="mt-1 text-sm text-slate-500">Minta ide atau konten ke tim AI dari Beranda.</p>
        </div>
      ) : (
        <PostGrid
          posts={posts.map((p) => ({
            id: p.id,
            title: p.title,
            status: p.status,
            slides: p.slides.length,
            thumb: p.media_urls[0] ?? `/api/render/${p.id}/0?v=${encodeURIComponent(p.updated_at)}`,
            scheduledLabel: p.scheduled_at ? formatWIB(p.scheduled_at) : null,
          }))}
        />
      )}
    </div>
  );
}
