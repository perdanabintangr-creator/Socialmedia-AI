import Link from "next/link";
import { CheckCheck } from "lucide-react";
import { requireWorkspace } from "@/lib/session";
import { PageTitle } from "@/components/ui";
import { quotaOf } from "@/lib/plans";
import { batchProgress } from "@/lib/month";
import { isRevising } from "@/lib/pipeline";
import { AccList, MonthPlan, type AccItem } from "@/components/acc";

export const metadata = { title: "Mode ACC" };
export const dynamic = "force-dynamic";
export const maxDuration = 300; // ACC (render & upload) dan pemicu antrean berjalan di sini

const toWibLocal = (iso: string) => {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
};

export default async function AccPage() {
  const { w } = await requireWorkspace();
  const [posts, ideas, quota, brand] = await Promise.all([w.listPosts(), w.listIdeas(), quotaOf(w), w.getBrand()]);
  const progress = batchProgress(ideas);
  const review = posts
    .filter((p) => p.status === "review" || p.status === "failed")
    .sort((a, b) => (a.planned_at ?? "9999").localeCompare(b.planned_at ?? "9999") || b.created_at.localeCompare(a.created_at));
  const failedIdeas = progress ? ideas.filter((i) => i.batch?.id === progress.id && i.batch.state === "failed") : [];

  const items: AccItem[] = review.map((p) => ({
    id: p.id,
    title: p.title,
    format: p.format,
    slides: p.slides.length,
    caption: p.caption,
    notes: p.design_notes,
    status: p.status,
    error: p.error,
    revisions: p.revision_count,
    revising: isRevising(p),
    plannedLocal: p.planned_at ? toWibLocal(p.planned_at) : null,
    version: p.updated_at,
  }));

  return (
    <div>
      <PageTitle
        title="Mode ACC"
        subtitle="Semua konten yang menunggu persetujuanmu dalam satu tempat. ACC satu per satu atau sekaligus, minta AI merevisi otomatis, atau kasih arahan sendiri."
      >
        <Link href="/kalender" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-soft ring-1 ring-line hover:ring-brand-200">
          <CheckCheck size={16} /> Lihat kalender
        </Link>
      </PageTitle>

      <MonthPlan
        progress={progress}
        quotaLeft={Number.isFinite(quota.left) ? quota.left : 999}
        planLabel={quota.plan.label}
        defaultStyle={brand.visualStyle ?? "auto"}
        failed={failedIdeas.map((i) => ({ title: i.title, error: i.batch?.error ?? "" }))}
        compact={items.length > 0}
      />

      <AccList items={items} batchRunning={Boolean(progress?.running)} />
    </div>
  );
}
