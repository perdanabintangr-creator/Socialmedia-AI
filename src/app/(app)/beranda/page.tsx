import Link from "next/link";
import { Check, ChevronRight, MessagesSquare } from "lucide-react";
import { HomePrompt } from "@/components/home-prompt";
import { publishTarget } from "@/lib/pipeline";
import { requireWorkspace } from "@/lib/session";

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
  const [brand, chats, posts, target] = await Promise.all([w.getBrand(), w.listChats(6), w.listPosts(), publishTarget(w.id)]);

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
      </div>

      <div id="prompt" className="mt-10 scroll-mt-24">
        <HomePrompt />
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {doneCount < steps.length ? (
          <section className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-line">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Mulai di sini</h2>
              <span className="text-sm text-slate-500">
                {doneCount} dari {steps.length} selesai
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </div>
            <ol className="mt-5 space-y-1">
              {steps.map((s, i) => (
                <li key={s.title}>
                  <Link href={s.href} className="group -mx-2 flex items-center gap-4 rounded-2xl px-2 py-3 transition hover:bg-slate-50">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${s.done ? "bg-brand-600 text-white" : "text-slate-500 ring-1 ring-line"}`}>
                      {s.done ? <Check size={17} strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block font-semibold ${s.done ? "text-slate-400 line-through" : ""}`}>{s.title}</span>
                      {!s.done && <span className="block text-sm text-slate-500">{s.desc}</span>}
                    </span>
                    {!s.done && <ChevronRight size={18} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />}
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ) : (
          <section className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-line">
            <h2 className="font-bold">Semua siap 🎉</h2>
            <p className="mt-1 text-sm text-slate-500">Brand Kit lengkap dan akun sosmed terhubung. Tinggal kasih arahan ke tim AI.</p>
          </section>
        )}

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
  );
}
