import Link from "next/link";
import { Check, ChevronRight, Copy, Heart, MessagesSquare, Plus, TrendingUp, Users } from "lucide-react";
import { HomePrompt } from "@/components/home-prompt";
import { publishTarget } from "@/lib/pipeline";
import { requireWorkspace } from "@/lib/session";
import { compact, engagementOf } from "@/lib/insights";
import { quotaOf } from "@/lib/plans";
import type { Post, TrackedLink } from "@/lib/types";

export const metadata = { title: "Beranda" };
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date()));
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.round(h / 24)} hari lalu`;
};

export default async function HomePage() {
  const { user, w } = await requireWorkspace();
  const [brand, chats, posts, target, links, quota] = await Promise.all([w.getBrand(), w.listChats(6), w.listPosts(), publishTarget(w.id), w.listLinks(), quotaOf(w)]);

  const steps = [
    {
      done: brand.onboarded,
      title: "Lengkapi Brand Kit",
      desc: "Logo, warna, target audiens & gaya bahasa, supaya hasilnya pas dengan brand.",
      href: brand.onboarded ? "/brand" : "/onboarding",
    },
    { done: chats.length > 0, title: "Minta konten pertama", desc: "Kasih arahan ke tim AI lewat kotak di atas.", href: "#prompt" },
    {
      done: posts.some((p) => ["approved", "scheduled", "published"].includes(p.status)),
      title: "ACC konten pertama",
      desc: "Cek preview di mockup HP, revisi bila perlu, lalu ACC.",
      href: "/posts",
    },
    {
      done: target.connected,
      title: "Hubungkan Instagram & TikTok",
      desc: brand.socialRequested ? "Permintaan sudah kami terima, tim kami akan memandu." : "Supaya konten yang di-ACC terbit otomatis.",
      href: "/pengguna#sosmed",
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="mx-auto max-w-4xl pt-4 lg:pt-10">
      <div className="text-center animate-fade-up">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-[40px]">
          {greeting()}, {user.name.split(" ")[0]}
        </h1>
        <p className="mt-2 text-[15px] text-slate-500">Mau bikin konten apa untuk {brand.name} hari ini?</p>
        {Number.isFinite(quota.plan.quota) && (
          <Link
            href="/pengguna#paket"
            className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${quota.ok ? "bg-white text-slate-600 ring-line hover:ring-brand-200" : "bg-red-50 text-red-700 ring-red-200"}`}
          >
            Paket {quota.plan.label} · sisa {quota.left} dari {quota.plan.quota} konten{quota.plan.per === "total" ? " coba gratis" : " bulan ini"}
            {quota.plan.quality === "basic" && <span className="text-brand-600">· upgrade untuk foto AI ›</span>}
          </Link>
        )}
      </div>

      <div id="prompt" className="mt-10 scroll-mt-24">
        <HomePrompt defaultStyle={brand.visualStyle ?? "auto"} />
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <FeedPreview posts={posts} />

        <div className="space-y-6">
          {doneCount < steps.length ? (
            <section className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-line">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">Mulai di sini</h2>
                <span className="text-sm text-slate-500">
                  {doneCount} dari {steps.length} selesai
                </span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="bg-social h-full rounded-full transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
              </div>
              <ol className="mt-4 space-y-1">
                {steps.map((s, i) => (
                  <li key={s.title}>
                    <Link href={s.href} className="group -mx-2 flex items-center gap-3.5 rounded-2xl px-2 py-2.5 transition hover:bg-slate-50">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${s.done ? "bg-social text-white" : "text-slate-500 ring-1 ring-line"}`}>
                        {s.done ? <Check size={16} strokeWidth={3} /> : i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[15px] font-semibold ${s.done ? "text-slate-400 line-through" : ""}`}>{s.title}</span>
                        {!s.done && <span className="block text-sm text-slate-500">{s.desc}</span>}
                      </span>
                      {!s.done && <ChevronRight size={18} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />}
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <PerformaSnapshot enabled={brand.performance} links={links} />

          <section className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-line">
            <h2 className="font-bold">Percakapan terakhir</h2>
            {chats.length ? (
              <ul className="mt-3 space-y-1">
                {chats.map((c) => (
                  <li key={c.id}>
                    <Link href={`/chat/${c.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-50">
                      <MessagesSquare size={16} className="shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.title}</span>
                      <span className="shrink-0 text-xs text-slate-400">{ago(c.updated_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Belum ada percakapan. Mulai dari kotak di atas.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

const DOT: Partial<Record<Post["status"], [string, string]>> = {
  review: ["bg-amber-400", "Menunggu ACC"],
  approved: ["bg-sky-400", "Siap"],
  scheduled: ["bg-brand-500", "Terjadwal"],
  published: ["bg-emerald-500", "Terbit"],
  failed: ["bg-red-500", "Gagal"],
};

/** Pratinjau grid profil Instagram: 9 konten terbaru, sisanya slot kosong untuk diisi. */
function FeedPreview({ posts }: { posts: Post[] }) {
  const shown = posts.filter((p) => p.status !== "rejected").slice(0, 9);
  const empty = 9 - shown.length;
  return (
    <section className="self-start rounded-3xl bg-white p-5 shadow-soft ring-1 ring-line sm:p-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-bold">Feed kamu</h2>
          <p className="text-sm text-slate-500">Begini tampilannya di profil Instagram.</p>
        </div>
        <Link href="/posts" className="text-sm font-semibold text-brand-600 hover:underline">
          Lihat semua
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-1 overflow-hidden rounded-2xl">
        {shown.map((p) => {
          const dot = DOT[p.status];
          return (
            <Link key={p.id} href={`/posts/${p.id}`} className="group relative block aspect-[4/5] bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.media_urls[0] ?? `/api/render/${p.id}/0?v=${encodeURIComponent(p.updated_at)}`}
                alt={p.title}
                loading="lazy"
                className="h-full w-full object-cover transition group-hover:brightness-90"
              />
              {p.slides.length > 1 && <Copy size={15} className="absolute top-2 right-2 text-white drop-shadow" aria-label="Carousel" />}
              {dot && (
                <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                  <span className={`h-1.5 w-1.5 rounded-full ${dot[0]}`} /> {dot[1]}
                </span>
              )}
            </Link>
          );
        })}
        {Array.from({ length: empty }, (_, i) => (
          <Link
            key={`e${i}`}
            href="#prompt"
            className="grid aspect-[4/5] place-items-center bg-slate-50 text-slate-300 transition hover:bg-brand-50 hover:text-brand-500"
            aria-label="Isi slot feed dengan konten baru"
          >
            {i === 0 ? (
              <span className="flex flex-col items-center gap-1 text-xs font-semibold">
                <Plus size={20} /> Isi feed
              </span>
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

function PerformaSnapshot({ enabled, links }: { enabled: boolean; links: TrackedLink[] }) {
  const read = links.filter((l) => l.metrics);
  if (!enabled || !read.length) {
    return (
      <Link href="/performa" className="group block overflow-hidden rounded-3xl bg-ink p-6 text-white shadow-soft">
        <div className="flex items-center gap-3">
          <span className="bg-social grid h-10 w-10 place-items-center rounded-xl">
            <TrendingUp size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold">{enabled ? "Tambahkan link pertama" : "Pantau performa otomatis"}</h2>
            <p className="text-sm text-white/65">Tempel link TikTok / Instagram, likes & komentar terbaca sendiri.</p>
          </div>
          <ChevronRight size={18} className="text-white/50 transition group-hover:translate-x-0.5" />
        </div>
      </Link>
    );
  }
  const followers = read.filter((l) => l.kind === "profile").reduce((a, l) => a + (l.metrics?.followers ?? 0), 0);
  const posts = read.filter((l) => l.kind === "post");
  const interactions = posts.reduce((a, l) => a + engagementOf(l.metrics), 0);
  const top = [...posts].sort((a, b) => engagementOf(b.metrics) - engagementOf(a.metrics))[0];
  return (
    <Link href="/performa" className="group block rounded-3xl bg-white p-6 shadow-soft ring-1 ring-line transition hover:ring-brand-200">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Performa</h2>
        <ChevronRight size={18} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-50 p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Users size={13} /> Followers
          </div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums">{followers ? compact(followers) : "–"}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Heart size={13} /> Interaksi
          </div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums">{compact(interactions)}</div>
        </div>
      </div>
      {top && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl p-1">
          {top.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={top.thumbnail} alt="" className="aspect-[4/5] w-10 rounded-lg object-cover" />
          ) : null}
          <div className="min-w-0 flex-1 text-sm">
            <div className="text-xs font-semibold text-slate-400">Paling ramai</div>
            <div className="truncate font-semibold">{top.title ?? "Konten"}</div>
          </div>
          <span className="text-sm font-bold text-pop tabular-nums">♥ {compact(top.metrics?.likes)}</span>
        </div>
      )}
    </Link>
  );
}
