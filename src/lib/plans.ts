import "server-only";
import { accounts, type WorkspaceRepo } from "./db";
import type { Brand, PlanKey } from "./types";

/**
 * Paket & aturannya. Otak AI sama untuk semua paket (Claude Opus 5.5).
 * Bedanya hanya:
 *  - kualitas visual: "basic" (Gratis & Newbie: grafis/tipografi, tanpa foto AI, tanpa cek ulang)
 *    vs "full" (Starter/Growth/Agency: foto AI wajib, logo, paham brand, dicek art director);
 *  - kuota konten.
 */
export interface PlanRule {
  key: PlanKey;
  label: string;
  quality: "basic" | "full";
  quota: number; // jumlah konten
  per: "total" | "month"; // gratis: total seumur akun
  minVisuals: number; // foto/visual AI minimal per konten
  maxVisuals: number;
}

export const PLAN_RULES: Record<PlanKey, PlanRule> = {
  free: { key: "free", label: "Gratis", quality: "basic", quota: 3, per: "total", minVisuals: 0, maxVisuals: 0 },
  newbie: { key: "newbie", label: "Newbie", quality: "basic", quota: 12, per: "month", minVisuals: 0, maxVisuals: 0 },
  starter: { key: "starter", label: "Starter", quality: "full", quota: 12, per: "month", minVisuals: 2, maxVisuals: 4 },
  growth: { key: "growth", label: "Growth", quality: "full", quota: 40, per: "month", minVisuals: 2, maxVisuals: 4 },
  agency: { key: "agency", label: "Agency", quality: "full", quota: 150, per: "month", minVisuals: 2, maxVisuals: 4 },
};
/** Workspace milik admin/owner aplikasi: kualitas penuh tanpa batas. */
const OWNER: PlanRule = { key: "agency", label: "Admin", quality: "full", quota: Infinity, per: "month", minVisuals: 2, maxVisuals: 4 };

export async function planOf(workspaceId: string): Promise<PlanRule> {
  const ws = await accounts().getWorkspace(workspaceId);
  const owner = ws?.owner_id ? await accounts().getUserById(ws.owner_id) : null;
  if (owner?.role === "admin") return OWNER;
  return PLAN_RULES[(ws?.plan as PlanKey) ?? "free"] ?? PLAN_RULES.free;
}

const monthStartWib = () => {
  const ym = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date());
  return `${ym}-01T00:00:00+07:00`;
};

export interface Quota {
  plan: PlanRule;
  used: number;
  left: number;
  ok: boolean;
  message: string;
}

/** Hitung pemakaian kuota konten (konten yang dibuat, termasuk yang ditolak). */
export async function quotaOf(w: WorkspaceRepo): Promise<Quota> {
  const plan = await planOf(w.id);
  // Konten yang dihapus tetap dihitung, supaya kuota tidak bisa "diisi ulang" dengan menghapus.
  const used = await w.countPostsCreated(plan.per === "total" ? undefined : new Date(monthStartWib()).toISOString());
  const left = Math.max(0, plan.quota - used);
  const ok = left > 0;
  const message = ok
    ? ""
    : plan.key === "free"
      ? `Kesempatan coba gratis (${plan.quota} konten) sudah habis. Pilih paket untuk lanjut: Newbie untuk desain grafis, atau Starter ke atas untuk visual foto AI lengkap dengan logo.`
      : `Kuota paket ${plan.label} bulan ini (${plan.quota} konten) sudah habis. Kuota terisi lagi tanggal 1, atau naik paket untuk menambah kuota.`;
  return { plan, used, left, ok, message };
}

/** Brand Kit minimal untuk paket kualitas penuh. */
export function brandGaps(brand: Brand): string[] {
  const gaps: string[] = [];
  if (!brand.logoUrl) gaps.push("logo");
  if (!brand.description.trim() || brand.description.trim().length < 15) gaps.push("deskripsi brand (apa yang dijual / dikerjakan)");
  return gaps;
}

/** Terapkan kualitas paket ke Brand Kit yang dipakai saat membuat konten. */
export function brandForPlan(brand: Brand, plan: PlanRule): Brand {
  if (plan.quality === "basic") {
    // Hanya foto milik brand (gratis); tanpa foto AI & tanpa cek ulang art director.
    return { ...brand, imageSource: brand.imageSource === "none" ? "none" : "brand", autoReview: false };
  }
  return { ...brand, imageSource: brand.imageSource === "none" || brand.imageSource === "brand" ? "auto" : brand.imageSource, autoReview: true };
}

/**
 * Konsep visual sesuai jenis bisnis, supaya foto AI relevan (bukan stok acak).
 * Dipakai di prompt penulisan dan sebagai cadangan prompt gambar.
 */
export function visualConcept(brand: Brand): string {
  const t = `${brand.industry} ${brand.description} ${brand.name}`.toLowerCase();
  const pick = (re: RegExp) => re.test(t);
  if (pick(/\b(ai|saas|software|aplikasi|app|digital|platform|tech|teknologi|startup|marketing tool|otomatis|automation|dashboard)\b/))
    return "Produk digital: mockup aplikasi/dashboard bersih di layar HP atau laptop dipegang orang Indonesia di ruang kerja modern, ilustrasi 3D abstrak bertema AI (node, cahaya lembut, bentuk melayang), suasana produktif. Hindari robot klise.";
  if (pick(/kopi|cafe|kafe|resto|makan|kuliner|food|minum|bakery|kue|snack/))
    return "Kuliner: foto produk makanan/minuman close-up yang menggugah selera, cahaya natural, props meja kayu, tangan menyajikan, suasana outlet.";
  if (pick(/fashion|baju|hijab|pakaian|butik|sepatu|tas|aksesoris/))
    return "Fashion: model Indonesia memakai produk, editorial lookbook, latar warna solid atau street style, detail bahan close-up.";
  if (pick(/skincare|kosmetik|beauty|kecantikan|klinik|salon|spa/))
    return "Kecantikan: produk dengan tekstur & tetesan, kulit glowing close-up, latar pastel bersih, flat lay estetik.";
  if (pick(/properti|rumah|apartemen|real estate|interior/)) return "Properti: interior/eksterior hangat yang terang, keluarga muda, detail ruangan, golden hour.";
  if (pick(/edukasi|kursus|sekolah|les|training|kelas|bimbel/)) return "Edukasi: pelajar/peserta Indonesia belajar dengan antusias, kelas modern, laptop & catatan, momen 'aha'.";
  if (pick(/agency|konsultan|jasa|consulting|b2b/)) return "Jasa profesional: tim Indonesia berdiskusi di kantor modern, presentasi, jabat tangan, whiteboard strategi.";
  return "Foto gaya hidup relevan dengan produk/jasa brand: orang Indonesia menggunakan produk dalam situasi nyata, cahaya natural, komposisi editorial.";
}
