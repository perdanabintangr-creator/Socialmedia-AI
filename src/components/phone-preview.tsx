"use client";

import { useRef, useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight, Heart, MessageCircle, Music2, Plus, Send, Share2 } from "lucide-react";

export interface PreviewProps {
  images: string[];
  brandName: string;
  handle: string;
  logoUrl: string | null;
  primary: string;
  caption: string;
  hashtags: string[];
  storyImages?: string[]; // versi Story 9:16 (opsional)
}

/** Preview konten persis seperti di HP: tampilan feed Instagram atau TikTok photo mode. */
export function PhonePreview(props: PreviewProps & { className?: string }) {
  const [platform, setPlatform] = useState<"instagram" | "tiktok" | "story">("instagram");
  const tabs = (props.storyImages?.length ? (["instagram", "tiktok", "story"] as const) : (["instagram", "tiktok"] as const));
  return (
    <div className={props.className}>
      <div className="mx-auto mb-4 flex w-fit rounded-xl bg-slate-100 p-1 text-sm font-semibold" role="tablist" aria-label="Pilih tampilan">
        {tabs.map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={platform === p}
            onClick={() => setPlatform(p)}
            className={`rounded-lg px-4 py-1.5 transition ${platform === p ? "bg-white text-ink shadow-soft" : "text-slate-500"}`}
          >
            {p === "instagram" ? "Instagram" : p === "tiktok" ? "TikTok" : "Story"}
          </button>
        ))}
      </div>
      <div className="mx-auto w-full max-w-[330px] rounded-[44px] bg-ink p-2.5 shadow-lift">
        <div className="relative overflow-hidden rounded-[36px] bg-white">
          <div className="absolute top-2 left-1/2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-ink" />
          {platform === "instagram" ? <InstagramView {...props} /> : platform === "tiktok" ? <TikTokView {...props} /> : <StoryView {...props} />}
        </div>
      </div>
    </div>
  );
}

const handleOf = (p: PreviewProps) => (p.handle || p.brandName).replace(/^@/, "").toLowerCase().replace(/\s+/g, "");

function Avatar({ p, size = 30 }: { p: PreviewProps; size?: number }) {
  return p.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.logoUrl} alt="" className="rounded-full bg-white object-contain p-0.5 ring-1 ring-black/10" style={{ width: size, height: size }} />
  ) : (
    <span className="grid place-items-center rounded-full text-[11px] font-bold text-white" style={{ width: size, height: size, background: p.primary }}>
      {p.brandName.slice(0, 1).toUpperCase()}
    </span>
  );
}

function useCarousel(count: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const onScroll = () => {
    const el = ref.current;
    if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };
  const go = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const n = Math.max(0, Math.min(count - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
    setIdx(n);
  };
  return { ref, idx, onScroll, go, count };
}

/**
 * Slide yang bisa digeser: swipe (sentuh), seret mouse, tombol panah, tombol keyboard,
 * dan (TikTok) ketuk sisi kiri/kanan seperti di aplikasinya.
 */
function Slides({ images, fit, c, tapZones = false, arrows = "hover" }: { images: string[]; fit: "cover" | "contain"; c: ReturnType<typeof useCarousel>; tapZones?: boolean; arrows?: "hover" | "always" }) {
  const drag = useRef<{ x: number; left: number; moved: boolean; id: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const many = images.length > 1;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!many || e.pointerType === "touch") return; // sentuhan: biarkan scroll bawaan (lebih mulus)
    const el = c.ref.current;
    if (!el) return;
    drag.current = { x: e.clientX, left: el.scrollLeft, moved: false, id: e.pointerId };
    el.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = c.ref.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 4) d.moved = true;
    el.scrollLeft = d.left - dx;
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = c.ref.current;
    drag.current = null;
    setDragging(false);
    if (!d || !el) return;
    el.releasePointerCapture(d.id);
    const dx = e.clientX - d.x;
    if (d.moved) {
      // geser > 15% lebar = pindah slide
      const start = Math.round(d.left / el.clientWidth);
      c.go(Math.abs(dx) > el.clientWidth * 0.15 ? start + (dx < 0 ? 1 : -1) : start);
    } else if (tapZones) {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      if (x < 0.35) c.go(c.idx - 1);
      else if (x > 0.65) c.go(c.idx + 1);
    }
  };

  const arrowCls = `absolute top-1/2 z-30 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-soft transition hover:bg-white ${arrows === "hover" ? "opacity-0 group-hover:opacity-100 focus-visible:opacity-100" : ""}`;

  return (
    <div
      className="group relative"
      tabIndex={many ? 0 : -1}
      aria-roledescription="carousel"
      aria-label={`Slide ${c.idx + 1} dari ${images.length}`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") c.go(c.idx + 1);
        if (e.key === "ArrowLeft") c.go(c.idx - 1);
      }}
    >
      <div
        ref={c.ref}
        onScroll={c.onScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`scrollbar-none flex touch-pan-x overflow-x-auto overscroll-x-contain ${dragging ? "cursor-grabbing select-none" : `snap-x snap-mandatory ${many ? "cursor-grab" : ""}`}`}
      >
        {images.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt={`Slide ${i + 1}`} draggable={false} className={`pointer-events-none aspect-[4/5] w-full shrink-0 snap-center bg-slate-100 object-${fit}`} />
        ))}
      </div>
      {many && (
        <>
          {c.idx > 0 && (
            <button aria-label="Slide sebelumnya" onClick={() => c.go(c.idx - 1)} className={`${arrowCls} left-2`}>
              <ChevronLeft size={17} />
            </button>
          )}
          {c.idx < images.length - 1 && (
            <button aria-label="Slide berikutnya" onClick={() => c.go(c.idx + 1)} className={`${arrowCls} right-2`}>
              <ChevronRight size={17} />
            </button>
          )}
        </>
      )}
    </div>
  );
}

function InstagramView(p: PreviewProps) {
  const c = useCarousel(p.images.length);
  const [more, setMore] = useState(false);
  const tags = p.hashtags.map((h) => `#${h}`).join(" ");
  return (
    <div className="max-h-[640px] overflow-y-auto pt-9 pb-3 text-[13px] text-ink">
      <div className="flex items-center gap-2.5 px-3 pb-2.5">
        <span className="rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[2px]">
          <span className="block rounded-full bg-white p-[1.5px]">
            <Avatar p={p} />
          </span>
        </span>
        <div className="font-semibold leading-tight">{handleOf(p)}</div>
        <span className="ml-auto text-lg leading-none text-slate-500">···</span>
      </div>
      <Slides images={p.images} fit="cover" c={c} />
      <div className="flex items-center gap-4 px-3 pt-3">
        <Heart size={22} />
        <MessageCircle size={22} />
        <Send size={21} />
        {p.images.length > 1 && (
          <div className="mx-auto flex gap-1">
            {p.images.map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === c.idx ? "bg-[#0095f6]" : "bg-slate-300"}`} />
            ))}
          </div>
        )}
        <Bookmark size={22} className={p.images.length > 1 ? "" : "ml-auto"} />
      </div>
      <div className="px-3 pt-2.5 leading-snug">
        <span className="font-semibold">{handleOf(p)}</span>{" "}
        <span className="whitespace-pre-line">{more ? p.caption : p.caption.split("\n")[0].slice(0, 110)}</span>
        {!more && (p.caption.length > 110 || p.caption.includes("\n") || tags) ? (
          <button onClick={() => setMore(true)} className="text-slate-500">
            {" "}… selengkapnya
          </button>
        ) : null}
        {more && tags && <div className="mt-1 text-[#00376b]">{tags}</div>}
      </div>
      <div className="px-3 pt-1.5 text-[11px] text-slate-400">Pratinjau · belum dipublikasikan</div>
    </div>
  );
}

function TikTokView(p: PreviewProps) {
  const c = useCarousel(p.images.length);
  const tags = p.hashtags.map((h) => `#${h}`).join(" ");
  return (
    <div className="relative flex aspect-[9/19] flex-col justify-center bg-black text-white">
      <div className="pointer-events-none absolute top-10 left-0 right-0 z-10 flex justify-center gap-5 text-[13px] font-semibold">
        <span className="text-white/60">Mengikuti</span>
        <span className="border-b-2 border-white pb-1">Untuk Anda</span>
      </div>
      <Slides images={p.images} fit="contain" c={c} tapZones arrows="always" />
      {p.images.length > 1 && (
        <div className="pointer-events-none absolute bottom-[132px] left-0 right-0 flex justify-center gap-1">
          {p.images.map((_, i) => (
            <span key={i} className={`h-1 rounded-full ${i === c.idx ? "w-4 bg-white" : "w-1 bg-white/50"}`} />
          ))}
        </div>
      )}
      {/* ikon samping hanya hiasan: jangan menghalangi geser / tombol panah */}
      <div className="pointer-events-none absolute right-2.5 bottom-24 z-10 flex flex-col items-center gap-3.5 text-[11px] font-semibold [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.75))]">
        <span className="relative">
          <Avatar p={p} size={40} />
          <span className="absolute -bottom-2 left-1/2 grid h-4 w-4 -translate-x-1/2 place-items-center rounded-full bg-[#fe2c55]">
            <Plus size={11} strokeWidth={3} />
          </span>
        </span>
        <span className="flex flex-col items-center gap-0.5"><Heart size={26} fill="white" />Suka</span>
        <span className="flex flex-col items-center gap-0.5"><MessageCircle size={25} fill="white" />Komentar</span>
        <span className="flex flex-col items-center gap-0.5"><Bookmark size={24} fill="white" />Simpan</span>
        <span className="flex flex-col items-center gap-0.5"><Share2 size={24} />Bagikan</span>
      </div>
      <div className="pointer-events-none absolute right-16 bottom-6 left-3 text-[12px] leading-snug">
        <div className="font-bold">@{handleOf(p)}</div>
        <p className="mt-1 line-clamp-2 text-white/90">
          {p.caption.split("\n")[0]} <span className="font-semibold">{tags}</span>
        </p>
        <div className="mt-1.5 flex items-center gap-1.5 text-white/80">
          <Music2 size={12} /> <span className="truncate">Suara asli · {p.brandName}</span>
        </div>
      </div>
    </div>
  );
}

/** Pratinjau Story 9:16: bar progres per frame, ketuk kiri/kanan untuk pindah frame. */
function StoryView(p: PreviewProps) {
  const frames = p.storyImages ?? [];
  const [i, setI] = useState(0);
  const go = (n: number) => setI(Math.max(0, Math.min(frames.length - 1, n)));
  return (
    <div className="relative aspect-[9/16] bg-black text-white select-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={frames[i]} alt={`Frame Story ${i + 1}`} className="h-full w-full object-cover" draggable={false} />
      <div className="absolute top-8 right-3 left-3 flex gap-1">
        {frames.map((_, n) => (
          <span key={n} className={`h-0.5 flex-1 rounded-full ${n <= i ? "bg-white" : "bg-white/35"}`} />
        ))}
      </div>
      <div className="absolute top-11 left-3 flex items-center gap-2 text-[12px] font-semibold drop-shadow">
        <Avatar p={p} size={26} /> {handleOf(p)} <span className="font-normal text-white/70">· Pratinjau</span>
      </div>
      <button aria-label="Frame sebelumnya" onClick={() => go(i - 1)} className="absolute inset-y-0 left-0 w-1/3" />
      <button aria-label="Frame berikutnya" onClick={() => go(i + 1)} className="absolute inset-y-0 right-0 w-1/3" />
      <div className="pointer-events-none absolute right-3 bottom-4 left-3 flex items-center gap-2">
        <span className="flex-1 rounded-full border border-white/60 px-3 py-2 text-[11px] text-white/80">Kirim pesan</span>
        <Heart size={20} />
        <Send size={19} />
      </div>
    </div>
  );
}
