"use client";

import { useEffect, useState } from "react";
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send } from "lucide-react";

/** Bingkai HP sederhana (bukan replika perangkat tertentu). */
export function PhoneFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-[46px] bg-ink p-[9px] shadow-[0_40px_80px_-20px_rgb(15_18_34/0.45),0_0_0_1px_rgb(255_255_255/0.06)_inset] ${className}`}>
      <div className="absolute top-[18px] left-1/2 z-20 h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-ink" />
      <div className="relative h-full w-full overflow-hidden rounded-[38px] bg-white">{children}</div>
    </div>
  );
}

/** Tampilan postingan feed generik: avatar, gambar, aksi, jumlah suka, caption. */
/** Gambar postingan; bila lebih dari satu, otomatis bergeser seperti carousel Instagram. */
function PostMedia({ images, interval = 2600 }: { images: string[]; interval?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (images.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((n) => (n + 1) % images.length), interval);
    return () => clearInterval(id);
  }, [images.length, interval]);
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden bg-slate-100">
      <div className="flex h-full transition-transform duration-700 ease-[cubic-bezier(.65,0,.35,1)]" style={{ transform: `translateX(-${i * 100}%)` }}>
        {images.map((src, k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={k} src={src} alt="" className="h-full w-full shrink-0 object-cover" draggable={false} />
        ))}
      </div>
      {images.length > 1 && (
        <>
          <span className="absolute top-2.5 right-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-white tabular-nums">
            {i + 1}/{images.length}
          </span>
          <span className="absolute inset-x-0 -bottom-4 flex justify-center gap-1">
            {images.map((_, k) => (
              <span key={k} className={`h-1 w-1 rounded-full transition ${k === i ? "bg-brand-500" : "bg-slate-300"}`} />
            ))}
          </span>
        </>
      )}
    </div>
  );
}

export function SocialPost({
  image,
  images,
  handle = "kabarkopi",
  likes,
  liked = false,
  caption = "Kopi 8 ribuan yang bikin antre ☕ Geser untuk strateginya!",
  comments,
  compact = false,
}: {
  image: string;
  images?: string[];
  handle?: string;
  likes: string;
  liked?: boolean;
  caption?: string;
  comments?: string;
  compact?: boolean;
}) {
  return (
    <div className="bg-white text-ink">
      <div className={`flex items-center gap-2 ${compact ? "px-2.5 py-2" : "px-3 py-2.5"}`}>
        <span className="story-ring">
          <span className="bg-social block h-6 w-6" />
        </span>
        <span className="flex-1 text-[11px] font-bold">{handle}</span>
        <MoreHorizontal size={14} className="text-slate-400" />
      </div>
      <PostMedia images={images?.length ? images : [image]} />
      <div className={compact ? "px-2.5 pt-2 pb-2.5" : "px-3 pt-2.5 pb-3"}>
        <div className="flex items-center gap-3">
          <Heart size={18} className={liked ? "fill-pop text-pop" : ""} />
          <MessageCircle size={18} />
          <Send size={17} />
          <Bookmark size={17} className="ml-auto" />
        </div>
        <div className="mt-1.5 text-[11px] font-bold tabular-nums">{likes} suka</div>
        {!compact && (
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug">
            <span className="font-bold">{handle}</span> {caption}
          </p>
        )}
        {comments && !compact && <p className="mt-0.5 text-[11px] text-slate-400">Lihat {comments} komentar</p>}
      </div>
    </div>
  );
}
