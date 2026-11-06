"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing, Check, CalendarClock, Eye, Heart, MessageCircle, Palette, PenLine, Send, Sparkles, UserPlus } from "lucide-react";
import { PhoneFrame, SocialPost } from "./social-post";

const STEPS = [
  { title: "Kasih arahan", desc: "Ketik kebutuhanmu seperti chat ke tim sendiri.", dur: 4300 },
  { title: "Pilih ide", desc: "Kata menyiapkan ide sesuai brand. Kamu tinggal ACC satu.", dur: 4300 },
  { title: "Desain & caption jadi", desc: "Rupa menyusun carousel on-brand, lengkap dengan caption & hashtag.", dur: 4300 },
  { title: "Cek di HP, lalu ACC", desc: "Preview persis seperti di feed. Revisi lewat chat atau langsung ACC.", dur: 3900 },
  { title: "Terposting otomatis", desc: "Siar memposting ke Instagram & TikTok di jam yang kamu pilih.", dur: 3700 },
  { title: "Likes berdatangan", desc: "Pantau likes, komentar, dan followers dari menu Performa.", dur: 7500 },
];

const ASK = "Bikin carousel promo beli 2 gratis 1 buat akhir bulan ya";
const IDEAS = [
  { t: "3 alasan kopi kami bikin nagih", k: "Edukasi" },
  { t: "Akhir bulan, dompet aman: beli 2 gratis 1", k: "Promo" },
  { t: "Di balik layar: roasting jam 5 pagi", k: "Behind the scenes" },
];
const COMMENTS = ["Mau dong kak 😍", "Langsung checkout!", "Cabang Bandung ada?", "Ini promo terbaik bulan ini 🔥"];
const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

/** Cerita proses dari arahan sampai ramai likes, diputar seperti story (bisa diklik per langkah). */
export function ProcessDemo() {
  const [step, setStep] = useState(0);
  const [t, setT] = useState(0); // ms sejak langkah dimulai
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const r = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(r);
    if (r) {
      setT(99_999);
      return;
    }
    const io = new IntersectionObserver(([e]) => setPlaying(e.isIntersecting), { threshold: 0.35 });
    if (root.current) io.observe(root.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || reduced) return;
    const started = performance.now() - t;
    const id = setInterval(() => {
      const el = performance.now() - started;
      if (el >= STEPS[step].dur) {
        setStep((s) => (s + 1) % STEPS.length);
        setT(0);
      } else setT(el);
    }, 80);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, step, reduced]);

  const go = (i: number) => {
    setStep(i);
    setT(reduced ? 99_999 : 0);
  };

  return (
    <div ref={root} className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
      <ol className="order-2 space-y-2 lg:order-1">
        {STEPS.map((s, i) => {
          const on = i === step;
          return (
            <li key={s.title}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={on ? "step" : undefined}
                className={`relative w-full overflow-hidden rounded-2xl px-5 py-4 text-left transition ${on ? "bg-white shadow-lift ring-1 ring-line" : "hover:bg-white/60"}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-extrabold ${on ? "bg-social text-white" : i < step ? "bg-ink text-white" : "bg-white text-slate-400 ring-1 ring-line"}`}>
                    {i < step ? <Check size={15} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className={`font-bold ${on ? "text-ink" : "text-slate-500"}`}>{s.title}</span>
                </div>
                {on && <p className="mt-1.5 pl-11 text-sm leading-relaxed text-slate-600">{s.desc}</p>}
                {on && !reduced && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-slate-100">
                    <span className="bg-social block h-full" style={{ width: `${Math.min(100, (t / s.dur) * 100)}%` }} />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="relative order-1 lg:order-2">
        <div className="relative h-[540px] overflow-hidden rounded-[36px] bg-gradient-to-br from-[#1b1530] via-ink to-[#0b1a2a] p-5 sm:p-7">
          <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-pop/30 blur-[90px]" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-brand-500/40 blur-[90px]" />
          {/* bar progres ala story */}
          <div className="relative flex gap-1.5" aria-hidden="true">
            {STEPS.map((s, i) => (
              <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                <span className="block h-full bg-white" style={{ width: i < step ? "100%" : i === step ? `${Math.min(100, (t / s.dur) * 100)}%` : "0%" }} />
              </span>
            ))}
          </div>
          <div className="relative mt-4 flex items-center gap-2 text-xs font-semibold text-white/70">
            <span className="bg-social grid h-7 w-7 place-items-center rounded-full text-white">
              <Sparkles size={13} />
            </span>
            SosmedAutopilot · langkah {step + 1} dari {STEPS.length}
          </div>
          <div key={step} className="relative mt-4 grid h-[430px] place-items-center">
            {step === 0 && <SceneBrief t={t} />}
            {step === 1 && <SceneIdeas t={t} />}
            {step === 2 && <SceneDesign t={t} />}
            {step === 3 && <SceneAcc t={t} />}
            {step === 4 && <ScenePosted t={t} />}
            {step === 5 && <SceneViral t={t} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- adegan

function AgentChip({ icon: Icon, name, tone, text }: { icon: typeof PenLine; name: string; tone: string; text: string }) {
  return (
    <div className="flex animate-fade-up items-center gap-2 text-sm text-white/80">
      <span className={`grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br text-white ${tone}`}>
        <Icon size={13} />
      </span>
      <b className="text-white">{name}</b> {text}
    </div>
  );
}

function SceneBrief({ t }: { t: number }) {
  const typed = Math.min(ASK.length, Math.floor(t / 38));
  return (
    <div className="w-full max-w-md space-y-4">
      <div className="ml-auto max-w-[88%] rounded-3xl rounded-br-lg bg-white px-5 py-4 text-[15px] leading-relaxed text-ink shadow-lift">
        {ASK.slice(0, typed)}
        {typed < ASK.length && <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-ink align-middle" />}
      </div>
      {typed >= ASK.length && (
        <div className="flex animate-fade-up items-center gap-2 text-sm text-white/70">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-orange-500 text-white">
            <PenLine size={13} />
          </span>
          Kata sedang menyiapkan ide
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/70" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

function SceneIdeas({ t }: { t: number }) {
  const picked = t > 2200;
  return (
    <div className="w-full max-w-md space-y-3">
      <AgentChip icon={PenLine} name="Kata" tone="from-amber-300 to-orange-500" text="menyiapkan 3 ide untukmu" />
      {IDEAS.map((idea, i) =>
        t > 300 + i * 350 ? (
          <div
            key={idea.t}
            className={`flex animate-fade-up items-center gap-3 rounded-2xl bg-white p-4 text-ink transition duration-300 ${picked && i === 1 ? "scale-[1.03] ring-4 ring-pop/60" : picked ? "opacity-50" : ""}`}
          >
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold text-brand-600 uppercase">{idea.k}</span>
              <div className="font-semibold">{idea.t}</div>
            </div>
            {picked && i === 1 ? (
              <span className="bg-social inline-flex animate-pop items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-white">
                <Check size={13} strokeWidth={3} /> ACC
              </span>
            ) : (
              <span className="rounded-full px-3 py-1.5 text-xs font-bold text-slate-400 ring-1 ring-line">ACC</span>
            )}
          </div>
        ) : null,
      )}
    </div>
  );
}

function SceneDesign({ t }: { t: number }) {
  const fan = t > 700;
  const pct = Math.min(100, Math.round((t / 3200) * 100));
  const slides = [1, 2, 3, 11, 13];
  return (
    <div className="flex w-full flex-col items-center">
      <AgentChip icon={Palette} name="Rupa" tone="from-brand-400 to-brand-600" text={pct < 100 ? `mendesain carousel… ${pct}%` : "selesai: 5 slide + caption"} />
      <div className="relative mt-8 h-56 w-full [perspective:1000px]">
        {slides.map((n, i) => {
          const off = i - 2;
          const tf = fan
            ? `translateX(${off * 92}px) translateZ(${-Math.abs(off) * 60}px) rotateY(${off * -14}deg)`
            : `translateX(0) translateZ(${-i * 4}px) rotateZ(${off * 2}deg)`;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={n}
              src={`/showcase/${n}.webp`}
              alt=""
              draggable={false}
              className="absolute top-0 left-1/2 -ml-[72px] aspect-[4/5] w-36 rounded-xl object-cover shadow-[0_20px_40px_-12px_rgb(0_0_0/0.6)] transition-transform duration-700 ease-out"
              style={{ transform: tf, zIndex: 10 - Math.abs(off) }}
            />
          );
        })}
      </div>
      {pct >= 100 && (
        <div className="mt-4 flex animate-fade-up flex-wrap justify-center gap-2 text-xs font-semibold">
          {["#kopisenja", "#promoakhirbulan", "#beli2gratis1"].map((h) => (
            <span key={h} className="rounded-full bg-white/10 px-3 py-1 text-white ring-1 ring-white/15">
              {h}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SceneAcc({ t }: { t: number }) {
  const pressed = t > 1700;
  return (
    <div className="flex items-center gap-6">
      <PhoneFrame className="h-[400px] w-[200px] shrink-0">
        <div className="pt-8">
          <SocialPost image="/showcase/1.webp" likes="0" compact />
        </div>
      </PhoneFrame>
      <div className="hidden w-52 space-y-3 sm:block">
        <p className="text-sm text-white/70">Preview persis seperti di feed. Sudah oke?</p>
        <button
          type="button"
          tabIndex={-1}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold text-white transition duration-200 ${pressed ? "scale-95 bg-emerald-500" : "bg-social animate-pulse"}`}
        >
          {pressed ? <Check size={17} strokeWidth={3} /> : <CalendarClock size={17} />} {pressed ? "Di-ACC!" : "ACC & jadwalkan"}
        </button>
        {pressed && (
          <div className="flex animate-pop items-center gap-2 rounded-2xl bg-white/10 px-3 py-2.5 text-sm text-white ring-1 ring-white/15">
            <CalendarClock size={16} className="text-pop" /> Jumat, 19.00 WIB
          </div>
        )}
      </div>
      {pressed && (
        <div className="absolute bottom-2 flex animate-pop items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-bold text-white sm:hidden">
          <Check size={15} strokeWidth={3} /> Di-ACC · Jumat 19.00
        </div>
      )}
    </div>
  );
}

function ScenePosted({ t }: { t: number }) {
  return (
    <div className="relative">
      <PhoneFrame className="h-[420px] w-[210px]">
        <div className="pt-8">
          <SocialPost image="/showcase/1.webp" likes="12" compact />
        </div>
      </PhoneFrame>
      {t > 500 && (
        <div className="absolute top-10 left-1/2 flex w-[290px] -translate-x-1/2 animate-fade-up items-start gap-3 rounded-2xl bg-white/95 p-3 text-ink shadow-lift backdrop-blur">
          <span className="bg-social grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white">
            <BellRing size={16} />
          </span>
          <span className="text-sm leading-snug">
            <b>Sudah tayang!</b>
            <span className="block text-slate-500">Postinganmu terbit di Instagram & TikTok.</span>
          </span>
        </div>
      )}
      {t > 1300 && (
        <div className="absolute -right-24 bottom-16 hidden animate-pop items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white ring-1 ring-white/15 sm:flex">
          <Send size={13} /> Siar: terkirim 19.00
        </div>
      )}
    </div>
  );
}

function SceneViral({ t }: { t: number }) {
  // likes melonjak lalu melambat (ease-out)
  const p = Math.min(1, t / 4200);
  const ease = 1 - Math.pow(1 - p, 3);
  const likes = Math.round(2487 * ease);
  const views = Math.round(18400 * ease);
  const shown = COMMENTS.filter((_, i) => t > 900 + i * 900);
  return (
    <div className="relative flex w-full items-center justify-center gap-6">
      <div className="relative">
        <PhoneFrame className="h-[420px] w-[210px]">
          <div className="pt-8">
            <SocialPost image="/showcase/1.webp" likes={fmt(likes)} liked compact />
            <div className="space-y-1.5 px-2.5">
              {shown.slice(-3).map((c) => (
                <p key={c} className="animate-fade-up text-[10px] leading-snug">
                  <b>pelanggan_{c.length}</b> {c}
                </p>
              ))}
            </div>
          </div>
        </PhoneFrame>
        <div className="pointer-events-none absolute bottom-28 left-6">
          {Array.from({ length: 8 }, (_, i) => (
            <Heart
              key={i}
              size={14 + (i % 3) * 6}
              className="animate-heart fill-pop text-pop absolute opacity-0"
              style={{ animationDelay: `${i * 0.3}s`, ["--dx" as string]: `${((i * 37) % 70) - 35}px` }}
            />
          ))}
        </div>
      </div>
      <div className="hidden w-56 space-y-3 sm:block">
        <Stat icon={Heart} tone="bg-social" label="Suka" value={fmt(likes)} />
        <Stat icon={Eye} tone="bg-sky-500" label="Ditonton" value={fmt(views)} />
        {t > 1600 && <Stat icon={MessageCircle} tone="bg-amber-500" label="Komentar" value={fmt(Math.round(186 * ease))} />}
        {t > 2600 && <Stat icon={UserPlus} tone="bg-emerald-500" label="Followers baru" value={`+${Math.round(86 * ease)}`} />}
        <svg viewBox="0 0 200 60" className="mt-2 w-full overflow-visible" aria-hidden="true">
          <path
            d="M0,55 C30,52 45,48 70,40 S115,30 135,20 S175,6 200,3"
            fill="none"
            stroke="url(#viral-g)"
            strokeWidth="3"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={1 - ease}
          />
          <defs>
            <linearGradient id="viral-g" x1="0" x2="1">
              <stop offset="0" stopColor="var(--color-sun)" />
              <stop offset="0.5" stopColor="var(--color-pop)" />
              <stop offset="1" stopColor="var(--color-brand-400)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className="absolute right-2 bottom-0 flex animate-pop items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-extrabold text-ink tabular-nums sm:hidden">
        <Heart size={14} className="fill-pop text-pop" /> {fmt(likes)}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, tone, label, value }: { icon: typeof Heart; tone: string; label: string; value: string }) {
  return (
    <div className="flex animate-fade-up items-center gap-3 rounded-2xl bg-white/10 px-3.5 py-2.5 text-white ring-1 ring-white/10 backdrop-blur">
      <span className={`grid h-8 w-8 place-items-center rounded-xl text-white ${tone}`}>
        <Icon size={15} />
      </span>
      <span className="flex-1 text-sm text-white/70">{label}</span>
      <span className="text-lg font-extrabold tabular-nums">{value}</span>
    </div>
  );
}
