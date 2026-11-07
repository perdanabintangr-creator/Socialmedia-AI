"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { workspaceOrThrow } from "@/lib/session";
import { TEMPLATE_KEYS, type TemplateKey } from "@/lib/types";

const HEX = /^#[0-9a-fA-F]{6}$/;
const toHex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

/** Ambil warna dominan dari logo (abaikan transparan, putih, dan abu-abu pucat). */
async function extractPalette(buf: Buffer): Promise<string[]> {
  const { data, info } = await sharp(buf).resize(64, 64, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 128) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (min > 235) continue; // hampir putih
    if (max - min < 18 && max > 70 && max < 200) continue; // abu-abu
    const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += r;
    e.g += g;
    e.b += b;
    buckets.set(key, e);
  }
  const sorted = [...buckets.values()].sort((x, y) => y.n - x.n).map((e) => [e.r / e.n, e.g / e.n, e.b / e.n].map(Math.round) as [number, number, number]);
  const picked: [number, number, number][] = [];
  for (const c of sorted) {
    if (picked.every((p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) > 60)) picked.push(c);
    if (picked.length === 5) break;
  }
  return picked.map((c) => toHex(...c));
}

export async function uploadLogoAction(fd: FormData): Promise<{ url?: string; palette?: string[]; error?: string }> {
  try {
    const { w } = await workspaceOrThrow();
    const file = fd.get("logo");
    if (!(file instanceof File) || !file.size) return { error: "Pilih file logo" };
    if (!file.type.startsWith("image/")) return { error: "File harus berupa gambar" };
    if (file.size > 8 * 1024 * 1024) return { error: "Ukuran logo maksimal 8 MB" };
    const raw = Buffer.from(await file.arrayBuffer());
    const png = await sharp(raw, file.type === "image/svg+xml" ? { density: 300 } : {}).png().toBuffer();
    const url = await w.uploadFile(`brand/${Date.now()}-logo.png`, png, "image/png");
    return { url, palette: await extractPalette(png) };
  } catch (e) {
    console.error(e);
    return { error: "Logo gagal diproses. Coba file PNG atau JPG." };
  }
}

export interface OnboardingInput {
  name: string;
  industry: string;
  description: string;
  handle: string;
  audience: string;
  goals: string[];
  tone: string;
  logoUrl: string | null;
  colors: { primary: string; accent: string };
  template: TemplateKey;
  socialRequested: boolean;
}

const GOAL_PILLARS: Record<string, string> = {
  "Dikenal lebih luas": "Cerita & nilai brand",
  "Jualan": "Produk & promo",
  "Edukasi": "Edukasi & tips praktis",
  "Bangun kepercayaan": "Behind the scenes & proses",
  "Komunitas": "Interaksi & komunitas",
};

export async function completeOnboardingAction(input: OnboardingInput): Promise<{ error?: string }> {
  const { w } = await workspaceOrThrow();
  const name = input.name.trim().slice(0, 80);
  if (name.length < 2) return { error: "Isi nama brand dulu" };
  const brand = await w.getBrand();
  const pillars = input.goals.map((g) => GOAL_PILLARS[g]).filter(Boolean);
  const primary = HEX.test(input.colors.primary) ? input.colors.primary : brand.colors.primary;
  const accent = HEX.test(input.colors.accent) ? input.colors.accent : brand.colors.accent;
  await w.saveBrand({
    ...brand,
    name,
    industry: input.industry.slice(0, 60),
    description: input.description.trim().slice(0, 1500),
    handle: input.handle.trim() ? "@" + input.handle.trim().replace(/^@+/, "").slice(0, 40) : "",
    audience: input.audience.trim().slice(0, 600),
    goals: input.goals.slice(0, 6),
    tone: input.tone.slice(0, 300) || brand.tone,
    pillars: pillars.length ? pillars : brand.pillars,
    logoUrl: input.logoUrl ?? brand.logoUrl,
    colors: { ...brand.colors, primary, accent, secondary: primary },
    defaultTemplate: (TEMPLATE_KEYS as readonly string[]).includes(input.template) ? input.template : brand.defaultTemplate,
    socialRequested: input.socialRequested,
    onboarded: true,
  });
  revalidatePath("/", "layout");
  redirect("/beranda");
}

/** Customer minta tim kami membantu menghubungkan Instagram/TikTok. */
export async function requestSocialAction(): Promise<{ ok?: string; error?: string }> {
  const { w } = await workspaceOrThrow();
  const brand = await w.getBrand();
  await w.saveBrand({ ...brand, socialRequested: true });
  revalidatePath("/", "layout");
  return { ok: "Permintaan terkirim. Tim kami akan memandu kamu." };
}

/** Putuskan akun Instagram dari workspace (konten terjadwal kembali menunggu sampai terhubung lagi). */
export async function disconnectInstagramAction(): Promise<{ ok?: string; error?: string }> {
  try {
    const { w } = await workspaceOrThrow();
    await w.deleteSocial("instagram");
    revalidatePath("/", "layout");
    return { ok: "Instagram diputus. Konten tidak akan diposting otomatis sampai dihubungkan lagi." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal memutus" };
  }
}
