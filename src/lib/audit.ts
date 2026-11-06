import "server-only";
import sharp from "sharp";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { WorkspaceRepo } from "./db";
import { callStructured, brandSystemPrompt } from "./ai";
import { config } from "./config";
import { readMedia } from "./media";
import { compact, engagementOf } from "./insights";
import { VISUAL_STYLE_KEYS, type AccountAudit, type Brand } from "./types";

/**
 * Audit akun ala konsultan social media: baca profil IG/TikTok (link + screenshot), data
 * performa dari menu Performa, dan Brand Kit → skor per area, masalah + solusi, bio baru,
 * rencana aksi, ide konten, dan rekomendasi Brand Kit.
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

type Profile = AccountAudit["profile"][number];

/** Ambil @handle & platform dari link profil. */
export function parseProfile(raw: string): { platform: "instagram" | "tiktok"; handle: string } | null {
  const v = raw.trim();
  const tt = /tiktok\.com\/@([A-Za-z0-9._]+)/i.exec(v);
  if (tt) return { platform: "tiktok", handle: tt[1] };
  const ig = /instagram\.com\/([A-Za-z0-9._]+)/i.exec(v);
  if (ig && !["p", "reel", "reels", "stories", "explore"].includes(ig[1].toLowerCase())) return { platform: "instagram", handle: ig[1] };
  const at = /^@([A-Za-z0-9._]+)$/.exec(v);
  if (at) return { platform: "instagram", handle: at[1] };
  return null;
}

/** Coba baca statistik profil TikTok langsung (sering diblokir; gagal = pakai screenshot). */
async function readTikTokProfile(handle: string): Promise<Profile | null> {
  try {
    const res = await fetch(`https://www.tiktok.com/@${handle}`, { headers: { "User-Agent": UA, "Accept-Language": "id-ID,id;q=0.9" }, signal: AbortSignal.timeout(12_000) });
    const html = await res.text();
    const m = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return null;
    const data = JSON.parse(m[1]) as { __DEFAULT_SCOPE__?: Record<string, { userInfo?: { user?: { signature?: string }; stats?: Record<string, number> } }> };
    const info = data.__DEFAULT_SCOPE__?.["webapp.user-detail"]?.userInfo;
    if (!info?.stats) return null;
    return { platform: "tiktok", handle, followers: info.stats.followerCount, likes: info.stats.heartCount, posts: info.stats.videoCount, bio: info.user?.signature };
  } catch {
    return null;
  }
}

/** Instagram hanya bisa dibaca lewat Apify (bila APIFY_TOKEN di-set). */
async function readInstagramProfile(handle: string): Promise<Profile | null> {
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) return null;
  try {
    const res = await fetch("https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?timeout=60", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [handle] }),
      signal: AbortSignal.timeout(70_000),
    });
    const [it] = ((await res.json().catch(() => [])) as Record<string, unknown>[]) ?? [];
    if (!it) return null;
    return {
      platform: "instagram",
      handle,
      followers: Number(it.followersCount) || undefined,
      posts: Number(it.postsCount) || undefined,
      bio: typeof it.biography === "string" ? it.biography : undefined,
    };
  } catch {
    return null;
  }
}

const AuditSchema = z.object({
  overall: z.number().describe("Skor kesehatan akun 0-100"),
  verdict: z.string().describe("Kesimpulan konsultan 1-2 kalimat, jujur dan spesifik"),
  scores: z
    .array(z.object({ area: z.string(), score: z.number().describe("0-100"), note: z.string().describe("1 kalimat alasan skor") }))
    .describe("Tepat 7 area: Profil & bio, Konsistensi visual feed, Strategi & pilar konten, Hook & copywriting, Kualitas desain, Konsistensi posting, Engagement & komunitas"),
  strengths: z.array(z.string()).describe("2-4 kekuatan yang perlu dipertahankan"),
  problems: z.array(z.object({ title: z.string(), why: z.string().describe("Kenapa ini menghambat pertumbuhan"), fix: z.string().describe("Langkah perbaikan konkret") })).describe("3-6 masalah terpenting, urut dari dampak terbesar"),
  bio: z.string().describe("Usulan bio baru maks 150 karakter: siapa/apa, untuk siapa, nilai utama, ajakan/CTA"),
  actions: z.array(z.object({ when: z.enum(["Minggu ini", "Bulan ini", "3 bulan"]), action: z.string() })).describe("5-8 langkah aksi berprioritas"),
  ideas: z
    .array(z.object({ title: z.string(), hook: z.string(), format: z.enum(["single", "carousel"]), pillar: z.string(), why: z.string().describe("Kenapa ide ini cocok untuk akun ini") }))
    .describe("6 ide konten yang paling berpotensi untuk akun ini"),
  posting: z.object({ perWeek: z.number().describe("Frekuensi ideal per minggu"), bestTimes: z.string().describe("Jam tayang yang disarankan (WIB) + alasan singkat") }),
  brandUpdates: z.object({
    description: z.string().describe("Tentang brand/produk 2-3 kalimat, disimpulkan dari bio, post, dan screenshot. Kosongkan bila tidak jelas"),
    audience: z.string().describe("Target audiens yang terlihat dari konten & komentar, 1 kalimat. Kosongkan bila tidak jelas"),
    industry: z.string().describe("Bidang usaha singkat, mis. 'Kedai kopi', 'Skincare lokal'. Kosongkan bila tidak jelas"),
    tone: z.string().describe("Gaya bahasa yang disarankan, 1 kalimat"),
    pillars: z.array(z.string()).describe("4-5 pilar konten yang disarankan"),
    imageStyle: z.string().describe("Art direction foto/visual yang disarankan, 1-2 kalimat"),
    styleNotes: z.string().describe("Catatan gaya desain feed yang disarankan (layout, warna, tipografi, kepadatan teks)"),
    doDont: z.string().describe("Hal yang wajib & dilarang, singkat"),
    visualStyle: z.enum(["auto", ...VISUAL_STYLE_KEYS] as [string, ...string[]]).describe("Arah visual yang paling cocok"),
  }),
  insights: z.string().describe("Ringkasan wawasan untuk tim kreatif AI (maks 120 kata): apa yang harus diperbanyak, dihindari, dan gaya yang paling efektif untuk akun ini"),
});

async function screenshotBlocks(urls: string[]): Promise<Anthropic.Beta.BetaContentBlockParam[]> {
  const out: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const [i, url] of urls.slice(0, 6).entries()) {
    try {
      const data = (await sharp(await readMedia(url)).resize(1000, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer()).toString("base64");
      out.push({ type: "text", text: `Screenshot ${i + 1}:` });
      out.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
    } catch {
      // lewati gambar yang tidak terbaca
    }
  }
  return out;
}

function demoAudit(brand: Brand, base: Pick<AccountAudit, "createdAt" | "links" | "screenshots" | "goal" | "profile">): AccountAudit {
  return {
    ...base,
    overall: 58,
    verdict: "[DEMO] Akun punya potensi, tapi feed belum konsisten dan hook masih umum.",
    scores: ["Profil & bio", "Konsistensi visual feed", "Strategi & pilar konten", "Hook & copywriting", "Kualitas desain", "Konsistensi posting", "Engagement & komunitas"].map((area, i) => ({
      area,
      score: [62, 48, 55, 50, 60, 45, 52][i],
      note: "Contoh penilaian mode demo.",
    })),
    strengths: ["Logo & warna brand mudah dikenali", "Topik relevan dengan audiens"],
    problems: [
      { title: "Hook cover terlalu umum", why: "Orang tidak berhenti scroll.", fix: "Pakai angka spesifik atau masalah yang dikenali audiens di cover." },
      { title: "Jadwal posting tidak konsisten", why: "Algoritma & audiens kehilangan ritme.", fix: "Posting 3x seminggu di jam yang sama lewat Mode ACC." },
    ],
    bio: `${brand.name} — bantu kamu ${brand.industry || "tumbuh"} lebih cepat. Cek link 👇`,
    actions: [
      { when: "Minggu ini", action: "Ganti bio dengan usulan baru" },
      { when: "Bulan ini", action: "Jalankan rencana 12 konten di Mode ACC" },
    ],
    ideas: [
      { title: "3 kesalahan yang bikin konten sepi", hook: "Konten rame tapi nggak ada yang beli?", format: "carousel", pillar: brand.pillars[0] ?? "Edukasi", why: "Masalah yang dikenali audiens." },
      { title: "Behind the scenes tim", hook: "Ini yang terjadi sebelum produk sampai ke kamu", format: "carousel", pillar: "Behind the scenes", why: "Membangun kepercayaan." },
    ],
    posting: { perWeek: 3, bestTimes: "19.00–21.00 WIB (jam santai setelah kerja)" },
    brandUpdates: { description: brand.description, audience: brand.audience, industry: brand.industry, tone: brand.tone, pillars: brand.pillars, imageStyle: brand.imageStyle, styleNotes: brand.styleNotes, doDont: brand.doDont, visualStyle: "brand" },
    insights: "[DEMO] Perbanyak carousel edukasi dengan hook angka spesifik; hindari cover penuh teks.",
    appliedAt: null,
  };
}

/** Jalankan audit. Mengembalikan hasil audit (belum diterapkan ke Brand Kit). */
export async function auditAccount(w: WorkspaceRepo, opts: { links: string[]; screenshots: string[]; goal: string }): Promise<AccountAudit> {
  const brand = await w.getBrand();
  const parsed = opts.links.map(parseProfile).filter((p): p is NonNullable<ReturnType<typeof parseProfile>> => Boolean(p));
  const profile: Profile[] = [];
  for (const p of parsed.slice(0, 2)) {
    const read = p.platform === "tiktok" ? await readTikTokProfile(p.handle) : await readInstagramProfile(p.handle);
    profile.push(read ?? { platform: p.platform, handle: p.handle });
  }
  const base = { createdAt: new Date().toISOString(), links: opts.links, screenshots: opts.screenshots, goal: opts.goal, profile };
  if (!config.hasAI) return demoAudit(brand, base);

  // Data performa nyata dari menu Performa (bila ada).
  const links = (await w.listLinks()).filter((l) => l.metrics);
  const perf = links
    .map((l) => ({ l, e: engagementOf(l.metrics) }))
    .sort((a, b) => b.e - a.e)
    .slice(0, 12)
    .map(({ l, e }) => `- ${l.platform} "${(l.title ?? "").slice(0, 80)}": ${compact(l.metrics?.views)} views, ${compact(l.metrics?.likes)} likes, ${compact(l.metrics?.comments)} komentar, engagement ${compact(e)}`)
    .join("\n");
  const posts = (await w.listPosts()).slice(0, 15).map((p) => `- ${p.title} (${p.format}, ${p.status})`).join("\n");

  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...(await screenshotBlocks(opts.screenshots)),
    {
      type: "text",
      text: `Kamu sekarang berperan sebagai KONSULTAN social media senior (strategist + copywriter + art director) yang sedang mengaudit akun klien. Jujur, spesifik, dan bisa langsung dieksekusi — bukan nasihat umum.

Tujuan klien: ${opts.goal || "tumbuh followers yang relevan dan mendatangkan pelanggan"}
Profil yang diaudit: ${profile.length ? profile.map((p) => `${p.platform} @${p.handle}${p.followers ? ` · ${p.followers} followers` : ""}${p.likes ? ` · ${p.likes} likes` : ""}${p.posts ? ` · ${p.posts} post` : ""}${p.bio ? ` · bio: "${p.bio}"` : ""}`).join(" | ") : "(tidak ada link — nilai dari screenshot)"}
${opts.screenshots.length ? `Ada ${opts.screenshots.length} screenshot di atas (grid feed, bio, insight, atau post). Baca detailnya dengan teliti: tampilan grid, konsistensi warna & tipografi, kualitas cover, panjang teks, hook, jumlah like/komentar/views yang terlihat.` : "Tidak ada screenshot: nilai berdasarkan data yang ada dan sebutkan bahwa penilaian visual terbatas."}

Data performa post (dari link yang dipantau):
${perf || "(belum ada)"}

Konten yang pernah dibuat di aplikasi:
${posts || "(belum ada)"}

Berikan audit lengkap sesuai skema. Skor harus jujur (jangan semua tinggi). Masalah diurutkan dari dampak terbesar, solusinya konkret (apa yang diubah, contohnya seperti apa). Ide konten harus spesifik untuk akun ini dan memakai rumus hook yang kuat.`,
    },
  ];
  const out = await callStructured(brandSystemPrompt(brand), content, AuditSchema);
  return {
    ...base,
    ...out,
    overall: Math.round(Math.max(0, Math.min(100, out.overall))),
    scores: out.scores.map((s) => ({ ...s, score: Math.round(Math.max(0, Math.min(100, s.score))) })),
    appliedAt: null,
  };
}

/** Terapkan rekomendasi audit ke Brand Kit + simpan wawasan untuk otak AI. */
export function applyAudit(brand: Brand, audit: AccountAudit): Brand {
  const u = audit.brandUpdates;
  const handle = audit.profile[0]?.handle;
  return {
    ...brand,
    // Data dasar hanya diisi bila Brand Kit masih kosong (tidak menimpa isian owner).
    description: brand.description.trim() ? brand.description : u.description || brand.description,
    audience: brand.audience.trim() ? brand.audience : u.audience || brand.audience,
    industry: brand.industry.trim() ? brand.industry : u.industry || brand.industry,
    handle: brand.handle.trim() ? brand.handle : handle ? `@${handle}` : brand.handle,
    tone: u.tone || brand.tone,
    pillars: u.pillars.length ? u.pillars.slice(0, 5) : brand.pillars,
    imageStyle: u.imageStyle || brand.imageStyle,
    styleNotes: u.styleNotes || brand.styleNotes,
    doDont: u.doDont || brand.doDont,
    visualStyle: (u.visualStyle as Brand["visualStyle"]) || brand.visualStyle,
    insights: audit.insights,
    audit: { ...audit, appliedAt: new Date().toISOString() },
  };
}
