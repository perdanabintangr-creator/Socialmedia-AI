/**
 * Pasangan huruf ala desainer: judul (Head) + aksen highlight (HeadI) + isi (Body/BodyB) + tulisan tangan (Hand).
 * Dipakai Design Pack; customer memilih secara visual, atau AI memilih sesuai brand/referensi.
 * `wf` = perkiraan lebar rata-rata huruf (em) — dipakai menghitung ukuran supaya judul muat.
 */
export interface FontPair {
  label: string;
  mood: string;
  head: string; // file .woff di assets/fonts
  headI: string; // aksen highlight (italic / varian)
  italic: boolean; // headI benar-benar italic
  body: string; // 500
  bodyBold: string; // 700
  bodyBlack: string; // 800–900
  hand: string;
  upper: boolean; // font kapital (poster)
  wf: number;
  lh: number; // line-height judul
}

const caveat = "caveat-latin-700-normal.woff";

export const FONT_PAIRS = {
  majalah: {
    label: "Majalah Klasik",
    mood: "serif ramping ala majalah, elegan, premium, editorial",
    head: "instrument-serif-latin-400-normal.woff",
    headI: "instrument-serif-latin-400-italic.woff",
    italic: true,
    body: "inter-tight-latin-500-normal.woff",
    bodyBold: "inter-tight-latin-700-normal.woff",
    bodyBlack: "inter-tight-latin-900-normal.woff",
    hand: caveat,
    upper: false,
    wf: 0.4,
    lh: 0.98,
  },
  mewah: {
    label: "Mewah Lembut",
    mood: "serif klasik halus, butik, wedding, skincare, hotel",
    head: "cormorant-garamond-latin-600-normal.woff",
    headI: "cormorant-garamond-latin-600-italic.woff",
    italic: true,
    body: "manrope-latin-500-normal.woff",
    bodyBold: "manrope-latin-700-normal.woff",
    bodyBlack: "manrope-latin-800-normal.woff",
    hand: caveat,
    upper: false,
    wf: 0.4,
    lh: 0.98,
  },
  fashion: {
    label: "Fashion Kontras",
    mood: "serif kontras tinggi ala Vogue, fashion, beauty, parfum",
    head: "bodoni-moda-latin-700-normal.woff",
    headI: "bodoni-moda-latin-500-italic.woff",
    italic: true,
    body: "dm-sans-latin-500-normal.woff",
    bodyBold: "dm-sans-latin-700-normal.woff",
    bodyBlack: "dm-sans-latin-700-normal.woff",
    hand: caveat,
    upper: false,
    wf: 0.5,
    lh: 1,
  },
  hangat: {
    label: "Serif Hangat",
    mood: "serif tebal membulat, kuliner, kafe, bakery, rumahan",
    head: "fraunces-latin-900-normal.woff",
    headI: "fraunces-latin-700-italic.woff",
    italic: true,
    body: "dm-sans-latin-500-normal.woff",
    bodyBold: "dm-sans-latin-700-normal.woff",
    bodyBlack: "dm-sans-latin-700-normal.woff",
    hand: caveat,
    upper: false,
    wf: 0.54,
    lh: 1,
  },
  modern: {
    label: "Serif Modern",
    mood: "serif display tegas, kreatif, arsitektur, agensi",
    head: "gloock-latin-400-normal.woff",
    headI: "playfair-display-latin-700-italic.woff",
    italic: true,
    body: "manrope-latin-500-normal.woff",
    bodyBold: "manrope-latin-700-normal.woff",
    bodyBlack: "manrope-latin-800-normal.woff",
    hand: caveat,
    upper: false,
    wf: 0.5,
    lh: 1,
  },
  poster: {
    label: "Poster Tebal",
    mood: "kapital sempit super tebal, promo, event, olahraga, viral",
    head: "anton-latin-400-normal.woff",
    headI: "anton-latin-400-normal.woff",
    italic: false,
    body: "inter-tight-latin-500-normal.woff",
    bodyBold: "inter-tight-latin-700-normal.woff",
    bodyBlack: "inter-tight-latin-900-normal.woff",
    hand: caveat,
    upper: true,
    wf: 0.47,
    lh: 0.92,
  },
  urban: {
    label: "Urban Street",
    mood: "kapital sempit bersih, streetwear, musik, barbershop",
    head: "bebas-neue-latin-400-normal.woff",
    headI: "bebas-neue-latin-400-normal.woff",
    italic: false,
    body: "space-grotesk-latin-500-normal.woff",
    bodyBold: "space-grotesk-latin-700-normal.woff",
    bodyBlack: "space-grotesk-latin-700-normal.woff",
    hand: "permanent-marker-latin-400-normal.woff",
    upper: true,
    wf: 0.4,
    lh: 0.9,
  },
  brutal: {
    label: "Brutalist",
    mood: "kondensed hitam + mono, tech, gaming, startup berani",
    head: "big-shoulders-display-latin-900-normal.woff",
    headI: "big-shoulders-display-latin-800-normal.woff",
    italic: false,
    body: "ibm-plex-mono-latin-500-normal.woff",
    bodyBold: "ibm-plex-mono-latin-700-normal.woff",
    bodyBlack: "ibm-plex-mono-latin-700-normal.woff",
    hand: "permanent-marker-latin-400-normal.woff",
    upper: true,
    wf: 0.44,
    lh: 0.9,
  },
  retro: {
    label: "Retro Groovy",
    mood: "display tebal miring ala 70-an, dessert, minuman, fun",
    head: "shrikhand-latin-400-normal.woff",
    headI: "shrikhand-latin-400-normal.woff",
    italic: false,
    body: "nunito-latin-500-normal.woff",
    bodyBold: "nunito-latin-800-normal.woff",
    bodyBlack: "nunito-latin-800-normal.woff",
    hand: caveat,
    upper: false,
    wf: 0.62,
    lh: 1.02,
  },
  tech: {
    label: "Tech Lebar",
    mood: "sans lebar futuristik, aplikasi, fintech, AI, crypto",
    head: "unbounded-latin-900-normal.woff",
    headI: "unbounded-latin-700-normal.woff",
    italic: false,
    body: "sora-latin-500-normal.woff",
    bodyBold: "sora-latin-700-normal.woff",
    bodyBlack: "sora-latin-700-normal.woff",
    hand: caveat,
    upper: false,
    wf: 0.72,
    lh: 1,
  },
  ramah: {
    label: "Ramah Bulat",
    mood: "sans bulat lembut, anak, edukasi, kesehatan, pet shop",
    head: "fredoka-latin-700-normal.woff",
    headI: "fredoka-latin-600-normal.woff",
    italic: false,
    body: "nunito-latin-500-normal.woff",
    bodyBold: "nunito-latin-800-normal.woff",
    bodyBlack: "nunito-latin-800-normal.woff",
    hand: caveat,
    upper: false,
    wf: 0.55,
    lh: 1.02,
  },
  trendi: {
    label: "Trendi Gen-Z",
    mood: "grotesk berkarakter, kreatif, komunitas, brand anak muda",
    head: "syne-latin-800-normal.woff",
    headI: "instrument-serif-latin-400-italic.woff",
    italic: true,
    body: "manrope-latin-500-normal.woff",
    bodyBold: "manrope-latin-700-normal.woff",
    bodyBlack: "manrope-latin-800-normal.woff",
    hand: caveat,
    upper: false,
    wf: 0.62,
    lh: 1,
  },
  grotesk: {
    label: "Grotesk Tebal",
    mood: "sans hitam tebal + serif italic, serbaguna, bersih, kekinian",
    head: "inter-tight-latin-900-normal.woff",
    headI: "instrument-serif-latin-400-italic.woff",
    italic: true,
    body: "inter-tight-latin-500-normal.woff",
    bodyBold: "inter-tight-latin-700-normal.woff",
    bodyBlack: "inter-tight-latin-900-normal.woff",
    hand: caveat,
    upper: false,
    wf: 0.56,
    lh: 1.02,
  },
  tangan: {
    label: "Tulisan Tangan",
    mood: "spidol tulisan tangan, personal, DIY, craft, handmade",
    head: "permanent-marker-latin-400-normal.woff",
    headI: "permanent-marker-latin-400-normal.woff",
    italic: false,
    body: "nunito-latin-500-normal.woff",
    bodyBold: "nunito-latin-800-normal.woff",
    bodyBlack: "nunito-latin-800-normal.woff",
    hand: caveat,
    upper: false,
    wf: 0.58,
    lh: 1.05,
  },
  bersahaja: {
    label: "Bersahaja",
    mood: "serif ramah sederhana, lifestyle, buku, kopi spesialti",
    head: "young-serif-latin-400-normal.woff",
    headI: "fraunces-latin-700-italic.woff",
    italic: true,
    body: "dm-sans-latin-500-normal.woff",
    bodyBold: "dm-sans-latin-700-normal.woff",
    bodyBlack: "dm-sans-latin-700-normal.woff",
    hand: caveat,
    upper: false,
    wf: 0.52,
    lh: 1.04,
  },
} satisfies Record<string, FontPair>;

export type FontPairKey = keyof typeof FONT_PAIRS;
export const FONT_PAIR_KEYS = Object.keys(FONT_PAIRS) as FontPairKey[];
export const isFontPair = (k: unknown): k is FontPairKey => typeof k === "string" && k in FONT_PAIRS;

/** File font yang perlu dimuat satori untuk satu pasangan. */
export function pairFonts(key: FontPairKey) {
  const p: FontPair = FONT_PAIRS[key];
  return [
    { name: "Head", file: p.head, weight: 400 as const, style: "normal" as const },
    { name: "HeadI", file: p.headI, weight: 400 as const, style: (p.italic ? "italic" : "normal") as "italic" | "normal" },
    { name: "Body", file: p.body, weight: 500 as const, style: "normal" as const },
    { name: "Body", file: p.bodyBold, weight: 700 as const, style: "normal" as const },
    { name: "BodyB", file: p.bodyBlack, weight: 900 as const, style: "normal" as const },
    { name: "Hand", file: p.hand, weight: 400 as const, style: "normal" as const },
  ];
}
