import "server-only";
import sharp from "sharp";
import { z } from "zod";
import { config } from "./config";
import { callStructured } from "./ai";
import { paletteOf } from "./reference";
import type { WorkspaceRepo } from "./db";
import { DEFAULT_BRAND, type Brand } from "./types";

/**
 * "Isi otomatis dari website": baca halaman depan website brand, ambil logo, judul, deskripsi,
 * dan teksnya; Claude merangkum jadi Brand Kit (deskripsi, bidang usaha, audiens, gaya bahasa,
 * pilar konten, CTA). Hanya mengisi kolom yang masih kosong / bawaan, kecuali logo yang belum ada.
 */

const UA = "Mozilla/5.0 (compatible; SosmedAutopilotBot/1.0; +https://socialmedia-ai-puce.vercel.app)";

const attr = (tag: string, name: string) => new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag)?.[1] ?? null;
const metaContent = (html: string, key: string) => {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const k = attr(tag, "property") ?? attr(tag, "name");
    if (k?.toLowerCase() === key) return attr(tag, "content");
  }
  return null;
};
const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

export interface SiteInfo {
  url: string;
  title: string;
  description: string;
  siteName: string;
  themeColor: string | null;
  text: string;
  logoCandidates: string[];
}

export async function readWebsite(raw: string): Promise<SiteInfo> {
  const url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)) throw new Error("Alamat website tidak valid");
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new Error(`Website ${url.hostname} tidak bisa dibuka. Pastikan alamatnya benar dan bisa diakses publik.`);
  }
  if (!res.ok) throw new Error(`Website ${url.hostname} menolak dibaca (HTTP ${res.status}). Isi Brand Kit manual di bawah ya.`);
  const html = (await res.text()).slice(0, 1_500_000);
  const base = res.url || url.toString();
  const abs = (u: string | null) => {
    if (!u || u.startsWith("data:")) return null;
    try {
      return new URL(u, base).toString();
    } catch {
      return null;
    }
  };

  const logos: string[] = [];
  // 1. JSON-LD Organization.logo
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    const l = /"logo"\s*:\s*(?:\{[^}]*"url"\s*:\s*)?"([^"]+)"/.exec(m[1])?.[1];
    if (l) logos.push(abs(l)!);
  }
  // 2. <img> yang jelas logo
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const hint = `${attr(tag, "src") ?? ""} ${attr(tag, "alt") ?? ""} ${attr(tag, "class") ?? ""} ${attr(tag, "id") ?? ""}`.toLowerCase();
    if (/logo/.test(hint)) logos.push(abs(attr(tag, "src") ?? attr(tag, "data-src"))!);
  }
  // 3. ikon situs (apple-touch-icon lebih tajam dari favicon)
  const icons = (html.match(/<link\b[^>]*>/gi) ?? [])
    .filter((t) => /rel\s*=\s*["'][^"']*icon/i.test(t))
    .map((t) => ({ href: abs(attr(t, "href")), apple: /apple-touch-icon/i.test(t), size: Number(/(\d+)x\d+/.exec(attr(t, "sizes") ?? "")?.[1] ?? 0) }))
    .sort((a, b) => Number(b.apple) - Number(a.apple) || b.size - a.size);
  logos.push(...icons.map((i) => i.href!).filter(Boolean));

  const text = decode(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|h[1-6]|li|div|section)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, 6000);

  return {
    url: base,
    title: decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? ""),
    description: decode(metaContent(html, "og:description") ?? metaContent(html, "description") ?? ""),
    siteName: decode(metaContent(html, "og:site_name") ?? ""),
    themeColor: metaContent(html, "theme-color"),
    text,
    logoCandidates: [...new Set(logos.filter(Boolean))].slice(0, 8),
  };
}

/** Unduh kandidat logo pertama yang layak (≥ 48 px), simpan sebagai PNG. */
async function fetchLogo(w: WorkspaceRepo, candidates: string[]): Promise<string | null> {
  for (const src of candidates) {
    try {
      const res = await fetch(src, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const isSvg = /svg/.test(res.headers.get("content-type") ?? "") || src.toLowerCase().endsWith(".svg");
      const img = sharp(buf, isSvg ? { density: 300 } : {});
      const meta = await img.metadata();
      if ((meta.width ?? 0) < 48 || (meta.height ?? 0) < 48) continue;
      const png = await img.resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true }).png().toBuffer();
      return await w.uploadFile(`logos/website-${Date.now()}.png`, png, "image/png");
    } catch {
      // coba kandidat berikutnya
    }
  }
  return null;
}

const BrandSchema = z.object({
  description: z.string().describe("Tentang brand/produk dalam 2-4 kalimat: apa yang dijual, untuk siapa, keunggulan utama. Bahasa Indonesia"),
  industry: z.string().describe("Bidang usaha singkat, mis. 'Software AI untuk marketing', 'Kedai kopi'"),
  audience: z.string().describe("Target audiens spesifik"),
  tone: z.string().describe("Gaya bahasa yang cocok untuk brand ini, 1 kalimat"),
  pillars: z.array(z.string()).describe("4-5 pilar konten sosial media yang relevan"),
  cta: z.string().describe("Ajakan default yang cocok, mis. 'Coba gratis di marqthink.com'"),
  hashtags: z.array(z.string()).describe("3-5 hashtag brand/niche tanpa #"),
  imageStyle: z.string().describe("Art direction foto/visual yang cocok untuk brand ini, 1-2 kalimat"),
});

const isDefault = <K extends keyof Brand>(brand: Brand, k: K) => JSON.stringify(brand[k]) === JSON.stringify(DEFAULT_BRAND[k]) || !brand[k] || (Array.isArray(brand[k]) && !(brand[k] as unknown[]).length);

export async function importBrandFromWebsite(w: WorkspaceRepo, brand: Brand, raw: string): Promise<{ brand: Brand; filled: string[] }> {
  const site = await readWebsite(raw);
  const next: Brand = { ...brand, website: brand.website || new URL(site.url).hostname.replace(/^www\./, "") };
  const filled: string[] = [];

  if (!brand.logoUrl) {
    const logo = await fetchLogo(w, site.logoCandidates);
    if (logo) {
      next.logoUrl = logo;
      filled.push("logo");
      // Warna dari logo bila warna brand masih bawaan
      if (JSON.stringify(brand.colors) === JSON.stringify(DEFAULT_BRAND.colors)) {
        try {
          const sw = (await paletteOf([Buffer.from(await (await fetch(logo)).arrayBuffer())])).filter((c) => c.lum > 0.02 && c.lum < 0.9 && c.sat > 0.25);
          if (sw[0]) {
            next.colors = { ...next.colors, primary: sw[0].hex, secondary: sw[1]?.hex ?? next.colors.secondary, accent: sw[2]?.hex ?? next.colors.accent };
            filled.push("warna");
          }
        } catch {
          // warna tetap bawaan
        }
      }
    }
  }

  if (config.hasAI && site.text.length > 80) {
    const out = await callStructured(
      "Kamu brand strategist untuk social media agency di Indonesia. Rangkum website klien menjadi Brand Kit yang akurat. Jangan mengarang fakta yang tidak ada di website.",
      `Website: ${site.url}\nJudul: ${site.title}\nNama situs: ${site.siteName}\nDeskripsi meta: ${site.description}\n\nIsi halaman:\n${site.text}`,
      BrandSchema,
      "low",
    );
    const set = <K extends keyof Brand>(k: K, v: Brand[K], label: string) => {
      if (isDefault(brand, k) && v && (!Array.isArray(v) || v.length)) {
        next[k] = v;
        filled.push(label);
      }
    };
    set("description", out.description, "deskripsi");
    set("industry", out.industry, "bidang usaha");
    set("audience", out.audience, "audiens");
    set("tone", out.tone, "gaya bahasa");
    set("pillars", out.pillars.slice(0, 5), "pilar konten");
    set("cta", out.cta, "CTA");
    set("hashtags", out.hashtags.map((h) => h.replace(/^#/, "")).slice(0, 5), "hashtag");
    set("imageStyle", out.imageStyle, "gaya foto");
  } else if (!brand.description && (site.description || site.title)) {
    next.description = [site.title, site.description].filter(Boolean).join(" — ");
    filled.push("deskripsi");
  }
  return { brand: next, filled };
}
