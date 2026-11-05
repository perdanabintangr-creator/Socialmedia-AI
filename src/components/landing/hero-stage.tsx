"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Repeat2, UserPlus } from "lucide-react";
import { PhoneFrame, SocialPost } from "./social-post";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

/** Kartu postingan yang melayang di ruang 3D di sekitar HP. */
const CARDS = [
  { src: "/showcase/1.webp", pos: "left-[2%] top-[14%]", t: "rotateY(32deg) rotateZ(-4deg) translateZ(-120px)", w: "w-44", delay: "0s" },
  { src: "/showcase/3.webp", pos: "left-[17%] top-[46%]", t: "rotateY(22deg) rotateZ(3deg) translateZ(-20px)", w: "w-40", delay: "-2s" },
  { src: "/showcase/5.webp", pos: "right-[2%] top-[10%]", t: "rotateY(-32deg) rotateZ(4deg) translateZ(-120px)", w: "w-44", delay: "-4s" },
  { src: "/showcase/2.webp", pos: "right-[16%] top-[48%]", t: "rotateY(-22deg) rotateZ(-3deg) translateZ(-20px)", w: "w-40", delay: "-1s" },
];

const HEARTS = [
  { dx: "-36px", delay: "0s", size: 22 },
  { dx: "18px", delay: "0.5s", size: 16 },
  { dx: "-8px", delay: "1.1s", size: 26 },
  { dx: "40px", delay: "1.6s", size: 18 },
  { dx: "-24px", delay: "2s", size: 14 },
];

/** Panggung hero: HP di tengah + kartu 3D yang mengikuti gerak kursor, likes terus bertambah. */
export function HeroStage() {
  const stage = useRef<HTMLDivElement>(null);
  const [likes, setLikes] = useState(1248);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const r = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(r);
    if (r) return;
    const id = setInterval(() => setLikes((n) => n + 3 + Math.floor(Math.random() * 19)), 420);
    return () => clearInterval(id);
  }, []);

  const onMove = (e: React.MouseEvent) => {
    if (reduced || !stage.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    stage.current.style.transform = `rotateX(${(-y * 8).toFixed(2)}deg) rotateY(${(x * 12).toFixed(2)}deg)`;
  };
  const onLeave = () => {
    if (stage.current) stage.current.style.transform = "rotateX(0deg) rotateY(0deg)";
  };

  return (
    <div
      className="relative mx-auto h-[540px] w-full max-w-6xl sm:h-[600px] [perspective:1600px]"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      role="img"
      aria-label="Ilustrasi: postingan brand tayang di HP, likes dan komentar terus bertambah"
    >
      <div ref={stage} className="absolute inset-0 transition-transform duration-500 ease-out [transform-style:preserve-3d]">
        {/* lantai bercahaya */}
        <div className="absolute bottom-6 left-1/2 h-24 w-[70%] -translate-x-1/2 rounded-[100%] bg-brand-400/25 blur-3xl" />

        {CARDS.map((c) => (
          <div key={c.src} className={`absolute hidden md:block ${c.pos}`} style={{ transform: c.t, transformStyle: "preserve-3d" }}>
            <div className="animate-float-slow" style={{ animationDelay: c.delay }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.src} alt="" draggable={false} className={`${c.w} aspect-[4/5] max-w-none rounded-2xl object-cover shadow-[0_30px_60px_-15px_rgb(15_18_34/0.35)] ring-1 ring-black/5`} />
            </div>
          </div>
        ))}

        {/* HP */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2" style={{ transform: "translateX(-50%) translateZ(80px)" }}>
          <div className="animate-float">
            <PhoneFrame className="h-[520px] w-[262px] sm:h-[560px] sm:w-[280px]">
              <div className="flex items-center justify-between px-4 pt-11 pb-2 text-[13px] font-extrabold tracking-tight">
                <span>Beranda</span>
                <Heart size={17} />
              </div>
              <div className="scrollbar-none flex gap-3 overflow-hidden px-3 pb-2">
                {["kamu", "rupa", "kata", "siar", "promo"].map((s, i) => (
                  <span key={s} className="flex shrink-0 flex-col items-center gap-1">
                    <span className={i < 3 ? "story-ring" : "rounded-full p-[2.5px] ring-1 ring-slate-200"}>
                      <span className={`block h-10 w-10 ${["bg-social", "bg-brand-400", "bg-amber-300", "bg-sky-400", "bg-pink-300"][i]}`} />
                    </span>
                    <span className="text-[9px] text-slate-500">{s}</span>
                  </span>
                ))}
              </div>
              <SocialPost image="/showcase/1.webp" likes={fmt(likes)} liked comments="186" />
            </PhoneFrame>
            {/* hati melayang dari tombol suka */}
            {!reduced && (
              <div className="pointer-events-none absolute bottom-24 left-10">
                {HEARTS.map((h, i) => (
                  <Heart
                    key={i}
                    size={h.size}
                    className="animate-heart fill-pop text-pop absolute opacity-0"
                    style={{ animationDelay: h.delay, ["--dx" as string]: h.dx }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* notifikasi melayang */}
        <Bubble className="top-[4%] left-1 sm:top-[16%] sm:left-[calc(50%-430px)]" z={140} delay="-1s">
          <span className="bg-social grid h-8 w-8 place-items-center rounded-full text-white">
            <Heart size={15} className="fill-white" />
          </span>
          <span>
            <b className="tabular-nums">+{fmt(likes - 1100)}</b> suka baru
          </span>
        </Bubble>
        <Bubble className="top-[52%] right-1 sm:top-[38%] sm:right-auto sm:left-[calc(50%+165px)]" z={160} delay="-3s">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-sky-500 text-white">
            <MessageCircle size={15} />
          </span>
          <span className="max-w-[150px] leading-tight">
            <b>“Mau dong kak 😍”</b>
            <span className="block text-[11px] text-slate-500">komentar baru</span>
          </span>
        </Bubble>
        <Bubble className="bottom-[16%] left-[calc(50%-260px)] hidden sm:flex" z={120} delay="-5s">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500 text-white">
            <UserPlus size={15} />
          </span>
          <span>
            <b>+86</b> followers
          </span>
        </Bubble>
        <Bubble className="right-[calc(50%-270px)] bottom-[8%] hidden sm:flex" z={100} delay="-2s">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-500 text-white">
            <Repeat2 size={15} />
          </span>
          <span>
            <b>312</b> dibagikan
          </span>
        </Bubble>
      </div>
    </div>
  );
}

function Bubble({ children, className, z, delay }: { children: React.ReactNode; className: string; z: number; delay: string }) {
  return (
    <div className={`absolute flex ${className}`} style={{ transform: `translateZ(${z}px)` }}>
      <div className="animate-float flex items-center gap-2.5 rounded-2xl bg-white/90 py-2 pr-4 pl-2 text-sm shadow-lift ring-1 ring-black/5 backdrop-blur" style={{ animationDelay: delay }}>
        {children}
      </div>
    </div>
  );
}
