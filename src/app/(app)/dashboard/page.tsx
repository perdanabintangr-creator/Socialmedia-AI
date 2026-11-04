import { requireWorkspace } from "@/lib/session";
import Link from "next/link";
import { config } from "@/lib/config";
import { Card, PageTitle, StatusBadge, formatWIB } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { w, user } = await requireWorkspace();
  const [brand, ideas, posts] = await Promise.all([w.getBrand(), w.listIdeas(), w.listPosts()]);
  const pendingIdeas = ideas.filter((i) => i.status === "pending");
  const review = posts.filter((p) => p.status === "review");
  const upcoming = posts
    .filter((p) => p.status === "scheduled" || p.status === "approved")
    .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
  const published = posts.filter((p) => p.status === "published");

  const allSetup = [
    { done: config.hasAI, label: "Hubungkan AI (ANTHROPIC_API_KEY)", hint: "Tanpa ini ide & konten masih contoh (mode demo)." },
    { done: config.hasSupabase, label: "Hubungkan database (Supabase)", hint: "Tanpa ini data disimpan lokal di folder .data." },
    { done: config.hasPublisher, label: "Hubungkan Instagram & TikTok (AYRSHARE_API_KEY)", hint: "Tanpa ini desain final bisa diunduh, tapi belum auto-post." },
    { done: Boolean(config.imageProvider || config.hasStock), label: "Hubungkan sumber foto (AI image / Pexels)", hint: "Tanpa ini, foto hanya dari library foto brand; slide lain memakai versi grafis." },
    { done: brand.assets.length > 0, label: "Upload foto brand (produk, tim, kantor)", href: "/brand" },
    { done: Boolean(brand.description && brand.audience), label: "Lengkapi Brand Kit", hint: "Deskripsi brand & target audiens.", href: "/brand" },
    { done: Boolean(brand.logoUrl), label: "Upload logo", href: "/brand" },
    { done: brand.exampleUrls.length > 0, label: "Upload contoh post yang disukai", href: "/brand" },
  ];
  // Item yang berupa pengaturan server (API key) hanya relevan untuk owner aplikasi.
  const setup = allSetup.filter((s) => user.role === "admin" || s.href);
  const setupLeft = setup.filter((s) => !s.done).length;

  const steps = [
    { n: pendingIdeas.length, label: "Ide menunggu ACC", href: "/ideas", cls: "text-amber-600" },
    { n: review.length, label: "Konten menunggu ACC", href: "/posts?status=review", cls: "text-amber-600" },
    { n: upcoming.length, label: "Siap / terjadwal", href: "/posts?status=scheduled", cls: "text-brand-600" },
    { n: published.length, label: "Sudah terbit", href: "/posts?status=published", cls: "text-emerald-600" },
  ];

  return (
    <div className="space-y-6">
      <PageTitle title={`Halo, tim ${brand.name} 👋`} subtitle="AI menyiapkan ide, menulis, mendesain, dan memposting. Tugas kamu: ACC.">
        <Link href="/studio" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500">
          Buka Studio (chat tim)
        </Link>
      </PageTitle>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {steps.map((s, i) => (
          <Link key={s.label} href={s.href}>
            <Card className="h-full transition hover:ring-brand-300">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Langkah {i + 1}</div>
              <div className={`mt-1 text-3xl font-bold ${s.cls}`}>{s.n}</div>
              <div className="text-sm text-slate-600">{s.label}</div>
            </Card>
          </Link>
        ))}
      </div>

      {setupLeft > 0 && (
        <Card>
          <h2 className="font-semibold">Setup ({setup.length - setupLeft}/{setup.length} selesai)</h2>
          <ul className="mt-3 space-y-2">
            {setup.map((s) => (
              <li key={s.label} className="flex gap-3 text-sm">
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs ${s.done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                  {s.done ? "✓" : ""}
                </span>
                <span>
                  {s.href && !s.done ? <Link href={s.href} className="font-medium text-brand-600 hover:underline">{s.label}</Link> : <span className="font-medium">{s.label}</span>}
                  {s.hint && !s.done && <span className="block text-xs text-slate-500">{s.hint}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Perlu ACC kamu</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {pendingIdeas.slice(0, 5).map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="truncate">💡 {i.title}</span>
                <Link href="/ideas" className="shrink-0 font-medium text-brand-600">Review</Link>
              </li>
            ))}
            {review.slice(0, 5).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="truncate">🎨 {p.title}</span>
                <Link href={`/posts/${p.id}`} className="shrink-0 font-medium text-brand-600">Review</Link>
              </li>
            ))}
            {!pendingIdeas.length && !review.length && <li className="py-2 text-sm text-slate-500">Tidak ada yang menunggu. Minta ide baru untuk mulai.</li>}
          </ul>
        </Card>
        <Card>
          <h2 className="font-semibold">Jadwal posting</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {upcoming.slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link href={`/posts/${p.id}`} className="truncate hover:underline">{p.title}</Link>
                <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                  {formatWIB(p.scheduled_at)} <StatusBadge status={p.status} />
                </span>
              </li>
            ))}
            {!upcoming.length && <li className="py-2 text-sm text-slate-500">Belum ada yang terjadwal.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
