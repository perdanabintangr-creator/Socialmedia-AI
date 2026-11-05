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
export function SocialPost({
  image,
  handle = "kopisenja.id",
  likes,
  liked = false,
  caption = "Akhir bulan, dompet aman ☕ Beli 2 gratis 1 sampai Minggu!",
  comments,
  compact = false,
}: {
  image: string;
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="" className="aspect-[4/5] w-full object-cover" draggable={false} />
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
