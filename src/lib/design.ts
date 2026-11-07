/**
 * Sistem desain konten (Design Pack + pasangan huruf + kepadatan teks).
 * Modul ringan tanpa JSX: aman dipakai di komponen klien, AI, dan pipeline.
 */
import { FONT_PAIRS, FONT_PAIR_KEYS, isFontPair, type FontPairKey } from "./font-pairs";

export const PACKS = {
  editorial: { label: "Editorial Magazine", short: "Editorial", desc: "Serif besar ala majalah, foto full-bleed, garis tipis — premium & elegan." },
  poster: { label: "Bold Poster", short: "Poster", desc: "Tipografi raksasa, foto duotone, stiker & pita teks — berani & gampang viral." },
  scrapbook: { label: "Scrapbook", short: "Scrapbook", desc: "Kertas bertekstur, polaroid + selotip, tulisan tangan — hangat & personal." },
} as const;
export type PackKey = keyof typeof PACKS;
export const PACK_KEYS = Object.keys(PACKS) as PackKey[];
export const isPack = (k: unknown): k is PackKey => typeof k === "string" && k in PACKS;

export const DENSITIES = {
  visual: { label: "Visual", desc: "Judul pendek saja, foto dominan, detail di caption." },
  seimbang: { label: "Seimbang", desc: "Judul + 1 kalimat pendek per slide." },
  edukatif: { label: "Edukatif", desc: "Lebih banyak penjelasan (tips, tutorial)." },
} as const;
export type Density = keyof typeof DENSITIES;
export const DENSITY_KEYS = Object.keys(DENSITIES) as Density[];
export const isDensity = (k: unknown): k is Density => typeof k === "string" && k in DENSITIES;

/** Pasangan huruf bawaan tiap pack. */
export const PACK_DEFAULT_PAIR: Record<PackKey, FontPairKey> = { editorial: "majalah", poster: "poster", scrapbook: "grotesk" };

/** Desain yang dipakai satu konten. null di post = template klasik. */
export interface PostDesign {
  pack: PackKey;
  pair: FontPairKey;
  density: Density;
}

/** Pilihan di Brand Kit: "auto" = AI yang memilih per konten, "classic" = template lama. */
export type PackChoice = PackKey | "auto" | "classic";
export type PairChoice = FontPairKey | "auto";

export const isPostDesign = (d: unknown): d is PostDesign =>
  Boolean(d && typeof d === "object" && isPack((d as PostDesign).pack) && isFontPair((d as PostDesign).pair) && isDensity((d as PostDesign).density));

/** Arah visual klasik yang punya bahasa desain sendiri (tetap memakai template lama). */
export const CLASSIC_ONLY_STYLES = ["berita", "info", "kreatif"];
/** Arah visual yang dipetakan ke pack. */
export const STYLE_TO_PACK: Record<string, PackKey> = { editorial: "editorial", promo: "poster" };

const has = (text: string, re: RegExp) => re.test(text.toLowerCase());

/** Tebakan cerdas tanpa AI: pack & huruf dari jenis bisnis + nada brand. */
export function guessDesign(b: { industry?: string; tone?: string; description?: string; name?: string }): { pack: PackKey; pair: FontPairKey } {
  const t = `${b.industry ?? ""} ${b.tone ?? ""} ${b.description ?? ""}`;
  if (has(t, /skincare|kosmetik|beauty|kecantikan|parfum|fashion|butik|boutique|wedding|perhiasan|jewel|hotel|resort|spa/)) return { pack: "editorial", pair: has(t, /fashion|parfum/) ? "fashion" : "mewah" };
  if (has(t, /promo|diskon|event|konser|gym|fitness|olahraga|sport|otomotif|bengkel|streetwear|barber/)) return { pack: "poster", pair: has(t, /streetwear|barber|musik/) ? "urban" : "poster" };
  if (has(t, /kopi|kafe|cafe|coffee|resto|kuliner|makan|bakery|roti|kue|dessert|minuman/)) return { pack: "editorial", pair: "hangat" };
  if (has(t, /anak|sekolah|kursus|edukasi|les |klinik|kesehatan|pet|hewan/)) return { pack: "scrapbook", pair: "ramah" };
  if (has(t, /aplikasi|startup|software|saas|ai\b|teknologi|fintech|crypto|digital/)) return { pack: "poster", pair: "tech" };
  if (has(t, /handmade|craft|kerajinan|komunitas|umkm|rumahan|florist|bunga/)) return { pack: "scrapbook", pair: "tangan" };
  if (has(t, /properti|arsitek|interior|konsultan|hukum|notaris|agensi|agency/)) return { pack: "editorial", pair: "modern" };
  return { pack: "editorial", pair: "majalah" };
}

/**
 * Tentukan desain konten baru.
 * - Teaser & arah visual klasik (berita/info/kreatif) & pilihan "classic" → null (template lama).
 * - Pack/huruf eksplisit dari Brand Kit dipakai; "auto" → saran AI (bila ada) → tebakan dari jenis bisnis.
 */
export function resolveDesign(
  brand: { designPack?: PackChoice; fontPair?: PairChoice; density?: Density; industry?: string; tone?: string; description?: string },
  opts: { style?: string | null; teaser?: boolean; ai?: { pack?: string | null; pair?: string | null } | null; ref?: PostDesign | null } = {},
): PostDesign | null {
  // Referensi dari owner (upload / Pinterest) paling menentukan: owner sudah menunjukkan gaya yang dia mau.
  if (!opts.teaser && opts.ref && isPostDesign(opts.ref)) return opts.ref;
  const choice = brand.designPack ?? "auto";
  if (opts.teaser || choice === "classic") return null;
  if (opts.style && CLASSIC_ONLY_STYLES.includes(opts.style)) return null;
  const guess = guessDesign(brand);
  const fromStyle = opts.style ? STYLE_TO_PACK[opts.style] : undefined;
  const pack: PackKey = fromStyle ?? (isPack(choice) ? choice : isPack(opts.ai?.pack) ? opts.ai.pack : guess.pack);
  const pairChoice = brand.fontPair ?? "auto";
  const pair: FontPairKey = isFontPair(pairChoice) ? pairChoice : isFontPair(opts.ai?.pair) ? opts.ai.pair : pack === guess.pack ? guess.pair : PACK_DEFAULT_PAIR[pack];
  return { pack, pair, density: brand.density ?? "visual" };
}

/** Arahan untuk AI copywriter sesuai kepadatan teks. */
export function densityGuide(d: Density) {
  if (d === "visual")
    return `# KEPADATAN TEKS: VISUAL (WAJIB)
Desainnya visual-first: foto & tipografi besar yang bicara, BUKAN paragraf.
- headline maks 6 kata (cover boleh 7). Tandai 1-2 kata kunci dengan *bintang*.
- body KOSONG ("") di cover dan slide poin. Penjelasan, harga, lokasi, jam buka → masuk CAPTION.
- kicker maks 2-3 kata. quote: body = nama sumber saja. cta: body maks 8 kata.
- Setiap cover & slide poin (point_photo) WAJIB punya foto (image.prompt diisi, change = true).
- Hindari list/steps/compare kecuali benar-benar perlu; bila dipakai maks 3 item ≤ 5 kata.
- Jumlah slide carousel ideal 4-6.`;
  if (d === "seimbang")
    return `# KEPADATAN TEKS: SEIMBANG
- headline maks 8 kata, body maks 1 kalimat pendek (≤ 12 kata). Detail tambahan di caption.
- Cover & sebagian besar slide poin pakai foto (point_photo).`;
  return `# KEPADATAN TEKS: EDUKATIF
- Boleh lebih informatif: headline ≤ 10 kata, body ≤ 25 kata, list/steps 3-5 item.
- Tetap selingi dengan slide foto supaya tidak monoton.`;
}

export const FONT_PAIR_GUIDE = FONT_PAIR_KEYS.map((k) => `${k}: ${FONT_PAIRS[k].label} — ${FONT_PAIRS[k].mood}`).join("\n");
export const PACK_GUIDE = PACK_KEYS.map((k) => `${k}: ${PACKS[k].label} — ${PACKS[k].desc}`).join("\n");

export const designLabel = (d: PostDesign) => `${PACKS[d.pack].short} · ${FONT_PAIRS[d.pair].label} · ${DENSITIES[d.density].label}`;
