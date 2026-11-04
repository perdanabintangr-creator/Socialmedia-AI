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

export const PLANS: Plan[] = [
  {
    name: "Starter",
    price: "Rp149rb",
    period: "/bulan",
    tagline: "Untuk usaha yang baru mulai rutin posting.",
    features: ["12 konten per bulan", "Carousel & single post", "Instagram & TikTok", "1 brand", "Revisi lewat chat"],
    cta: "Mulai Starter",
  },
  {
    name: "Growth",
    price: "Rp349rb",
    period: "/bulan",
    tagline: "Untuk brand yang ingin tampil konsisten setiap hari.",
    features: ["40 konten per bulan", "Foto & ilustrasi AI", "Review otomatis oleh AI art director", "Kalender & jadwal otomatis", "Prioritas antrean"],
    highlight: true,
    cta: "Pilih Growth",
  },
  {
    name: "Agency",
    price: "Rp990rb",
    period: "/bulan",
    tagline: "Untuk agency & pemilik beberapa brand.",
    features: ["150 konten per bulan", "Hingga 5 brand", "Semua fitur Growth", "Undang anggota tim", "Bantuan onboarding"],
    cta: "Hubungi kami",
  },
];
