import { after } from "next/server";
import Link from "next/link";
import { Bookmark, Eye, Heart, MessageCircle, RefreshCw, Repeat2, Sparkles, Trash2, TrendingUp, UserPlus, Users, Zap } from "lucide-react";
import { requireWorkspace } from "@/lib/session";
import { compact, engagementOf, refreshStale } from "@/lib/insights";
import { config } from "@/lib/config";
import type { InsightMetrics, TrackedLink } from "@/lib/types";
import { AddLinkForm, FormButton, PlatformChip, Sparkline, Thumb, TrendChart, type TrendPoint } from "@/components/insights";
import { deleteLinkAction, disablePerformanceAction, enablePerformanceAction, refreshAllAction, refreshLinkAction } from "@/app/insight-actions";

export const metadata = { title: "Performa" };
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DAY = 86_400_000;
const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(iso));
const dayLabel = (key: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(new Date(`${key}T12:00:00+07:00`));
const ago = (iso: string | null) => {
  if (!iso) return "belum dicek";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} jam lalu` : `${Math.round(h / 24)} hari lalu`;
};

/** Nilai metrik sekitar 7 hari lalu (titik riwayat terdekat sebelum itu, atau titik pertama). */
function weekAgo(l: TrackedLink): InsightMetrics | null {
  if (!l.history?.length) return null;
  const cut = Date.now() - 7 * DAY;
  const older = l.history.filter((h) => new Date(h.at).getTime() <= cut);
  return (older.at(-1) ?? l.history[0]).m;
}

/** Total interaksi semua konten per hari (nilai terakhir tiap link dibawa ke hari berikutnya). */
function engagementTrend(posts: TrackedLink[]): TrendPoint[] {
  const days = [...new Set(posts.flatMap((l) => (l.history ?? []).map((h) => dayKey(h.at))))].sort().slice(-30);
  return days.map((d) => ({
    label: dayLabel(d),
    value: posts.reduce((sum, l) => {
      const upto = (l.history ?? []).filter((h) => dayKey(h.at) <= d).at(-1);
      return sum + engagementOf(upto?.m);
    }, 0),
  }));
}

export default async function PerformaPage() {
  const { user, w } = await requireWorkspace();
  const brand = await w.getBrand();

  if (!brand.performance) return <Intro />;

  const links = await w.listLinks();
  // Link yang sudah > 6 jam tidak dicek diperbarui diam-diam setelah halaman terkirim.
  if (links.some((l) => !l.checked_at || Date.now() - new Date(l.checked_at).getTime() > 6 * 3600_000)) {
    after(() => refreshStale(w, links, 6 * 3600_000).catch((e) => console.error("refreshStale", e)));
  }

  const profiles = links.filter((l) => l.kind === "profile");
  const posts = links.filter((l) => l.kind === "post");
  const read = posts.filter((l) => l.metrics);
  const sum = (k: keyof InsightMetrics, src: (l: TrackedLink) => InsightMetrics | null | undefined = (l) => l.metrics) =>
    read.reduce((a, l) => a + (src(l)?.[k] ?? 0), 0);
  const totals = {
    views: sum("views"),
    likes: sum("likes"),
    comments: sum("comments"),
    shares: sum("shares") + sum("saves"),
  };
  const before = {
    views: sum("views", weekAgo),
    likes: sum("likes", weekAgo),
    comments: sum("comments", weekAgo),
    shares: sum("shares", weekAgo) + sum("saves", weekAgo),
  };
  const withViews = read.filter((l) => (l.metrics?.views ?? 0) > 0);
  const er = withViews.length
    ? (withViews.reduce((a, l) => a + engagementOf(l.metrics), 0) / withViews.reduce((a, l) => a + (l.metrics!.views ?? 0), 0)) * 100
    : null;
  const trend = engagementTrend(read);
  const ranked = [...posts].sort((a, b) => engagementOf(b.metrics) - engagementOf(a.metrics));
  const maxEng = Math.max(1, ...ranked.map((l) => engagementOf(l.metrics)));
  const lastCheck = links.map((l) => l.checked_at).filter(Boolean).sort().at(-1) ?? null;

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-brand-600">Laporan performa</p>
          <h1 className="mt-1 text-[28px] leading-tight font-extrabold tracking-tight">Seberapa ramai konten {brand.name}?</h1>
          <p className="mt-1 text-sm text-slate-500">
            Angka terbaca otomatis dari link. Diperbarui tiap hari{lastCheck ? `, terakhir ${ago(lastCheck)}` : ""}.
          </p>
        </div>
        {links.length > 0 && (
          <form action={refreshAllAction}>
            <FormButton
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold ring-1 ring-line hover:bg-slate-50"
              pendingText={
                <span className="inline-flex items-center gap-2">
                  <RefreshCw size={15} className="animate-spin" /> Membaca ulang…
                </span>
              }
            >
              <RefreshCw size={15} /> Perbarui sekarang
            </FormButton>
          </form>
        )}
      </div>

      <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-line sm:p-6">
        <h2 className="font-bold">Tambah link untuk dipantau</h2>
        <p className="mt-0.5 mb-4 text-sm text-slate-500">
          Salin link dari aplikasi TikTok / Instagram (tombol Bagikan → Salin link), lalu tempel di sini. Tidak perlu isi angka manual.
        </p>
        <AddLinkForm />
        {!config.hasApify && (
          <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
            <Sparkles size={14} className="mt-px shrink-0 text-brand-500" />
            TikTok langsung terbaca. Pembacaan Instagram sedang disiapkan; link Instagram tetap bisa disimpan dan akan terbaca otomatis.
            {user.role === "admin" && <span className="font-semibold text-amber-700"> (Admin: isi APIFY_TOKEN di Vercel untuk mengaktifkan.)</span>}
          </p>
        )}
      </section>

      {links.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {profiles.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-lg font-bold">Akun</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {profiles.map((l) => (
                  <ProfileCard key={l.id} link={l} />
                ))}
              </div>
            </section>
          )}

          {posts.length > 0 && (
            <>
              <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
                <Kpi icon={Eye} label="Views" value={totals.views} delta={totals.views - before.views} />
                <Kpi icon={Heart} label="Likes" value={totals.likes} delta={totals.likes - before.likes} />
                <Kpi icon={MessageCircle} label="Komentar" value={totals.comments} delta={totals.comments - before.comments} />
                <Kpi icon={Repeat2} label="Share & simpan" value={totals.shares} delta={totals.shares - before.shares} />
                <div className="col-span-2 rounded-2xl bg-ink p-4 text-white lg:col-span-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white/60">
                    <Zap size={14} /> Engagement rate
                  </div>
                  <div className="mt-2 text-[28px] leading-none font-extrabold tabular-nums">{er === null ? "–" : `${er.toFixed(1).replace(".", ",")}%`}</div>
                  <div className="mt-1.5 text-xs text-white/60">
                    {er === null ? "Butuh data views" : er >= 6 ? "Di atas rata-rata 🔥" : er >= 3 ? "Sehat" : "Masih bisa digenjot"}
                  </div>
                </div>
              </section>

              <section className="mt-6 rounded-3xl bg-white p-5 shadow-soft ring-1 ring-line sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-bold">Total interaksi harian</h2>
                  <span className="text-xs text-slate-500">likes + komentar + share + simpan, semua konten</span>
                </div>
                <div className="mt-5">
                  {trend.length >= 2 ? (
                    <TrendChart points={trend} unit="interaksi" />
                  ) : (
                    <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      Grafik tren muncul setelah 2 hari data. Angka dibaca ulang otomatis setiap hari.
                    </p>
                  )}
                </div>
              </section>

              <section className="mt-8">
                <h2 className="mb-3 text-lg font-bold">Konten paling ramai</h2>
                <ol className="space-y-3">
                  {ranked.map((l, i) => (
                    <PostRow key={l.id} link={l} rank={i + 1} share={engagementOf(l.metrics) / maxEng} />
                  ))}
                </ol>
              </section>
            </>
          )}
        </>
      )}

      <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-sm text-slate-500">
        <span>Pemantauan performa aktif untuk {brand.name}.</span>
        <form action={disablePerformanceAction}>
          <FormButton className="font-semibold text-slate-500 hover:text-red-600">Matikan pemantauan</FormButton>
        </form>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, delta }: { icon: typeof Eye; label: string; value: number; delta: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-line">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <Icon size={14} /> {label}
      </div>
      <div className="mt-2 text-[28px] leading-none font-extrabold tracking-tight tabular-nums">{compact(value)}</div>
      <div className={`mt-1.5 text-xs font-semibold ${delta > 0 ? "text-emerald-700" : "text-slate-400"}`}>
        {delta > 0 ? `▲ ${compact(delta)} minggu ini` : "Belum ada perubahan"}
      </div>
    </div>
  );
}

function Status({ link }: { link: TrackedLink }) {
  if (link.status === "ok" && !link.error) return <span className="text-xs text-slate-400">Dicek {ago(link.checked_at)}</span>;
  const tone = link.status === "error" ? "text-red-600" : "text-amber-700";
  return <span className={`text-xs font-medium ${tone}`}>{link.error ?? "Menunggu dibaca…"}</span>;
}

function RowActions({ link }: { link: TrackedLink }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <form action={refreshLinkAction.bind(null, link.id)}>
        <FormButton label="Baca ulang" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-ink">
          <RefreshCw size={15} />
        </FormButton>
      </form>
      <form action={deleteLinkAction.bind(null, link.id)}>
        <FormButton label="Berhenti memantau" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600">
          <Trash2 size={15} />
        </FormButton>
      </form>
    </div>
  );
}

function ProfileCard({ link }: { link: TrackedLink }) {
  const m = link.metrics;
  const prev = weekAgo(link);
  const grow = m?.followers !== undefined && prev?.followers !== undefined ? m.followers - prev.followers : 0;
  const series = (link.history ?? []).map((h) => h.m.followers ?? 0);
  return (
    <article className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-line">
      <div className="flex items-center gap-3">
        <span className="relative">
          <Thumb src={link.thumbnail} platform={link.platform} className="h-12 w-12 rounded-full ring-2 ring-white" />
          <span className="absolute -right-1 -bottom-1">
            <PlatformChip platform={link.platform} />
          </span>
        </span>
        <a href={link.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 hover:underline">
          <span className="block truncate font-bold">@{link.handle}</span>
          {link.title && <span className="block truncate text-sm text-slate-500">{link.title}</span>}
        </a>
        <RowActions link={link} />
      </div>
      {m ? (
        <>
          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <Users size={14} /> Followers
              </div>
              <div className="mt-1 text-3xl font-extrabold tracking-tight tabular-nums">{compact(m.followers)}</div>
              <div className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold ${grow > 0 ? "text-emerald-700" : "text-slate-400"}`}>
                <UserPlus size={13} /> {grow > 0 ? `+${compact(grow)} minggu ini` : "Belum ada perubahan"}
              </div>
            </div>
            <Sparkline values={series} />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
            <Stat label="Konten" value={m.posts} />
            <Stat label="Following" value={m.following} />
            <Stat label="Total likes" value={m.totalLikes} />
          </dl>
        </>
      ) : (
        <div className="mt-4">
          <Status link={link} />
        </div>
      )}
      {m && link.error && (
        <div className="mt-3">
          <Status link={link} />
        </div>
      )}
    </article>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-bold tabular-nums">{compact(value)}</dd>
    </div>
  );
}

function PostRow({ link, rank, share }: { link: TrackedLink; rank: number; share: number }) {
  const m = link.metrics;
  const series = (link.history ?? []).map((h) => engagementOf(h.m));
  const items: [typeof Eye, number | undefined, string][] = [
    [Eye, m?.views, "views"],
    [Heart, m?.likes, "likes"],
    [MessageCircle, m?.comments, "komentar"],
    [Repeat2, m?.shares, "share"],
    [Bookmark, m?.saves, "simpan"],
  ];
  return (
    <li className="flex gap-4 rounded-3xl bg-white p-3 pr-4 shadow-soft ring-1 ring-line sm:items-center">
      <a href={link.url} target="_blank" rel="noreferrer" className="relative shrink-0">
        <Thumb src={link.thumbnail} platform={link.platform} className="aspect-[4/5] w-20 rounded-2xl sm:w-24" />
        <span className="absolute top-1.5 left-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-white/95 px-1.5 text-xs font-extrabold shadow-soft">
          {rank}
        </span>
        <span className="absolute right-1.5 bottom-1.5">
          <PlatformChip platform={link.platform} />
        </span>
      </a>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <a href={link.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 hover:underline">
            <span className="line-clamp-2 font-semibold">{link.title ?? link.url.replace(/^https:\/\/(www\.)?/, "")}</span>
            {link.handle && <span className="block text-xs text-slate-500">@{link.handle}</span>}
          </a>
          <RowActions link={link} />
        </div>
        {m ? (
          <>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {items
                .filter(([, v]) => v !== undefined)
                .map(([Icon, v, label]) => (
                  <li key={label} className="inline-flex items-center gap-1.5 tabular-nums" title={label}>
                    <Icon size={15} className="text-slate-400" />
                    <span className="font-bold">{compact(v)}</span>
                    <span className="sr-only">{label}</span>
                  </li>
                ))}
            </ul>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-pink-500" style={{ width: `${Math.max(3, share * 100)}%` }} />
              </div>
              <span className="w-24 shrink-0 text-right text-xs font-semibold text-slate-500 tabular-nums">{compact(engagementOf(m))} interaksi</span>
              <span className="hidden sm:block">
                <Sparkline values={series} />
              </span>
            </div>
            {link.error && (
              <div className="mt-1.5">
                <Status link={link} />
              </div>
            )}
          </>
        ) : (
          <div className="mt-2">
            <Status link={link} />
          </div>
        )}
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <section className="mt-8 grid place-items-center rounded-3xl border-2 border-dashed border-line px-6 py-14 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <TrendingUp size={26} />
      </span>
      <h2 className="mt-4 text-lg font-bold">Belum ada link yang dipantau</h2>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        Tempel link profil TikTok / Instagram kamu untuk memantau followers, atau link postingan untuk melihat views, likes, dan komentarnya.
      </p>
    </section>
  );
}

/** Belum diaktifkan: jelaskan manfaatnya + satu tombol. */
function Intro() {
  const demo = [
    { t: "Promo beli 2 gratis 1", v: "48,2 rb", l: "6,1 rb", c: "312", w: 92 },
    { t: "3 kesalahan seduh kopi", v: "21,7 rb", l: "2,4 rb", c: "148", w: 54 },
    { t: "Behind the scenes roasting", v: "9,8 rb", l: "1,1 rb", c: "61", w: 26 },
  ];
  return (
    <div className="mx-auto max-w-5xl">
      <section className="relative overflow-hidden rounded-[32px] bg-ink px-6 py-10 text-white sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-pink-500/40 blur-[90px]" />
        <div className="pointer-events-none absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-brand-500/50 blur-[90px]" />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold ring-1 ring-white/15">
              <TrendingUp size={14} /> Performa
            </span>
            <h1 className="mt-5 text-3xl leading-tight font-extrabold tracking-tight sm:text-[40px]">Pantau likes & komentar tanpa input manual.</h1>
            <p className="mt-4 max-w-md text-white/70">
              Cukup tempel link TikTok atau Instagram. Kami baca angkanya otomatis dan memperbaruinya setiap hari, lengkap dengan grafik dan konten paling ramai.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-white/85">
              {[
                "Link postingan → views, likes, komentar, share, simpan",
                "Link profil → followers dan pertumbuhannya",
                "Konten yang terbit lewat SosmedAutopilot otomatis ikut dipantau",
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-pink-400" /> {t}
                </li>
              ))}
            </ul>
            <form action={enablePerformanceAction} className="mt-8">
              <FormButton className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-semibold text-ink hover:bg-white/90" pendingText="Mengaktifkan…">
                <Zap size={17} /> Aktifkan pemantauan
              </FormButton>
            </form>
            <p className="mt-3 text-xs text-white/50">Bisa dimatikan kapan saja. Hanya membaca angka publik, tidak memposting apa pun.</p>
          </div>

          <div className="rounded-3xl bg-white p-5 text-ink shadow-lift" aria-hidden="true">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Konten paling ramai</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">ER 7,4%</span>
            </div>
            <ul className="mt-4 space-y-3">
              {demo.map((d, i) => (
                <li key={d.t} className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/showcase/${i + 1}.webp`} alt="" className="aspect-[4/5] w-12 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{d.t}</div>
                    <div className="mt-1 flex gap-3 text-xs text-slate-500 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Eye size={12} /> {d.v}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Heart size={12} /> {d.l}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle size={12} /> {d.c}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-pink-500" style={{ width: `${d.w}%` }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <p className="mt-6 text-center text-sm text-slate-500">
        Belum punya konten yang tayang? <Link href="/beranda" className="font-semibold text-brand-600 hover:underline">Minta tim AI bikin konten dulu</Link>.
      </p>
    </div>
  );
}
