export type Platform = "instagram" | "tiktok";
export type PostFormat = "single" | "carousel";

/**
 * Pustaka font desain (file .woff di assets/fonts). `body: false` = font display khusus judul
 * (satu ketebalan, terlalu padat untuk paragraf).
 */
export const FONT_OPTIONS = {
  "plus-jakarta-sans": { label: "Plus Jakarta Sans", style: "sans modern, rapi", weights: [500, 700, 800], body: true },
  poppins: { label: "Poppins", style: "sans geometris bulat, ramah", weights: [500, 700, 800], body: true },
  montserrat: { label: "Montserrat", style: "sans geometris lebar, kuat", weights: [500, 700, 800], body: true },
  inter: { label: "Inter", style: "sans netral, korporat", weights: [500, 700, 800], body: true },
  "playfair-display": { label: "Playfair Display", style: "serif elegan, editorial/mewah", weights: [500, 700, 800], body: true },
  outfit: { label: "Outfit", style: "sans geometris bersih, startup/fintech", weights: [400, 500, 700, 800], body: true },
  rubik: { label: "Rubik", style: "sans sudut membulat, playful & tebal", weights: [400, 500, 700, 800], body: true },
  "bricolage-grotesque": { label: "Bricolage Grotesque", style: "grotesque berkarakter, trendi", weights: [400, 500, 700, 800], body: true },
  anton: { label: "Anton", style: "display sangat tebal & sempit, gaya iklan/poster", weights: [400], body: false },
  "bebas-neue": { label: "Bebas Neue", style: "display kapital sempit, gaya headline promo", weights: [400], body: false },
  "archivo-black": { label: "Archivo Black", style: "display super tebal lebar, gaya promo/diskon", weights: [400], body: false },
  "lilita-one": { label: "Lilita One", style: "display bulat tebal, ceria/fun", weights: [400], body: false },
  "dm-serif-display": { label: "DM Serif Display", style: "serif display kontras tinggi, fashion/beauty", weights: [400], body: false },
} as const;
export type FontKey = keyof typeof FONT_OPTIONS;
export const FONT_KEYS = Object.keys(FONT_OPTIONS) as FontKey[];
export const BODY_FONT_KEYS = FONT_KEYS.filter((k) => FONT_OPTIONS[k].body);

export interface Brand {
  name: string;
  handle: string; // @brandkamu
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
  onboarded: boolean; // sudah menyelesaikan onboarding
  industry: string; // bidang usaha
  goals: string[]; // tujuan konten
  socialRequested: boolean; // klien minta akun sosmed dihubungkan
  performance: boolean; // pemantauan performa (baca metrik dari link) aktif
}

export type ImageSourceMode = "auto" | "ai" | "stock" | "brand" | "none";

export interface BrandAsset {
  id: string;
  url: string;
  description: string;
}

export const TEMPLATE_KEYS = ["mix", "bold", "clean", "promo"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

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
  "promo_hero", // iklan promo: foto orang/produk besar di latar warna + angka promo dalam starburst + tombol
  "promo_offer", // iklan promo tanpa foto: angka diskon raksasa, benefit, tombol
] as const;
export type SlideLayout = (typeof SLIDE_LAYOUTS)[number];

/** Layout yang butuh foto. Tanpa foto, renderer otomatis memakai varian grafis. */
export const PHOTO_LAYOUTS: SlideLayout[] = ["cover_photo", "cover_split", "point_photo", "promo_hero"];

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
  workspace_id: string;
  title: string;
  hook: string;
  angle: string;
  pillar: string;
  format: PostFormat;
  rationale: string;
  status: IdeaStatus;
  feedback: string | null;
  post_id: string | null;
  reference: PostReference | null; // referensi desain dari owner (dibawa ke konten)
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
  workspace_id: string;
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
  reference: PostReference | null; // referensi desain yang diikuti
  story: PostStory | null; // versi Story 9:16
  created_at: string;
  updated_at: string;
}

export const DEFAULT_BRAND: Brand = {
  name: "Brand Kamu",
  handle: "@brandkamu",
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
  onboarded: false,
  industry: "",
  goals: [],
  socialRequested: false,
  performance: false,
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

export interface Chat {
  id: string;
  workspace_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  workspace_id: string;
  chat_id: string | null;
  role: "user" | "agent";
  agent: "kata" | "rupa" | "siar" | null;
  kind: ChatKind;
  text: string;
  refs: string[]; // id ide (kind=ideas) atau id post (kind=post)
  attachments: string[]; // URL gambar referensi yang dilampirkan owner
  created_at: string;
}

export interface Job {
  id: string;
  workspace_id: string;
  status: "running" | "done" | "error";
  agent: "kata" | "rupa" | "siar";
  label: string; // "Rupa sedang menyusun desain…"
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------- Pengguna

export interface User {
  id: string;
  workspace_id: string | null;
  name: string;
  email: string;
  password_hash: string;
  role: "admin" | "member";
  status: "pending" | "active" | "disabled";
  created_at: string;
  last_login_at: string | null;
}
export type PublicUser = Omit<User, "password_hash">;

export interface Workspace {
  id: string;
  name: string;
  owner_id: string | null;
  publish_key: string | null; // Ayrshare Profile-Key: akun sosmed milik klien ini
  plan: PlanKey; // paket langganan (default "free": coba 3 konten)
  created_at: string;
}

// ---------------------------------------------------------------- Performa

export type InsightPlatform = "tiktok" | "instagram";
export type InsightKind = "post" | "profile";

/** Angka yang terbaca dari sebuah link. Field kosong = platform tidak menyediakannya. */
export interface InsightMetrics {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  followers?: number;
  following?: number;
  posts?: number;
  totalLikes?: number;
}

export interface TrackedLink {
  id: string;
  workspace_id: string;
  platform: InsightPlatform;
  kind: InsightKind;
  url: string;
  handle: string | null;
  title: string | null;
  thumbnail: string | null;
  metrics: InsightMetrics | null;
  history: { at: string; m: InsightMetrics }[]; // satu titik per hari, maks 90
  status: "pending" | "ok" | "error";
  error: string | null;
  post_id: string | null; // konten SosmedAutopilot yang terkait (bila ada)
  checked_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------- Referensi desain

/**
 * Contoh desain yang ditempel owner ("bikin seperti ini"). Hasil analisis dipakai AI untuk
 * meniru layout, tipografi, gaya copy & foto; palet & template dipakai renderer.
 */
export interface PostReference {
  urls: string[];
  notes: string; // analisis gaya: komposisi, hierarki teks, kepadatan, gaya copy
  imageStyle: string; // art direction foto/ilustrasi
  colors: Brand["colors"] | null; // null = tetap pakai warna brand
  headingFont: FontKey | null;
  bodyFont?: FontKey | null;
  template: TemplateKey | null;
  layouts: SlideLayout[]; // layout paling mirip untuk tiap gambar referensi
}

/** Brand Kit yang sudah disesuaikan dengan referensi (warna, font, gaya foto). Logo & nama tetap. */
export function styledBrand(brand: Brand, ref: PostReference | null | undefined): Brand {
  if (!ref) return brand;
  return {
    ...brand,
    colors: ref.colors ? { ...brand.colors, ...ref.colors } : brand.colors,
    headingFont: ref.headingFont ?? brand.headingFont,
    bodyFont: ref.bodyFont ?? brand.bodyFont,
    imageStyle: ref.imageStyle || brand.imageStyle,
  };
}

// ---------------------------------------------------------------- Biaya

export interface UsageLog {
  id: string;
  workspace_id: string;
  kind: string;
  post_id: string | null;
  ai_usd: number;
  image_usd: number;
  images: number;
  ai_calls: number;
  input_tokens: number;
  output_tokens: number;
  detail: string | null;
  created_at: string;
}

export const PLAN_KEYS = ["free", "newbie", "starter", "growth", "agency"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

/** Versi Story 9:16 dari sebuah konten feed. */
export interface PostStory {
  frames: number[]; // index slide yang dijadikan frame Story
  status: "approved" | "scheduled" | "published" | "failed";
  scheduled_at: string | null;
  media_urls: string[];
  publish_refs: string[];
  error: string | null;
  updated_at: string;
}
