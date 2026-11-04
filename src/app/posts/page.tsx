import { requireWorkspace } from "@/lib/session";
import Link from "next/link";
import { Card, PageTitle, StatusBadge, formatWIB } from "@/components/ui";
import type { PostStatus } from "@/lib/types";

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
  const posts = (await w.listPosts()).filter((p) => tab.match.includes(p.status));

  return (
    <div>
      <PageTitle title="Konten" subtitle="Langkah 2 & 3 — review desain + caption, lalu ACC untuk dijadwalkan." />
      <div className="mb-5 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <Link key={t.key} href={`/posts?status=${t.key}`} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${t.key === tab.key ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
            {t.label}
          </Link>
        ))}
      </div>
      {posts.length === 0 && <p className="text-sm text-slate-500">Belum ada konten di sini. ACC sebuah ide untuk membuat konten.</p>}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {posts.map((p) => (
          <Link key={p.id} href={`/posts/${p.id}`}>
            <Card className="h-full p-3 transition hover:ring-indigo-300">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.media_urls[0] ?? `/api/render/${p.id}/0?v=${encodeURIComponent(p.updated_at)}`} alt="" className="aspect-[4/5] w-full rounded-lg bg-slate-100 object-cover" loading="lazy" />
              <div className="mt-3 flex items-center justify-between gap-2">
                <StatusBadge status={p.status} />
                <span className="text-xs text-slate-400">{p.slides.length > 1 ? `${p.slides.length} slide` : "Single"}</span>
              </div>
              <div className="mt-2 line-clamp-2 text-sm font-medium">{p.title}</div>
              {p.scheduled_at && <div className="mt-1 text-xs text-slate-500">{formatWIB(p.scheduled_at)}</div>}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
