import Link from "next/link";
import { db } from "@/lib/db";
import { ActionForm, Submit } from "@/components/forms";
import { Card, Field, PageTitle, Pill, inputCls } from "@/components/ui";
import { approveIdeaAction, generateIdeasAction, rejectIdeaAction } from "../actions";
import type { Idea } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function IdeasPage() {
  const ideas = await db().listIdeas();
  const pending = ideas.filter((i) => i.status === "pending");
  const history = ideas.filter((i) => i.status !== "pending").slice(0, 30);

  return (
    <div className="space-y-6">
      <PageTitle title="Ide konten" subtitle="Langkah 1 — tulis brief, AI usulkan ide. ACC ide yang kamu suka, AI langsung buatkan kontennya." />

      <Card>
        <ActionForm action={generateIdeasAction} className="grid gap-4 md:grid-cols-[1fr_160px_auto] md:items-end" resetOnOk>
          <Field label="Brief minggu ini (opsional)" hint="Contoh: “Minggu ini fokus promo fitur baru X, plus 2 konten edukasi untuk UMKM.”">
            <textarea name="brief" rows={2} className={inputCls} placeholder="Apa yang ingin dibahas / dipromosikan?" />
          </Field>
          <Field label="Jumlah ide">
            <select name="count" defaultValue="6" className={inputCls}>
              {[3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n} ide</option>)}
            </select>
          </Field>
          <Submit pendingText="AI sedang mikir…" className="md:mb-0.5">✨ Buat ide</Submit>
        </ActionForm>
      </Card>

      <section>
        <h2 className="mb-3 font-semibold">Menunggu ACC ({pending.length})</h2>
        {pending.length === 0 && <p className="text-sm text-slate-500">Belum ada ide baru. Isi brief di atas lalu klik “Buat ide”.</p>}
        <div className="grid gap-4 md:grid-cols-2">
          {pending.map((idea) => <IdeaCard key={idea.id} idea={idea} />)}
        </div>
      </section>

      {history.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Riwayat</h2>
          <Card className="p-0">
            <ul className="divide-y divide-slate-100">
              {history.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className={`truncate ${i.status === "rejected" ? "text-slate-400 line-through" : ""}`}>{i.title}</span>
                  {i.post_id ? (
                    <Link href={`/posts/${i.post_id}`} className="shrink-0 font-medium text-indigo-600">Lihat konten</Link>
                  ) : (
                    <span className="shrink-0 text-xs text-slate-400">{i.status === "rejected" ? "Ditolak" : "ACC"}</span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}

function IdeaCard({ idea }: { idea: Idea }) {
  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap gap-2">
        <Pill tone="indigo">{idea.format === "carousel" ? "Carousel" : "Single post"}</Pill>
        <Pill>{idea.pillar}</Pill>
      </div>
      <h3 className="mt-3 text-lg font-semibold leading-snug">{idea.title}</h3>
      <p className="mt-2 text-sm font-medium text-slate-800">“{idea.hook}”</p>
      <p className="mt-2 text-sm text-slate-600">{idea.angle}</p>
      <p className="mt-2 text-xs text-slate-500">Kenapa: {idea.rationale}</p>
      <div className="mt-4 flex gap-2 pt-2">
        <ActionForm action={approveIdeaAction.bind(null, idea.id)}>
          <Submit variant="approve" pendingText="AI menulis & mendesain…">✓ ACC ide</Submit>
        </ActionForm>
        <ActionForm action={rejectIdeaAction.bind(null, idea.id)}>
          <Submit variant="danger" pendingText="…">Tolak</Submit>
        </ActionForm>
      </div>
    </Card>
  );
}
