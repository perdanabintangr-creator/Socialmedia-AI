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
}

export type TemplateKey = "mix" | "bold" | "clean";

export type SlideLayout = "cover" | "point" | "stat" | "quote" | "cta";

export interface Slide {
  layout: SlideLayout;
  kicker: string; // label kecil di atas judul
  headline: string;
  body: string;
  stat: string; // angka besar untuk layout "stat"
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
};
