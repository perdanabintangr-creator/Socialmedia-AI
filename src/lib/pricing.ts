/**
 * Paket harga yang tampil di landing page.
 * CATATAN: masih harga contoh — ubah di sini sebelum dipromosikan.
 */
export interface Plan {
  name: string;
  price: string; // tampil apa adanya
  period: string;
  tagline: string;
  features: string[];
  highlight?: boolean;
  cta: string;
}

/** Coba gratis: 3 konten kualitas dasar (lihat lib/plans.ts). Otak AI sama di semua paket. */
export const FREE_TRIAL = "Coba gratis 3 konten, tanpa kartu kredit";

export const PLANS: Plan[] = [
  {
    name: "Newbie",
    price: "Rp49rb",
    period: "/bulan",
    tagline: "Desain grafis rapi untuk mulai rutin posting.",
    features: ["12 konten per bulan", "Desain grafis & tipografi (tanpa foto AI)", "Carousel & single post", "Instagram & TikTok", "Revisi lewat chat"],
    cta: "Mulai Newbie",
  },
  {
    name: "Starter",
    price: "Rp149rb",
    period: "/bulan",
    tagline: "Kualitas visual penuh untuk usaha yang mulai serius.",
    features: ["12 konten per bulan", "Foto AI di setiap konten + logo brand", "AI paham brand dari website kamu", "Dicek ulang AI art director", "Meniru referensi desain"],
    cta: "Mulai Starter",
  },
  {
    name: "Growth",
    price: "Rp349rb",
    period: "/bulan",
    tagline: "Kualitas sama dengan Starter, untuk posting tiap hari.",
    features: ["40 konten per bulan", "Semua kualitas visual Starter", "Mode promo & iklan", "Kalender & jadwal otomatis", "Pantau performa"],
    highlight: true,
    cta: "Pilih Growth",
  },
  {
    name: "Agency",
    price: "Rp990rb",
    period: "/bulan",
    tagline: "Kualitas sama, kuota besar untuk agency.",
    features: ["150 konten per bulan", "Semua kualitas visual Starter", "Untuk banyak klien / brand", "Bantuan onboarding", "Prioritas dukungan"],
    cta: "Hubungi kami",
  },
];
