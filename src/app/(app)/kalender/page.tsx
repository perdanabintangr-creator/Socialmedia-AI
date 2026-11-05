import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { requireWorkspace } from "@/lib/session";
import type { Post } from "@/lib/types";

export const metadata = { title: "Kalender konten" };
export const dynamic = "force-dynamic";

const TZ = "Asia/Jakarta";
const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const time = (iso: string) => new Intl.DateTimeFormat("id-ID", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const DOT: Record<Post["status"], string> = {
  review: "bg-amber-400",
  approved: "bg-sky-500",
  scheduled: "bg-brand-500",
  published: "bg-emerald-500",
  failed: "bg-red-500",
  rejected: "bg-slate-300",
};
const LABEL: Partial<Record<Post["status"], string>> = {
  approved: "ACC, belum terkirim",
  scheduled: "Terjadwal",
  published: "Terbit",
  failed: "Gagal",
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  const { w } = await requireWorkspace();
  const posts = await w.listPosts();
  const today = ymd(new Date());
  const q = (await searchParams).bulan;
  const [year, month] = (q && /^\d{4}-\d{2}$/.test(q) ? q : today.slice(0, 7)).split("-").map(Number);

  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Senin = 0
  const cells = Array.from({ length: Math.ceil((lead + daysInMonth) / 7) * 7 }, (_, i) => {
    const day = i - lead + 1;
    return day >= 1 && day <= daysInMonth ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;
  });

  const dated = posts.filter((p) => p.scheduled_at && ["approved", "scheduled", "published", "failed"].includes(p.status));
  const byDay = new Map<string, Post[]>();
  for (const p of dated) {
    const k = ymd(new Date(p.scheduled_at!));
    byDay.set(k, [...(byDay.get(k) ?? []), p].sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!)));
  }
  const monthPosts = dated.filter((p) => ymd(new Date(p.scheduled_at!)).startsWith(`${year}-${String(month).padStart(2, "0")}`)).sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!));
  const waiting = posts.filter((p) => p.status === "review");

  const shift = (n: number) => {
    const d = new Date(Date.UTC(year, month - 1 + n, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const title = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const thumb = (p: Post) => p.media_urls[0] ?? `/api/render/${p.id}/0?v=${encodeURIComponent(p.updated_at)}`;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight">Kalender konten</h1>
          <p className="mt-1 text-sm text-slate-500">Semua konten yang sudah di-ACC dan jadwal tayangnya.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/kalender?bulan=${shift(-1)}`} aria-label="Bulan sebelumnya" className="grid h-10 w-10 place-items-center rounded-xl bg-white ring-1 ring-line hover:bg-slate-50">
            <ChevronLeft size={18} />
          </Link>
          <span className="min-w-36 text-center font-bold capitalize">{title}</span>
          <Link href={`/kalender?bulan=${shift(1)}`} aria-label="Bulan berikutnya" className="grid h-10 w-10 place-items-center rounded-xl bg-white ring-1 ring-line hover:bg-slate-50">
            <ChevronRight size={18} />
          </Link>
          <Link href="/beranda" className="ml-2 inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink/85">
            <Plus size={16} /> Buat konten
          </Link>
        </div>
      </div>

      {waiting.length > 0 && (
        <Link href="/posts?status=review" className="mb-5 flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100/70">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span className="flex-1">
            <b>{waiting.length} konten</b> menunggu ACC kamu sebelum bisa dijadwalkan.
          </span>
          <ChevronRight size={16} />
        </Link>
      )}

      {/* Grid bulan (tablet & desktop) */}
      <div className="hidden overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-line md:block">
        <div className="grid grid-cols-7 border-b border-line bg-canvas/60 text-xs font-bold tracking-wide text-slate-400 uppercase">
          {DAYS.map((d) => (
            <div key={d} className="px-3 py-2.5">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const items = day ? byDay.get(day) ?? [] : [];
            return (
              <div key={i} className={`min-h-32 border-b border-line p-2 ${i % 7 ? "border-l" : ""} ${day ? "" : "bg-canvas/50"}`}>
                {day && (
                  <>
                    <div className={`mb-1.5 grid h-7 w-7 place-items-center rounded-full text-sm font-semibold ${day === today ? "bg-brand-600 text-white" : "text-slate-500"}`}>
                      {Number(day.slice(8))}
                    </div>
                    <div className="space-y-1.5">
                      {items.slice(0, 2).map((p) => (
                        <Link key={p.id} href={`/posts/${p.id}`} className="flex items-center gap-2 rounded-lg bg-canvas p-1 pr-2 ring-1 ring-line hover:ring-brand-300" title={p.title}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={thumb(p)} alt="" loading="lazy" className="h-8 w-7 shrink-0 rounded object-cover" />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                              <span className={`h-1.5 w-1.5 rounded-full ${DOT[p.status]}`} />
                              {time(p.scheduled_at!)}
                            </span>
                            <span className="block truncate text-xs font-medium">{p.title}</span>
                          </span>
                        </Link>
                      ))}
                      {items.length > 2 && <div className="px-1 text-xs font-semibold text-brand-600">+{items.length - 2} lainnya</div>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Agenda (HP) */}
      <div className="space-y-3 md:hidden">
        {monthPosts.length ? (
          monthPosts.map((p) => (
            <Link key={p.id} href={`/posts/${p.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-soft ring-1 ring-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb(p)} alt="" loading="lazy" className="h-16 w-13 shrink-0 rounded-lg object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-slate-500">
                  {new Intl.DateTimeFormat("id-ID", { timeZone: TZ, weekday: "long", day: "numeric", month: "short" }).format(new Date(p.scheduled_at!))} · {time(p.scheduled_at!)}
                </span>
                <span className="block truncate font-semibold">{p.title}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <span className={`h-1.5 w-1.5 rounded-full ${DOT[p.status]}`} /> {LABEL[p.status]}
                </span>
              </span>
            </Link>
          ))
        ) : null}
      </div>

      {monthPosts.length === 0 && (
        <div className="mt-6 rounded-3xl border border-dashed border-line bg-white/60 px-6 py-12 text-center">
          <p className="font-semibold">Belum ada konten di bulan ini</p>
          <p className="mt-1 text-sm text-slate-500">Minta tim AI membuat konten, ACC, lalu pilih jadwal tayangnya.</p>
          <Link href="/beranda" className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink/85">
            <Plus size={16} /> Buat konten
          </Link>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-4 text-xs text-slate-500">
        {(["scheduled", "approved", "published", "failed"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${DOT[s]}`} /> {LABEL[s]}
          </span>
        ))}
      </div>
    </div>
  );
}
