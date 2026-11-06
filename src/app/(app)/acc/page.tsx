import Link from "next/link";
import { CalendarDays, CheckCheck } from "lucide-react";
import { requireWorkspace } from "@/lib/session";
import { PageTitle } from "@/components/ui";
import { quotaOf } from "@/lib/plans";
import { batchProgress, proposedIdeas } from "@/lib/month";
import { isRevising } from "@/lib/pipeline";
import { ContentList, IdeaPlan, Planner, QueueProgress, type AccItem } from "@/components/acc";
import type { Post } from "@/lib/types";

export const metadata = { title: "Mode ACC" };
export const dynamic = "force-dynamic";
export const maxDuration = 300; // ACC, revisi & pemicu antrean berjalan di sini

const parts = (iso: string) => {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  return (t: string) => p.find((x) => x.type === t)?.value ?? "00";
};
const toWibLocal = (iso: string) => {
  const g = parts(iso);
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
};
/** "Sen, 9 Nov · 19.00" */
const whenLabel = (iso: string) => {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", weekday: "short", day: "numeric", month: "short" }).format(d);
  const time = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return `${day} · ${time}`;
};

const toItem = (p: Post): AccItem => {
  const when = p.status === "approved" || p.status === "scheduled" ? (p.scheduled_at ?? p.planned_at) : p.planned_at;
  return {
    id: p.id,
    title: p.title,
    format: p.format,
    slides: p.slides.length,
    caption: p.caption,
    notes: p.design_notes,
    status: p.status,
    error: p.status === "failed" ? `Gagal terbit sebelumnya${p.error ? `: ${p.error}` : ""}` : null,
    revisions: p.revision_count,
    revising: isRevising(p),
    plannedLocal: when ? toWibLocal(when) : null,
    whenLabel: when ? whenLabel(when) : null,
    version: p.updated_at,
  };
};

export default async function AccPage() {
  const { w } = await requireWorkspace();
  const [posts, ideas, quota, brand] = await Promise.all([w.listPosts(), w.listIdeas(), quotaOf(w), w.getBrand()]);
  const progress = batchProgress(ideas);
  const proposals = proposedIdeas(ideas);
  const now = Date.now();
  const byDate = (a: Post, b: Post) => (a.scheduled_at ?? a.planned_at ?? "9999").localeCompare(b.scheduled_at ?? b.planned_at ?? "9999");
  const scheduled = posts
    .filter((p) => (p.status === "approved" || p.status === "scheduled") && p.scheduled_at && new Date(p.scheduled_at).getTime() > now)
    .sort(byDate);
  const review = posts.filter((p) => p.status === "review" || p.status === "failed").sort(byDate);
  const failedIdeas = ideas.filter((i) => i.batch?.state === "failed" && Date.now() - new Date(i.created_at).getTime() < 7 * 24 * 3600_000);
  const nothing = !proposals.length && !scheduled.length && !review.length && !progress?.running;

  return (
    <div>
      <PageTitle title="Mode ACC" subtitle="ACC idenya, sisanya otomatis: konten dibuat, dijadwalkan, dan tayang sendiri. Revisi kapan saja sebelum tayang.">
        <Link href="/kalender" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-soft ring-1 ring-line hover:ring-brand-200">
          <CalendarDays size={16} /> Kalender
        </Link>
      </PageTitle>

      <Planner
        quotaLeft={Number.isFinite(quota.left) ? quota.left : 999}
        planLabel={quota.plan.label}
        defaultStyle={brand.visualStyle ?? "auto"}
        compact={!nothing}
      />

      <QueueProgress progress={progress} />

      {failedIdeas.length > 0 && (
        <p className="mb-6 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-100">
          {failedIdeas.length} ide gagal dibuat: {failedIdeas.slice(0, 3).map((i) => `“${i.title}” (${i.batch?.error ?? "error"})`).join(", ")}
        </p>
      )}

      <IdeaPlan
        ideas={proposals.map((i) => ({
          id: i.id,
          title: i.title,
          hook: i.hook,
          pillar: i.pillar,
          format: i.format,
          plannedLocal: toWibLocal(i.batch!.plannedAt),
          whenLabel: whenLabel(i.batch!.plannedAt),
        }))}
      />

      <ContentList items={scheduled.map(toItem)} variant="scheduled" />
      <ContentList items={review.map(toItem)} variant="review" />

      {nothing && (
        <div className="rounded-3xl border-2 border-dashed border-line px-6 py-12 text-center">
          <CheckCheck className="mx-auto text-slate-300" size={36} />
          <p className="mt-3 font-bold text-ink">Belum ada yang perlu di-ACC</p>
          <p className="mt-1 text-sm text-slate-500">Susun ide seminggu atau sebulan di atas — setelah kamu ACC, semuanya berjalan otomatis.</p>
        </div>
      )}
    </div>
  );
}
