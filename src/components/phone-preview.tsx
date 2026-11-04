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
}

/** Preview konten persis seperti di HP: tampilan feed Instagram atau TikTok photo mode. */
export function PhonePreview(props: PreviewProps & { className?: string }) {
  const [platform, setPlatform] = useState<"instagram" | "tiktok">("instagram");
  return (
    <div className={props.className}>
      <div className="mx-auto mb-4 flex w-fit rounded-xl bg-slate-100 p-1 text-sm font-semibold" role="tablist" aria-label="Pilih tampilan">
        {(["instagram", "tiktok"] as const).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={platform === p}
            onClick={() => setPlatform(p)}
            className={`rounded-lg px-4 py-1.5 transition ${platform === p ? "bg-white text-ink shadow-soft" : "text-slate-500"}`}
          >
            {p === "instagram" ? "Instagram" : "TikTok"}
          </button>
        ))}
      </div>
      <div className="mx-auto w-full max-w-[330px] rounded-[44px] bg-ink p-2.5 shadow-lift">
        <div className="relative overflow-hidden rounded-[36px] bg-white">
          <div className="absolute top-2 left-1/2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-ink" />
          {platform === "instagram" ? <InstagramView {...props} /> : <TikTokView {...props} />}
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
    if (el) el.scrollTo({ left: Math.max(0, Math.min(count - 1, i)) * el.clientWidth, behavior: "smooth" });
  };
  return { ref, idx, onScroll, go };
}

function Slides({ images, fit, c }: { images: string[]; fit: "cover" | "contain"; c: ReturnType<typeof useCarousel> }) {
  return (
    <div className="group relative">
      <div ref={c.ref} onScroll={c.onScroll} className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto">
        {images.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt={`Slide ${i + 1}`} className={`aspect-[4/5] w-full shrink-0 snap-center bg-slate-100 object-${fit}`} />
        ))}
      </div>
      {images.length > 1 && (
        <>
          {c.idx > 0 && (
            <button aria-label="Slide sebelumnya" onClick={() => c.go(c.idx - 1)} className="absolute top-1/2 left-2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-soft opacity-0 transition group-hover:opacity-100">
              <ChevronLeft size={16} />
            </button>
          )}
          {c.idx < images.length - 1 && (
            <button aria-label="Slide berikutnya" onClick={() => c.go(c.idx + 1)} className="absolute top-1/2 right-2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-soft opacity-0 transition group-hover:opacity-100">
              <ChevronRight size={16} />
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
      <div className="absolute top-10 left-0 right-0 z-10 flex justify-center gap-5 text-[13px] font-semibold">
        <span className="text-white/60">Mengikuti</span>
        <span className="border-b-2 border-white pb-1">Untuk Anda</span>
      </div>
      <Slides images={p.images} fit="contain" c={c} />
      {p.images.length > 1 && (
        <div className="absolute bottom-[132px] left-0 right-0 flex justify-center gap-1">
          {p.images.map((_, i) => (
            <span key={i} className={`h-1 rounded-full ${i === c.idx ? "w-4 bg-white" : "w-1 bg-white/50"}`} />
          ))}
        </div>
      )}
      <div className="absolute right-2.5 bottom-28 flex flex-col items-center gap-4 text-[11px] font-semibold">
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
      <div className="absolute right-16 bottom-6 left-3 text-[12px] leading-snug">
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
