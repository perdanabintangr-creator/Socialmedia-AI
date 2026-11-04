import Link from "next/link";
import { Palette, PenLine, Send } from "lucide-react";
import { Logo } from "./logo";

/** Bingkai halaman masuk/daftar: form di kiri, panel produk di kanan (desktop). */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Link href="/" className="w-fit">
          <Logo size={30} />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10 animate-fade-up">
          <h1 className="text-[28px] font-extrabold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-[15px] text-slate-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
        <p className="text-xs text-slate-400">© {new Date().getFullYear()} SosmedAutopilot</p>
      </div>

      <aside className="relative hidden overflow-hidden bg-ink lg:block" aria-hidden="true">
        <div className="absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-brand-600/40 blur-[120px]" />
        <div className="absolute -bottom-48 -left-24 h-[420px] w-[420px] rounded-full bg-brand-400/20 blur-[120px]" />
        <div className="relative flex h-full flex-col justify-center px-14 py-16 text-white">
          <p className="text-sm font-semibold tracking-wide text-brand-300 uppercase">Tim sosmed AI kamu</p>
          <h2 className="mt-3 max-w-md text-4xl leading-[1.1] font-extrabold tracking-tight">Kasih arahan. Cek hasilnya. Tinggal ACC.</h2>
          <div className="mt-12 max-w-md space-y-3">
            <Bubble icon={<PenLine size={16} />} name="Kata" tone="from-amber-300 to-orange-400" text="Naskah 6 slide siap. Hook-nya: “3 kesalahan yang bikin promo sepi.”" />
            <Bubble icon={<Palette size={16} />} name="Rupa" tone="from-brand-400 to-brand-600" text="Desain sudah kurapikan sesuai warna brand. Tinggal kamu ACC." delay="0.15s" />
            <Bubble icon={<Send size={16} />} name="Siar" tone="from-sky-400 to-blue-600" text="Terjadwal Kamis 19.00 WIB ke Instagram & TikTok." delay="0.3s" />
          </div>
        </div>
      </aside>
    </div>
  );
}

function Bubble({ icon, name, tone, text, delay }: { icon: React.ReactNode; name: string; tone: string; text: string; delay?: string }) {
  return (
    <div className="flex items-start gap-3 animate-fade-up" style={{ animationDelay: delay }}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white ${tone}`}>{icon}</span>
      <div className="rounded-2xl rounded-tl-md bg-white/10 px-4 py-3 text-sm leading-relaxed ring-1 ring-white/10 backdrop-blur">
        <div className="mb-0.5 text-xs font-bold text-white/70">{name}</div>
        {text}
      </div>
    </div>
  );
}
