import { AlertTriangle, CalendarClock, CheckCircle2, Lightbulb, ListChecks, Palette, UserRound } from "lucide-react";
import { requireWorkspace } from "@/lib/session";
import { PageTitle } from "@/components/ui";
import { AuditActions, AuditForm, CopyText } from "@/components/audit";
import { VISUAL_STYLES, isVisualStyle } from "@/lib/types";

export const metadata = { title: "Audit akun" };
export const dynamic = "force-dynamic";
export const maxDuration = 300; // analisis konsultan (vision) bisa ±1 menit

const tone = (n: number) => (n >= 75 ? "text-emerald-600" : n >= 55 ? "text-amber-600" : "text-red-600");
const bar = (n: number) => (n >= 75 ? "bg-emerald-500" : n >= 55 ? "bg-amber-500" : "bg-red-500");
const fmt = (n?: number) => (n === undefined ? null : new Intl.NumberFormat("id-ID", { notation: "compact" }).format(n));

function Ring({ value }: { value: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = value >= 75 ? "#10b981" : value >= 55 ? "#f59e0b" : "#ef4444";
  return (
    <svg viewBox="0 0 128 128" className="h-32 w-32 shrink-0" role="img" aria-label={`Skor ${value} dari 100`}>
      <circle cx="64" cy="64" r={r} fill="none" stroke="#eef0f5" strokeWidth="12" />
      <circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 64 64)" />
      <text x="64" y="62" textAnchor="middle" fontSize="34" fontWeight="800" fill="#14161f">{value}</text>
      <text x="64" y="84" textAnchor="middle" fontSize="12" fill="#64748b">dari 100</text>
    </svg>
  );
}

export default async function AuditPage() {
  const { w } = await requireWorkspace();
  const brand = await w.getBrand();
  const a = brand.audit ?? null;
  const when = (k: string) => a?.actions.filter((x) => x.when === k) ?? [];

  return (
    <div>
      <PageTitle title="Audit akun" subtitle="Konsultan AI menilai akun Instagram/TikTok kamu seperti agency: apa yang sudah bagus, apa yang menghambat, dan langkah konkretnya." >
        {a && <AuditForm hasAudit />}
      </PageTitle>

      {!a && <AuditForm hasAudit={false} />}

      {a && (
        <div className="space-y-6">
          {/* Ringkasan */}
          <section className="flex flex-col gap-6 rounded-3xl bg-white p-5 shadow-soft ring-1 ring-line sm:flex-row sm:items-center sm:p-6">
            <Ring value={a.overall} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold tracking-wide text-slate-400 uppercase">Kesimpulan konsultan</p>
              <p className="mt-1 text-lg font-bold leading-snug text-ink">{a.verdict}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                {a.profile.map((p) => (
                  <span key={p.platform + p.handle} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                    <UserRound size={12} /> {p.platform === "tiktok" ? "TikTok" : "Instagram"} @{p.handle}
                    {fmt(p.followers) && <span className="text-slate-400">· {fmt(p.followers)} followers</span>}
                  </span>
                ))}
                {a.screenshots.length > 0 && <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{a.screenshots.length} screenshot dianalisis</span>}
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-500">
                  {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(a.createdAt))} WIB
                </span>
              </div>
              <div className="mt-4">
                <AuditActions applied={Boolean(a.appliedAt)} />
              </div>
            </div>
          </section>

          {/* Skor per area */}
          <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-line sm:p-6">
            <h2 className="text-lg font-extrabold tracking-tight text-ink">Skor per area</h2>
            <ul className="mt-4 grid gap-x-8 gap-y-4 md:grid-cols-2">
              {a.scores.map((s) => (
                <li key={s.area}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-ink">{s.area}</span>
                    <span className={`text-sm font-extrabold tabular-nums ${tone(s.score)}`}>{s.score}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${bar(s.score)}`} style={{ width: `${Math.max(4, s.score)}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{s.note}</p>
                </li>
              ))}
            </ul>
          </section>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-line sm:p-6">
              <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
                <CheckCircle2 size={18} className="text-emerald-600" /> Sudah bagus
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {a.strengths.map((s) => (
                  <li key={s} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> {s}
                  </li>
                ))}
              </ul>
              <div className="mt-6 rounded-2xl bg-slate-50 p-4 ring-1 ring-line">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-ink">Usulan bio baru</p>
                  <CopyText text={a.bio} />
                </div>
                <p className="mt-2 text-sm whitespace-pre-line text-slate-700">{a.bio}</p>
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-line">
                <p className="flex items-center gap-2 text-sm font-bold text-ink">
                  <CalendarClock size={15} /> Ritme posting ideal
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {a.posting.perWeek}x per minggu · {a.posting.bestTimes}
                </p>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-line sm:p-6">
              <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
                <AlertTriangle size={18} className="text-amber-500" /> Yang menghambat pertumbuhan
              </h2>
              <ol className="mt-3 space-y-3">
                {a.problems.map((p, i) => (
                  <li key={p.title} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-line">
                    <p className="text-sm font-bold text-ink">
                      {i + 1}. {p.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{p.why}</p>
                    <p className="mt-2 text-sm text-slate-700">
                      <b className="text-brand-700">Solusi:</b> {p.fix}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {/* Rencana aksi */}
          <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-line sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
              <ListChecks size={18} className="text-brand-600" /> Rencana aksi
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {["Minggu ini", "Bulan ini", "3 bulan"].map((k) => (
                <div key={k} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-line">
                  <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">{k}</p>
                  <ul className="mt-2 space-y-2 text-sm text-slate-700">
                    {when(k).length ? when(k).map((x) => <li key={x.action}>• {x.action}</li>) : <li className="text-slate-400">—</li>}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Ide konten */}
          <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-line sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
                <Lightbulb size={18} className="text-amber-500" /> Ide konten dari konsultan
              </h2>
              <p className="text-sm text-slate-500">Klik “Jadikan rencana di Mode ACC” di atas untuk menjadwalkan semuanya.</p>
            </div>
            <ul className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {a.ideas.map((i) => (
                <li key={i.title} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-line">
                  <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                    <span className="rounded-full bg-white px-2 py-0.5 text-slate-600 ring-1 ring-line">{i.format === "carousel" ? "Carousel" : "Single post"}</span>
                    {i.pillar && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">{i.pillar}</span>}
                  </div>
                  <p className="mt-2 font-bold leading-snug text-ink">{i.title}</p>
                  <p className="mt-1 text-sm text-slate-600">“{i.hook}”</p>
                  <p className="mt-2 text-xs text-slate-400">{i.why}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* Rekomendasi Brand Kit */}
          <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-line sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
              <Palette size={18} className="text-brand-600" /> Rekomendasi untuk Brand Kit & tim AI
              {a.appliedAt && <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">Sudah diterapkan</span>}
            </h2>
            <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
              <div>
                <dt className="font-semibold text-slate-500">Gaya bahasa</dt>
                <dd className="mt-0.5 text-slate-800">{a.brandUpdates.tone}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Arah visual</dt>
                <dd className="mt-0.5 text-slate-800">{isVisualStyle(a.brandUpdates.visualStyle) ? VISUAL_STYLES[a.brandUpdates.visualStyle].label : "Otomatis"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Pilar konten</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {a.brandUpdates.pillars.map((p) => (
                    <span key={p} className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">{p}</span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Art direction foto</dt>
                <dd className="mt-0.5 text-slate-800">{a.brandUpdates.imageStyle}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="font-semibold text-slate-500">Wawasan untuk tim AI</dt>
                <dd className="mt-0.5 text-slate-800">{a.insights}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </div>
  );
}
