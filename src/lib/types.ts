export type Platform = "instagram" | "tiktok";
export type PostFormat = "single" | "carousel";

export type FontKey =
  | "plus-jakarta-sans"
  | "poppins"
  | "montserrat"
  | "inter"
  | "playfair-display";

export interface Brand {
  name: string;
  handle: string; // @marqthink
  website: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  headingFont: FontKey;
  bodyFont: FontKey;
  logoUrl: string | null; // logo utama (dipakai di latar gelap / warna utama)
  logoAltUrl: string | null; // opsional: versi logo untuk latar terang
  description: string; // apa itu brand / produk
  audience: string;
  tone: string;
  pillars: string[];
  cta: string;
  hashtags: string[]; // hashtag tetap brand
  doDont: string; // hal yang wajib / dilarang
  exampleUrls: string[];
  styleNotes: string; // hasil analisis contoh post oleh AI
  defaultTemplate: TemplateKey;
  postingTime: string; // "19:00" WIB default jadwal
  imageSource: ImageSourceMode;
  imageStyle: string; // art direction untuk foto/ilustrasi
  assets: BrandAsset[]; // foto milik brand (produk, tim, kantor)
  autoReview: boolean; // AI art director mengecek hasil render
}

export type ImageSourceMode = "auto" | "ai" | "stock" | "brand" | "none";

export interface BrandAsset {
  id: string;
  url: string;
  description: string;
}

export type TemplateKey = "mix" | "bold" | "clean";

export const SLIDE_LAYOUTS = [
  "cover_photo", // foto full-bleed + judul besar
  "cover_split", // foto atas, panel warna bawah
  "cover_type", // tipografi besar + foto dalam frame (opsional)
  "point_photo", // poin + kartu foto
  "point_icon", // poin + ikon besar
  "list", // checklist 3-5 item
  "steps", // langkah bernomor 3-4
  "compare", // dua kolom: mitos vs fakta, salah vs benar
  "stat", // angka besar (+ ring chart bila persen)
  "quote", // kutipan (+ foto bulat opsional)
  "cta", // penutup / ajakan
] as const;
export type SlideLayout = (typeof SLIDE_LAYOUTS)[number];

/** Layout yang butuh foto. Tanpa foto, renderer otomatis memakai varian grafis. */
export const PHOTO_LAYOUTS: SlideLayout[] = ["cover_photo", "cover_split", "point_photo"];

export interface SlideImage {
  url: string;
  source: "ai" | "stock" | "brand" | "upload" | "demo";
  query: string; // kata kunci stok foto (Inggris)
  prompt: string; // prompt AI image
  credit: string; // atribusi (mis. fotografer Pexels)
}

export interface Slide {
  layout: SlideLayout;
  kicker: string; // label kecil di atas judul
  headline: string; // boleh pakai *kata* untuk highlight
  body: string;
  stat: string; // angka besar untuk layout "stat"
  items: string[]; // list / steps / kolom kiri compare
  itemsB: string[]; // kolom kanan compare
  labelA: string; // judul kolom kiri compare
  labelB: string; // judul kolom kanan compare
  icon: string; // nama ikon lucide
  image: SlideImage | null;
}

export type IdeaStatus = "pending" | "approved" | "rejected";

export interface Idea {
  id: string;
  title: string;
  hook: string;
  angle: string;
  pillar: string;
  format: PostFormat;
  rationale: string;
  status: IdeaStatus;
  feedback: string | null;
  post_id: string | null;
  created_at: string;
}

export type PostStatus =
  | "review" // menunggu ACC konten
  | "approved" // sudah ACC, siap/menunggu dikirim
  | "scheduled" // sudah dikirim ke publisher dengan jadwal
  | "published"
  | "failed"
  | "rejected";

export interface Post {
  id: string;
  idea_id: string | null;
  title: string;
  format: PostFormat;
  platforms: Platform[];
  caption: string;
  hashtags: string[];
  slides: Slide[];
  template: TemplateKey;
  status: PostStatus;
  scheduled_at: string | null;
  media_urls: string[];
  publish_ref: string | null;
  publish_result: unknown;
  error: string | null;
  revision_count: number;
  design_notes: string | null; // catatan AI art director
  created_at: string;
  updated_at: string;
}

export const DEFAULT_BRAND: Brand = {
  name: "Marqthink",
  handle: "@marqthink",
  website: "",
  colors: {
    primary: "#1B1F3B",
    secondary: "#4F46E5",
    accent: "#F5B83D",
    background: "#F7F6F2",
    text: "#14161F",
  },
  headingFont: "plus-jakarta-sans",
  bodyFont: "inter",
  logoUrl: null,
  logoAltUrl: null,
  description: "",
  audience: "",
  tone: "Profesional tapi santai, jelas, tidak lebay, pakai Bahasa Indonesia sehari-hari.",
  pillars: ["Edukasi", "Tips praktis", "Behind the scenes", "Promosi produk"],
  cta: "Follow untuk tips berikutnya",
  hashtags: [],
  doDont: "",
  exampleUrls: [],
  styleNotes: "",
  defaultTemplate: "mix",
  postingTime: "19:00",
  imageSource: "auto",
  imageStyle:
    "Foto lifestyle natural yang realistis, orang Indonesia bila ada manusia, cahaya hangat, komposisi bersih dengan ruang kosong, tidak ada teks di dalam gambar.",
  assets: [],
  autoReview: true,
};

export function normalizeSlide(s: Partial<Slide> & { layout?: string }): Slide {
  const legacy: Record<string, SlideLayout> = { cover: "cover_type", point: "point_icon" };
  const layout = (SLIDE_LAYOUTS as readonly string[]).includes(s.layout ?? "")
    ? (s.layout as SlideLayout)
    : legacy[s.layout ?? ""] ?? "point_icon";
  return {
    layout,
    kicker: s.kicker ?? "",
    headline: s.headline ?? "",
    body: s.body ?? "",
    stat: s.stat ?? "",
    items: s.items ?? [],
    itemsB: s.itemsB ?? [],
    labelA: s.labelA ?? "",
    labelB: s.labelB ?? "",
    icon: s.icon ?? "",
    image: s.image ?? null,
  };
}

// ---------------------------------------------------------------- Studio chat

export type ChatKind = "text" | "ideas" | "post" | "error";

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  agent: "kata" | "rupa" | "siar" | null;
  kind: ChatKind;
  text: string;
  refs: string[]; // id ide (kind=ideas) atau id post (kind=post)
  created_at: string;
}

export interface Job {
  id: string;
  status: "running" | "done" | "error";
  agent: "kata" | "rupa" | "siar";
  label: string; // "Rupa sedang menyusun desain…"
  created_at: string;
  updated_at: string;
}
