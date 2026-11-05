import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Check,
  Eye,
  Heart,
  Link2,
  Lock,
  MessageCircle,
  MessagesSquare,
  Palette,
  PenLine,
  Play,
  Send,
  Sparkles,
  UserPlus,
  Wand2,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { PLANS } from "@/lib/pricing";
import { HeroStage } from "@/components/landing/hero-stage";
import { ProcessDemo } from "@/components/landing/process-demo";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const AGENTS = [
  {
    name: "Kata",
    handle: "@kata.strategi",
    role: "Strategi & Naskah",
    icon: PenLine,
    tone: "from-amber-300 to-orange-500",
    text: "Riset ide sesuai brand dan audiens, menulis hook yang bikin berhenti scroll, isi slide, sampai caption & hashtag.",
    tags: ["Hook", "Caption", "Hashtag"],
  },
  {
    name: "Rupa",
    handle: "@rupa.desain",
    role: "Desain & Visual",
    icon: Palette,
    tone: "from-brand-400 to-brand-700",
    text: "Menyusun layout, memilih foto & ikon, menjaga warna dan font brand, lalu mengecek ulang hasilnya seperti art director.",
    tags: ["Carousel", "On-brand", "Art direction"],
  },
  {
    name: "Siar",
    handle: "@siar.posting",
    role: "Jadwal & Posting",
    icon: Send,
    tone: "from-pink-400 to-rose-600",
    text: "Merender desain final, menjadwalkan di jam yang kamu pilih, memposting ke Instagram & TikTok, lalu memantau hasilnya.",
    tags: ["Auto-post", "Jadwal", "Performa"],
  },
];

const TICKER = [
  "📚 Carousel edukasi",
  "🔥 Promo akhir bulan",
  "☕ Behind the scenes",
  "💡 Tips & trik",
  "⭐ Testimoni pelanggan",
  "🎯 Hook 3 detik",
  "🗓️ Konten konsisten",
  "📈 Pantau performa",
];

const FEATURES = [
  { icon: MessagesSquare, tone: "bg-amber-100 text-orange-600", title: "Cukup ngobrol", text: "Minta ide, revisi, atau jadwal lewat chat, seperti ke tim sendiri." },
  { icon: Palette, tone: "bg-brand-100 text-brand-700", title: "Selalu on-brand", text: "Warna, font, logo, dan gaya bahasa mengikuti Brand Kit kamu." },
  { icon: Wand2, tone: "bg-pink-100 text-pop", title: "Dicek art director AI", text: "Hasil render ditinjau ulang, teks atau visual yang kurang pas dirapikan." },
  { icon: CalendarClock, tone: "bg-sky-100 text-sky-700", title: "Kalender konten", text: "Lihat semua yang akan tayang dalam satu kalender bulanan." },
  { icon: BarChart3, tone: "bg-emerald-100 text-emerald-700", title: "Performa otomatis", text: "Tempel link TikTok / Instagram, likes & komentar terbaca sendiri." },
  { icon: Lock, tone: "bg-slate-200 text-slate-700", title: "Workspace pribadi", text: "Data dan konten setiap brand terpisah dan hanya bisa dilihat timmu." },
];

const FAQ = [
  {
    q: "Apakah saya perlu bisa desain atau menulis caption?",
    a: "Tidak. Kamu cukup memberi arahan singkat. Tim AI menulis naskah, membuat desain, dan menyiapkan caption. Kamu tinggal mengecek dan ACC.",
  },
  {
    q: "Bagaimana hasilnya bisa sesuai dengan brand saya?",
    a: "Saat onboarding kamu mengisi Brand Kit: warna, logo, gaya bahasa, target audiens, dan contoh post yang disukai. Semua konten mengikuti pedoman ini.",
  },
  {
    q: "Kalau hasilnya kurang pas, bisa direvisi?",
    a: "Bisa. Ketik revisinya di chat, misalnya “hook-nya lebih santai” atau “ganti foto cover”. Kamu juga bisa mengedit teks per slide secara langsung.",
  },
  {
    q: "Bagaimana cara melihat performa postingan?",
    a: "Aktifkan menu Performa, lalu tempel link postingan atau profil TikTok / Instagram. Views, likes, komentar, share, dan followers terbaca otomatis dan diperbarui setiap hari. Tidak perlu input angka manual.",
  },
  {
    q: "Platform apa saja yang didukung?",
    a: "Instagram (feed & carousel) dan TikTok (photo mode). Desain berukuran 4:5 sehingga pas di keduanya.",
  },
  {
    q: "Apakah konten saya bisa dilihat pengguna lain?",
    a: "Tidak. Setiap brand punya workspace sendiri yang terpisah, termasuk Brand Kit, percakapan, konten, dan file.",
  },
];

export default async function LandingPage() {
  const user = await currentUser();
  const cta = user ? { href: "/beranda", label: "Buka Studio" } : { href: "/daftar", label: "Coba gratis" };

  return (
    <div className="overflow-x-clip bg-[#fbfaff] text-ink">
      {/* Navigasi mengambang */}
      <header className="sticky top-3 z-40 px-3 sm:top-4">
        <div className="mx-auto flex max-w-5xl items-center gap-4 rounded-full bg-white/75 py-2 pr-2 pl-4 shadow-soft ring-1 ring-black/5 backdrop-blur-xl sm:pl-5">
          <Link href="/" aria-label="SosmedAutopilot">
            <Logo size={28} />
          </Link>
          <nav className="hidden flex-1 justify-center gap-1 text-sm font-semibold text-slate-500 md:flex">
            {[
              ["#proses", "Proses"],
              ["#tim", "Tim AI"],
              ["#hasil", "Hasil"],
              ["#performa", "Performa"],
              ["#harga", "Harga"],
            ].map(([h, l]) => (
              <a key={h} href={h} className="rounded-full px-3.5 py-2 hover:bg-slate-100 hover:text-ink">
                {l}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            {!user && (
              <Link href="/login" className="hidden rounded-full px-3.5 py-2 text-sm font-semibold text-slate-600 hover:text-ink sm:inline-block">
                Masuk
              </Link>
            )}
            <Link href={cta.href} className="bg-social inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold whitespace-nowrap text-white shadow-soft hover:brightness-105">
              {cta.label} <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative -mt-16 pt-28 sm:pt-32">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-[radial-gradient(60%_50%_at_50%_0%,rgb(255_61_139/0.13),transparent_70%),radial-gradient(45%_45%_at_15%_30%,rgb(116_95_253/0.16),transparent_70%),radial-gradient(40%_40%_at_85%_35%,rgb(255_154_61/0.14),transparent_70%)]" />
        <div className="relative mx-auto max-w-4xl px-5 text-center">
          <span className="inline-flex -rotate-2 flex-wrap items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold shadow-soft ring-1 ring-black/5">
            <span className="bg-social grid h-5 w-5 place-items-center rounded-full text-white">
              <Sparkles size={11} />
            </span>
            Tim sosmed AI untuk brand & UMKM
            <span className="hidden text-slate-300 sm:inline">·</span>
            <span className="text-social hidden sm:inline">
              mulai {PLANS[0].price}
              {PLANS[0].period}
            </span>
          </span>
          <h1 className="mt-7 text-[42px] leading-[1.02] font-extrabold tracking-[-0.035em] sm:text-7xl">
            Konten jadi. Posting jalan.
            <br />
            <span className="text-social">Likes berdatangan.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            Kasih arahan lewat chat, tim AI menyiapkan ide, desain, dan caption, lalu memposting otomatis ke Instagram & TikTok. Kamu cukup tekan{" "}
            <b className="text-ink">ACC</b>.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href={cta.href} className="bg-social inline-flex items-center gap-2 rounded-2xl px-7 py-4 text-[15px] font-bold text-white shadow-lift hover:brightness-105">
              {user ? "Buka Studio" : "Coba gratis sekarang"} <ArrowRight size={17} />
            </Link>
            <a href="#proses" className="inline-flex items-center gap-2.5 rounded-2xl bg-white px-6 py-4 text-[15px] font-bold shadow-soft ring-1 ring-black/5 hover:bg-slate-50">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-white">
                <Play size={11} className="ml-px fill-white" />
              </span>
              Lihat prosesnya
            </a>
          </div>
          <ul className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
            {["Instagram & TikTok", "Bahasa Indonesia", "Tanpa kartu kredit"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check size={15} className="text-emerald-600" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative mt-6 px-3">
          <HeroStage />
        </div>
      </section>

      {/* Pita jenis konten */}
      <div className="relative -rotate-1 bg-ink py-4 text-white" aria-hidden="true">
        <div className="flex w-max animate-[marquee_40s_linear_infinite] gap-3">
          {[0, 1].map((k) => (
            <span key={k} className="flex gap-3">
              {TICKER.map((w) => (
                <span key={w} className="rounded-full bg-white/10 px-5 py-2 text-[15px] font-semibold whitespace-nowrap ring-1 ring-white/10">
                  {w}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* Proses */}
      <section id="proses" className="scroll-mt-24 px-5 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            eyebrow="Prosesnya"
            title={
              <>
                Dari satu kalimat sampai <span className="text-social">ramai likes</span>
              </>
            }
            sub="Begini rasanya punya tim sosmed sendiri. Klik tiap langkah untuk melihat lebih dekat."
          />
          <div className="mt-14">
            <ProcessDemo />
          </div>
        </div>
      </section>

      {/* Tim */}
      <section id="tim" className="scroll-mt-24 bg-white px-5 py-24">
        <div className="mx-auto max-w-6xl">
          <SectionHead eyebrow="Tim AI kamu" title="Tiga spesialis, satu chat" sub="Seperti tim di agency: ada yang mikir konten, ada yang desain, ada yang ngurus posting." />
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {AGENTS.map(({ name, handle, role, icon: Icon, tone, text, tags }, i) => (
              <article
                key={name}
                className={`group relative rounded-[28px] bg-[#fbfaff] p-7 ring-1 ring-black/5 transition duration-300 hover:-translate-y-1.5 hover:shadow-lift ${i === 1 ? "md:-translate-y-4 md:hover:-translate-y-6" : ""}`}
              >
                <div className="flex items-center gap-4">
                  <span className="story-ring">
                    <span className={`grid h-16 w-16 place-items-center bg-gradient-to-br text-white ${tone}`}>
                      <Icon size={26} />
                    </span>
                  </span>
                  <div>
                    <h3 className="text-xl font-extrabold">{name}</h3>
                    <p className="text-sm text-slate-500">{handle}</p>
                  </div>
                  <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> 24/7
                  </span>
                </div>
                <p className="mt-5 text-sm font-bold text-brand-600">{role}</p>
                <p className="mt-1.5 leading-relaxed text-slate-600">{text}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <span key={t} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-line">
                      {t}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Hasil: carousel 3D */}
      <section id="hasil" className="relative scroll-mt-24 overflow-hidden bg-ink py-24 text-white">
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-[480px] w-[780px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/30 blur-[140px]" />
        <div className="relative px-5">
          <SectionHead dark eyebrow="Contoh hasil" title="Desain yang bikin berhenti scroll" sub="Dibuat otomatis dari Brand Kit. Warna, font, dan logo mengikuti brand kamu." />
        </div>
        <div className="group relative mt-10 h-[340px] [--r:190px] [perspective:1200px] sm:h-[420px] sm:[--r:380px]" role="img" aria-label="Contoh slide desain berputar">
          <div className="absolute top-8 left-1/2 h-0 w-0 [transform-style:preserve-3d]">
            <div className="animate-spin-y [transform-style:preserve-3d] group-hover:[animation-play-state:paused]">
              {[1, 2, 3, 4, 5, 6, 1, 3].map((n, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={`/showcase/${n}.webp`}
                  alt=""
                  draggable={false}
                  className="absolute top-0 -left-[64px] h-40 w-32 max-w-none rounded-2xl sm:h-[230px] object-cover shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)] ring-1 ring-white/10 sm:-left-[92px] sm:w-[184px]"
                  style={{ transform: `rotateY(${i * 45}deg) translateZ(var(--r))` }}
                />
              ))}
            </div>
          </div>
        </div>
        <p className="relative hidden text-center text-sm text-white/50 sm:block">Arahkan kursor untuk menghentikan putaran</p>
      </section>

      {/* Performa */}
      <section id="performa" className="scroll-mt-24 px-5 py-24 sm:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
          <div>
            <p className="text-sm font-bold tracking-wide text-pop uppercase">Baru · Performa</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-[44px] sm:leading-[1.08]">
              Tempel link, <span className="text-social">angkanya terbaca sendiri.</span>
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">
              Tidak perlu lagi mencatat likes dan komentar satu per satu. Tempel link TikTok atau Instagram, lalu pantau perkembangannya setiap hari.
            </p>
            <ul className="mt-8 space-y-4">
              {PERF_POINTS.map(({ icon: Icon, t, d }) => (
                <li key={t} className="flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white shadow-soft ring-1 ring-line">
                    <Icon size={19} className="text-pop" />
                  </span>
                  <div>
                    <div className="font-bold">{t}</div>
                    <div className="text-slate-600">{d}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <PerformaMock />
        </div>
      </section>

      {/* Fitur */}
      <section id="fitur" className="scroll-mt-24 bg-white px-5 py-24">
        <div className="mx-auto max-w-6xl">
          <SectionHead eyebrow="Fitur" title="Semua yang dibutuhkan sosmed brand kamu" />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, tone, title, text }) => (
              <div key={title} className="rounded-3xl bg-[#fbfaff] p-6 ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-soft">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ${tone}`}>
                  <Icon size={22} />
                </span>
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-1 leading-relaxed text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Harga */}
      <section id="harga" className="scroll-mt-24 px-5 py-24">
        <div className="mx-auto max-w-6xl">
          <SectionHead eyebrow="Harga" title="Lebih hemat dari satu orang admin sosmed" sub="Pilih paket sesuai kebutuhan. Mulai coba gratis tanpa kartu kredit." />
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {PLANS.map((p) => (
              <div key={p.name} className={`relative flex flex-col rounded-[28px] p-7 ${p.highlight ? "bg-social text-white shadow-lift lg:-translate-y-3" : "bg-white shadow-soft ring-1 ring-line"}`}>
                {p.highlight && <span className="absolute -top-3 left-7 rounded-full bg-ink px-3 py-1 text-xs font-bold text-white">Paling populer</span>}
                <h3 className="text-lg font-bold">{p.name}</h3>
                <p className={`mt-1 text-sm ${p.highlight ? "text-white/80" : "text-slate-500"}`}>{p.tagline}</p>
                <p className="mt-6">
                  <span className="text-4xl font-extrabold tracking-tight">{p.price}</span>
                  <span className={p.highlight ? "text-white/80" : "text-slate-500"}>{p.period}</span>
                </p>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <Check size={17} className={`shrink-0 ${p.highlight ? "text-white" : "text-emerald-600"}`} /> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/daftar"
                  className={`mt-8 rounded-2xl px-5 py-3.5 text-center text-sm font-bold ${p.highlight ? "bg-white text-ink hover:bg-white/90" : "bg-ink text-white hover:bg-ink/85"}`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-24 px-5 pb-24">
        <div className="mx-auto max-w-3xl">
          <SectionHead eyebrow="FAQ" title="Pertanyaan yang sering ditanyakan" />
          <div className="mt-10 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-2xl bg-white px-6 py-5 shadow-soft ring-1 ring-line">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {f.q}
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition group-open:rotate-45 group-open:bg-pop group-open:text-white">
                    +
                  </span>
                </summary>
                <p className="mt-3 leading-relaxed text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA akhir */}
      <section className="px-5 pb-24">
        <div className="bg-social relative mx-auto max-w-6xl overflow-hidden rounded-[36px] px-8 py-16 text-center text-white sm:px-16 sm:py-20">
          <Heart size={180} className="absolute -top-10 -left-10 rotate-[-18deg] fill-white/10 text-transparent" aria-hidden="true" />
          <MessageCircle size={160} className="absolute -right-8 -bottom-10 rotate-12 fill-white/10 text-transparent" aria-hidden="true" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight sm:text-5xl">Biar tim AI yang sibuk. Kamu fokus jualan.</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/85">Siapkan Brand Kit dalam 5 menit dan dapatkan ide konten pertamamu hari ini.</p>
            <Link href={cta.href} className="mt-9 inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-4 font-bold text-ink shadow-lift hover:bg-white/90">
              {user ? "Buka Studio" : "Coba gratis sekarang"} <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-slate-500">
          <Logo size={26} />
          <p>© {new Date().getFullYear()} SosmedAutopilot. Dibuat di Indonesia.</p>
        </div>
      </footer>
    </div>
  );
}

const PERF_POINTS = [
  { icon: Link2, t: "Link postingan atau profil", d: "Views, likes, komentar, share, simpan, dan followers." },
  { icon: CalendarClock, t: "Diperbarui otomatis tiap hari", d: "Lengkap dengan grafik tren dan pertumbuhan mingguan." },
  { icon: Sparkles, t: "Konten dari SosmedAutopilot ikut terpantau", d: "Begitu tayang, langsung masuk laporan." },
];

function SectionHead({ eyebrow, title, sub, dark }: { eyebrow: string; title: React.ReactNode; sub?: string; dark?: boolean }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className={`text-sm font-bold tracking-wide uppercase ${dark ? "text-pink-300" : "text-pop"}`}>{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-[44px] sm:leading-[1.08]">{title}</h2>
      {sub && <p className={`mt-4 text-lg ${dark ? "text-white/60" : "text-slate-600"}`}>{sub}</p>}
    </div>
  );
}

const MOCK_ROWS = [
  { img: 1, t: "Promo beli 2 gratis 1", v: "48,2 rb", l: "6,1 rb", c: "312", w: "92%" },
  { img: 3, t: "3 kesalahan seduh kopi", v: "21,7 rb", l: "2,4 rb", c: "148", w: "54%" },
  { img: 5, t: "Behind the scenes roasting", v: "9,8 rb", l: "1,1 rb", c: "61", w: "26%" },
];
const MOCK_KPI = [
  { icon: Eye, l: "Views", v: "79,7 rb" },
  { icon: Heart, l: "Likes", v: "9,6 rb" },
  { icon: UserPlus, l: "Followers", v: "+214" },
];

/** Ilustrasi menu Performa (angka contoh). */
function PerformaMock() {
  return (
    <div className="relative [perspective:1400px]" aria-hidden="true">
      <div className="rounded-[32px] bg-white p-5 shadow-[0_40px_80px_-30px_rgb(15_18_34/0.35)] ring-1 ring-black/5 transition duration-500 sm:p-6 lg:[transform:rotateY(-10deg)_rotateX(6deg)] lg:hover:[transform:rotateY(0deg)_rotateX(0deg)]">
        <div className="flex items-center justify-between">
          <span className="font-bold">Performa minggu ini</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">▲ 38%</span>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          {MOCK_KPI.map(({ icon: Icon, l, v }) => (
            <div key={l} className="rounded-2xl bg-[#fbfaff] p-3 ring-1 ring-black/5 sm:p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <Icon size={13} /> {l}
              </div>
              <div className="mt-1 text-lg font-extrabold tabular-nums sm:text-xl">{v}</div>
            </div>
          ))}
        </div>
        <svg viewBox="0 0 300 80" className="mt-5 h-20 w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="pm-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--color-pop)" stopOpacity="0.25" />
              <stop offset="1" stopColor="var(--color-pop)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,70 C40,66 60,60 90,52 S150,44 180,30 S250,14 300,6 L300,80 L0,80 Z" fill="url(#pm-fill)" />
          <path d="M0,70 C40,66 60,60 90,52 S150,44 180,30 S250,14 300,6" fill="none" stroke="var(--color-pop)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <ul className="mt-4 space-y-3">
          {MOCK_ROWS.map((r) => (
            <li key={r.t} className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/showcase/${r.img}.webp`} alt="" className="aspect-[4/5] w-11 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{r.t}</div>
                <div className="mt-0.5 flex gap-3 text-xs text-slate-500 tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <Eye size={11} /> {r.v}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Heart size={11} /> {r.l}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle size={11} /> {r.c}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
                  <div className="bg-social h-full rounded-full" style={{ width: r.w }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute -top-5 right-2 flex animate-float items-center gap-2 rounded-2xl bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lift sm:-right-6 sm:text-sm">
        <Link2 size={15} className="text-pink-300" /> tiktok.com/@kopisenja/video/…
      </div>
    </div>
  );
}
