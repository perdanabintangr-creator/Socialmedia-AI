import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Check,
  LayoutTemplate,
  Lock,
  MessagesSquare,
  Palette,
  PenLine,
  Send,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { PLANS } from "@/lib/pricing";
import { HeroDemo } from "@/components/hero-demo";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const SHOWCASE = [
  { src: "/showcase/1.webp", alt: "Contoh cover carousel" },
  { src: "/showcase/2.webp", alt: "Contoh slide poin dengan ikon" },
  { src: "/showcase/3.webp", alt: "Contoh slide checklist" },
  { src: "/showcase/4.webp", alt: "Contoh slide perbandingan mitos dan fakta" },
  { src: "/showcase/5.webp", alt: "Contoh slide angka dengan grafik" },
  { src: "/showcase/6.webp", alt: "Contoh slide penutup ajakan follow" },
];

const AGENTS = [
  {
    name: "Kata",
    role: "Strategi & Naskah",
    icon: PenLine,
    tone: "from-amber-300 to-orange-400",
    text: "Riset ide sesuai brand dan audiens, menulis hook yang bikin berhenti scroll, isi slide, sampai caption & hashtag.",
  },
  {
    name: "Rupa",
    role: "Desain & Visual",
    icon: Palette,
    tone: "from-brand-400 to-brand-600",
    text: "Menyusun layout, memilih foto & ikon, menjaga warna dan font brand, lalu mengecek ulang hasilnya seperti art director.",
  },
  {
    name: "Siar",
    role: "Jadwal & Posting",
    icon: Send,
    tone: "from-sky-400 to-blue-600",
    text: "Merender desain final, mengatur jadwal di jam terbaik, dan memposting ke Instagram & TikTok setelah kamu ACC.",
  },
];

const FEATURES = [
  { icon: MessagesSquare, title: "Cukup ngobrol", text: "Kasih arahan seperti ke tim sendiri. Minta ide, revisi, atau jadwal lewat chat." },
  { icon: LayoutTemplate, title: "Desain sekelas agency", text: "11 layout siap pakai: cover foto, checklist, perbandingan, angka, kutipan, dan lainnya." },
  { icon: Palette, title: "Selalu on-brand", text: "Warna, font, logo, dan gaya bahasa mengikuti Brand Kit kamu di setiap konten." },
  { icon: Wand2, title: "Dicek ulang otomatis", text: "AI art director meninjau hasil render dan merapikan teks atau visual yang kurang pas." },
  { icon: CalendarClock, title: "Terjadwal otomatis", text: "Pilih jam tayang, sisanya beres. Instagram dan TikTok dari satu tempat." },
  { icon: Lock, title: "Workspace pribadi", text: "Data dan konten setiap brand terpisah. Hanya tim kamu yang bisa melihatnya." },
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
  return (
    <div className="bg-white text-ink">
      {/* Navigasi */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3.5">
          <Link href="/" aria-label="SosmedAutopilot">
            <Logo size={30} />
          </Link>
          <nav className="hidden flex-1 justify-center gap-7 text-sm font-semibold text-slate-500 md:flex">
            <a href="#cara-kerja" className="hover:text-ink">Cara kerja</a>
            <a href="#tim" className="hover:text-ink">Tim AI</a>
            <a href="#fitur" className="hover:text-ink">Fitur</a>
            <a href="#harga" className="hover:text-ink">Harga</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            {user ? (
              <Link href="/beranda" className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink/85">
                Buka Studio <ArrowRight size={15} />
              </Link>
            ) : (
              <>
                <Link href="/login" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:text-ink">Masuk</Link>
                <Link href="/daftar" className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink/85">Coba gratis</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-brand-200/50 blur-[140px]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pt-16 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-soft ring-1 ring-line">
              <Sparkles size={15} className="text-brand-600" /> Lebih hemat dari gaji admin sosmed
              <span className="text-slate-300">·</span>
              <span className="font-extrabold text-brand-600">mulai {PLANS[0].price}{PLANS[0].period}</span>
            </span>
            <h1 className="mt-6 text-[42px] leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
              Tim sosmed AI kamu.
              <br />
              <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">Tinggal ACC.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
              Kata, Rupa, dan Siar menyiapkan ide, menulis, mendesain, sampai menjadwalkan posting Instagram & TikTok. Kamu cukup kasih arahan lewat chat.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href={user ? "/beranda" : "/daftar"} className="inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3.5 text-[15px] font-semibold text-white shadow-lift hover:bg-ink/85">
                {user ? "Buka Studio" : "Coba gratis sekarang"} <ArrowRight size={17} />
              </Link>
              <a href="#cara-kerja" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-[15px] font-semibold text-ink ring-1 ring-line hover:bg-slate-50">
                Lihat cara kerjanya
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
              {["Instagram & TikTok", "Bahasa Indonesia", "Tanpa kartu kredit"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check size={15} className="text-emerald-600" /> {t}
                </li>
              ))}
            </ul>
          </div>

          <HeroDemo />
        </div>
      </section>

      {/* Pita kata kunci */}
      <div className="overflow-hidden border-y border-line bg-white py-6" aria-hidden="true">
        <div className="flex w-max animate-[marquee_38s_linear_infinite] gap-10 text-4xl font-extrabold tracking-tight whitespace-nowrap text-transparent sm:text-6xl [-webkit-text-stroke:1.5px_var(--color-slate-300)]">
          {[0, 1].map((k) => (
            <span key={k} className="flex gap-10">
              {["CAROUSEL", "CAPTION", "HOOK", "BRAND KIT", "JADWAL OTOMATIS", "ON-BRAND"].map((w) => (
                <span key={w} className="flex items-center gap-10">
                  {w} <span className="text-brand-400 [-webkit-text-stroke:0]">✦</span>
                </span>
              ))}
            </span>
          ))}
        </div>
        <div className="mt-3 flex w-max animate-[marquee-rev_32s_linear_infinite] gap-10 text-4xl font-extrabold tracking-tight whitespace-nowrap sm:text-6xl">
          {[0, 1].map((k) => (
            <span key={k} className="flex gap-10">
              {["INSTAGRAM", "TIKTOK", "KONSISTEN", "SEKELAS AGENCY", "TINGGAL ACC"].map((w) => (
                <span key={w} className="flex items-center gap-10">
                  <span className="bg-gradient-to-r from-brand-600 to-sky-500 bg-clip-text text-transparent">{w}</span>
                  <span className="h-3 w-3 rounded-full bg-sky-400" />
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* Cara kerja */}
      <section id="cara-kerja" className="scroll-mt-20 border-y border-line bg-canvas">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <SectionHead eyebrow="Cara kerja" title="Dari arahan sampai tayang, dalam tiga langkah" />
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { n: "01", t: "Kasih arahan", d: "“Buatkan 5 ide konten minggu ini” atau “bikin carousel promo akhir bulan”. Sesingkat itu." },
              { n: "02", t: "Tim AI bekerja", d: "Kata menulis, Rupa mendesain, lalu hasilnya dicek ulang. Progresnya terlihat langsung di chat." },
              { n: "03", t: "Kamu ACC, lalu tayang", d: "Lihat preview persis seperti di HP. Revisi lewat chat, atau ACC dan pilih jam tayang." },
            ].map((s) => (
              <li key={s.n} className="rounded-3xl bg-white p-7 shadow-soft ring-1 ring-line">
                <span className="text-sm font-extrabold text-brand-600">{s.n}</span>
                <h3 className="mt-3 text-xl font-bold tracking-tight">{s.t}</h3>
                <p className="mt-2 leading-relaxed text-slate-600">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Tim */}
      <section id="tim" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
        <SectionHead eyebrow="Tim AI kamu" title="Kenalan dengan Kata, Rupa, dan Siar" sub="Tiga spesialis yang bekerja bareng, persis seperti tim sosmed di agency." />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {AGENTS.map(({ name, role, icon: Icon, tone, text }) => (
            <article key={name} className="group rounded-3xl bg-white p-7 shadow-soft ring-1 ring-line transition hover:-translate-y-1 hover:shadow-lift">
              <span className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-soft ${tone}`}>
                <Icon size={24} />
              </span>
              <h3 className="mt-5 text-xl font-bold">{name}</h3>
              <p className="text-sm font-semibold text-brand-600">{role}</p>
              <p className="mt-3 leading-relaxed text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Showcase */}
      <section className="overflow-hidden bg-ink py-24 text-white">
        <div className="mx-auto max-w-6xl px-5">
          <SectionHead dark eyebrow="Contoh hasil" title="Desain yang terasa dibuat agency" sub="Contoh slide yang dibuat otomatis dari Brand Kit. Warna, font, dan logo mengikuti brand kamu." />
        </div>
        <div className="scrollbar-none mt-12 flex snap-x gap-5 overflow-x-auto px-5 pb-2 lg:mx-auto lg:grid lg:max-w-6xl lg:grid-cols-6 lg:overflow-visible">
          {SHOWCASE.map((s, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={s.src}
              src={s.src}
              alt={s.alt}
              loading="lazy"
              width={540}
              height={675}
              className={`aspect-[4/5] w-56 shrink-0 snap-center rounded-2xl object-cover shadow-lift ring-1 ring-white/10 lg:w-full ${i % 2 ? "lg:translate-y-6" : ""}`}
            />
          ))}
        </div>
      </section>

      {/* Fitur */}
      <section id="fitur" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
        <SectionHead eyebrow="Fitur" title="Semua yang dibutuhkan sosmed brand kamu" />
        <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                <Icon size={20} />
              </span>
              <div>
                <h3 className="font-bold">{title}</h3>
                <p className="mt-1 leading-relaxed text-slate-600">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Harga */}
      <section id="harga" className="scroll-mt-20 border-y border-line bg-canvas">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <SectionHead eyebrow="Harga" title="Lebih hemat dari satu orang admin sosmed" sub="Pilih paket sesuai kebutuhan. Mulai coba gratis tanpa kartu kredit." />
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`relative flex flex-col rounded-3xl p-7 ring-1 ${p.highlight ? "bg-ink text-white shadow-lift ring-ink" : "bg-white shadow-soft ring-line"}`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-7 rounded-full bg-brand-500 px-3 py-1 text-xs font-bold text-white">Paling populer</span>
                )}
                <h3 className="text-lg font-bold">{p.name}</h3>
                <p className={`mt-1 text-sm ${p.highlight ? "text-white/60" : "text-slate-500"}`}>{p.tagline}</p>
                <p className="mt-6">
                  <span className="text-4xl font-extrabold tracking-tight">{p.price}</span>
                  <span className={p.highlight ? "text-white/60" : "text-slate-500"}>{p.period}</span>
                </p>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <Check size={17} className={`shrink-0 ${p.highlight ? "text-brand-300" : "text-emerald-600"}`} /> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/daftar"
                  className={`mt-8 rounded-xl px-5 py-3 text-center text-sm font-semibold ${p.highlight ? "bg-white text-ink hover:bg-white/90" : "bg-ink text-white hover:bg-ink/85"}`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-5 py-24">
        <SectionHead eyebrow="FAQ" title="Pertanyaan yang sering ditanyakan" />
        <div className="mt-10 divide-y divide-line rounded-3xl bg-white shadow-soft ring-1 ring-line">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {f.q}
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 leading-relaxed text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA akhir */}
      <section className="px-5 pb-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-ink px-8 py-16 text-center text-white sm:px-16">
          <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-[640px] -translate-x-1/2 rounded-full bg-brand-500/40 blur-[110px]" />
          <div className="relative">
            <ShieldCheck size={28} className="mx-auto text-brand-300" />
            <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">Biarkan tim AI yang sibuk. Kamu fokus jualan.</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/70">Siapkan Brand Kit dalam 5 menit dan dapatkan ide konten pertamamu hari ini.</p>
            <Link href={user ? "/beranda" : "/daftar"} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-semibold text-ink hover:bg-white/90">
              {user ? "Buka Studio" : "Coba gratis sekarang"} <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-slate-500">
          <Logo size={26} />
          <p>© {new Date().getFullYear()} SosmedAutopilot. Dibuat di Indonesia.</p>
        </div>
      </footer>
    </div>
  );
}

function SectionHead({ eyebrow, title, sub, dark }: { eyebrow: string; title: string; sub?: string; dark?: boolean }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className={`text-sm font-bold tracking-wide uppercase ${dark ? "text-brand-300" : "text-brand-600"}`}>{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-[40px] sm:leading-[1.1]">{title}</h2>
      {sub && <p className={`mt-4 text-lg ${dark ? "text-white/60" : "text-slate-600"}`}>{sub}</p>}
    </div>
  );
}
