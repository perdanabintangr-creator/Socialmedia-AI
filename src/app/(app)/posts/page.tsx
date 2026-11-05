import Link from "next/link";
import { CalendarClock, Copy, Plus } from "lucide-react";
import { requireWorkspace } from "@/lib/session";
import { PageTitle, StatusBadge, formatWIB } from "@/components/ui";
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
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
          {posts.map((p) => (
            <Link key={p.id} href={`/posts/${p.id}`} className="group">
              <div className="relative overflow-hidden rounded-2xl bg-slate-100 shadow-soft ring-1 ring-line transition group-hover:-translate-y-0.5 group-hover:shadow-lift">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.media_urls[0] ?? `/api/render/${p.id}/0?v=${encodeURIComponent(p.updated_at)}`}
                  alt=""
                  className="aspect-[4/5] w-full object-cover"
                  loading="lazy"
                />
                {p.slides.length > 1 && (
                  <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                    <Copy size={12} /> {p.slides.length}
                  </span>
                )}
                <span className="absolute bottom-2.5 left-2.5">
                  <StatusBadge status={p.status} />
                </span>
              </div>
              <div className="mt-2.5 line-clamp-2 text-sm font-semibold">{p.title}</div>
              {p.scheduled_at && (
                <div className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                  <CalendarClock size={12} /> {formatWIB(p.scheduled_at)}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
