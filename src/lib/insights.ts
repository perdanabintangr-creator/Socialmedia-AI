import "server-only";
import sharp from "sharp";
import { config } from "./config";
import type { WorkspaceRepo } from "./db";
import type { InsightKind, InsightMetrics, InsightPlatform, TrackedLink } from "./types";

/**
 * Performa: baca angka (views, likes, komentar, share, followers) cukup dari link publik.
 *
 * - TikTok: halaman publik memuat data JSON lengkap → dibaca langsung, gratis.
 * - Instagram: memblokir pembacaan dari server, jadi lewat konektor scraper (Apify)
 *   bila APIFY_TOKEN di-set. Tanpa itu link tetap tersimpan dan menunggu.
 * Apify juga dipakai sebagai cadangan TikTok kalau pembacaan langsung diblokir.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export interface ParsedLink {
  platform: InsightPlatform;
  kind: InsightKind;
  url: string; // bentuk baku, dipakai sebagai kunci unik
  handle: string | null;
}

export class InsightError extends Error {
  constructor(
    message: string,
    readonly code: "invalid" | "not_found" | "blocked" | "needs_connector",
  ) {
    super(message);
  }
}

const IG_RESERVED = new Set(["p", "reel", "reels", "tv", "stories", "explore", "accounts", "direct", "about", "developer", "legal", "web"]);

/** Kenali link TikTok / Instagram (postingan, reels, video, foto, atau profil). Tanpa jaringan. */
export function parseLink(raw: string): ParsedLink | null {
  let u: URL;
  try {
    const s = raw.trim();
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m|vm|vt)\./, "").toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);

  if (host === "tiktok.com") {
    const user = parts[0]?.startsWith("@") ? parts[0].slice(1) : null;
    // Link pendek kadang terbuka sebagai /@/video/<id> (tanpa nama akun): tetap sah.
    if (user !== null && (parts[1] === "video" || parts[1] === "photo") && /^\d+$/.test(parts[2] ?? "")) {
      return { platform: "tiktok", kind: "post", url: `https://www.tiktok.com/@${user}/${parts[1]}/${parts[2]}`, handle: user || null };
    }
    if (user && parts.length === 1) return { platform: "tiktok", kind: "profile", url: `https://www.tiktok.com/@${user}`, handle: user };
    return null;
  }
  if (host === "instagram.com" || host === "instagr.am") {
    if (["p", "reel", "reels", "tv"].includes(parts[0] ?? "") && parts[1]) {
      const type = parts[0] === "reels" ? "reel" : parts[0];
      return { platform: "instagram", kind: "post", url: `https://www.instagram.com/${type}/${parts[1]}/`, handle: null };
    }
    // instagram.com/<user>/p/<kode>/ juga bentuk yang sah
    if (parts.length >= 3 && ["p", "reel"].includes(parts[1])) {
      return { platform: "instagram", kind: "post", url: `https://www.instagram.com/${parts[1]}/${parts[2]}/`, handle: parts[0] };
    }
    if (parts.length === 1 && /^[A-Za-z0-9._]{1,30}$/.test(parts[0]) && !IG_RESERVED.has(parts[0].toLowerCase())) {
      return { platform: "instagram", kind: "profile", url: `https://www.instagram.com/${parts[0]}/`, handle: parts[0] };
    }
  }
  return null;
}

const isShortTikTok = (raw: string) => /^(https?:\/\/)?(vm|vt)\.tiktok\.com\/|^(https?:\/\/)?(www\.)?tiktok\.com\/t\//i.test(raw.trim());

/** Seperti parseLink, tapi juga membuka link pendek TikTok (vm.tiktok.com/…). */
export async function resolveLink(raw: string): Promise<ParsedLink | null> {
  const direct = parseLink(raw);
  if (direct || !isShortTikTok(raw)) return direct;
  try {
    const url = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
    const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10_000) });
    return parseLink(res.url);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- pembaca

interface Reading {
  metrics: InsightMetrics;
  title: string | null;
  handle: string | null;
  image: string | null; // URL gambar sumber (akan disalin ke storage kita)
}

const num = (...vals: unknown[]): number | undefined => {
  let best: number | undefined;
  for (const v of vals) {
    const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
    if (Number.isFinite(n) && n >= 0) best = best === undefined ? n : Math.max(best, n);
  }
  return best;
};

function clean(m: InsightMetrics): InsightMetrics {
  return Object.fromEntries(Object.entries(m).filter(([, v]) => typeof v === "number")) as InsightMetrics;
}

async function readTikTokDirect(p: ParsedLink): Promise<Reading> {
  const res = await fetch(p.url, {
    headers: { "User-Agent": UA, "Accept-Language": "id-ID,id;q=0.9,en;q=0.8" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (res.status === 404) throw new InsightError("Tidak ditemukan. Mungkin sudah dihapus atau akunnya privat.", "not_found");
  if (!res.ok) throw new InsightError("TikTok sedang membatasi akses. Kami coba lagi nanti.", "blocked");
  const html = await res.text();
  const m = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new InsightError("TikTok sedang membatasi akses. Kami coba lagi nanti.", "blocked");
  const scope = (JSON.parse(m[1]) as { __DEFAULT_SCOPE__?: Record<string, Record<string, unknown>> }).__DEFAULT_SCOPE__ ?? {};

  if (p.kind === "post") {
    const detail = scope["webapp.video-detail"] as
      | { statusCode?: number; itemInfo?: { itemStruct?: Record<string, unknown> } }
      | undefined;
    const item = detail?.itemInfo?.itemStruct;
    if (!item) throw new InsightError("Video tidak ditemukan atau akunnya privat.", "not_found");
    const s = (item.stats ?? {}) as Record<string, unknown>;
    const s2 = (item.statsV2 ?? {}) as Record<string, unknown>;
    const video = (item.video ?? {}) as Record<string, unknown>;
    const author = (item.author ?? {}) as Record<string, unknown>;
    const imgs = ((item.imagePost as { images?: { imageURL?: { urlList?: string[] } }[] } | undefined)?.images ?? [])[0]?.imageURL?.urlList;
    return {
      metrics: clean({
        views: num(s.playCount, s2.playCount),
        likes: num(s.diggCount, s2.diggCount),
        comments: num(s.commentCount, s2.commentCount),
        shares: num(s.shareCount, s2.shareCount),
        saves: num(s.collectCount, s2.collectCount),
      }),
      title: typeof item.desc === "string" && item.desc.trim() ? item.desc.trim().slice(0, 200) : null,
      handle: typeof author.uniqueId === "string" ? author.uniqueId : p.handle,
      image: (imgs?.[0] ?? (video.cover as string) ?? (video.originCover as string) ?? null) || null,
    };
  }

  const info = (scope["webapp.user-detail"] as { userInfo?: { user?: Record<string, unknown>; stats?: Record<string, unknown>; statsV2?: Record<string, unknown> } } | undefined)
    ?.userInfo;
  if (!info?.user) throw new InsightError("Akun tidak ditemukan.", "not_found");
  const s = info.stats ?? {};
  const s2 = info.statsV2 ?? {};
  return {
    metrics: clean({
      followers: num(s.followerCount, s2.followerCount),
      following: num(s.followingCount, s2.followingCount),
      totalLikes: num(s.heartCount, s.heart, s2.heartCount, s2.heart),
      posts: num(s.videoCount, s2.videoCount),
    }),
    title: typeof info.user.nickname === "string" ? info.user.nickname : null,
    handle: typeof info.user.uniqueId === "string" ? info.user.uniqueId : p.handle,
    image: ((info.user.avatarLarger ?? info.user.avatarMedium ?? info.user.avatarThumb) as string) || null,
  };
}

async function apify<T>(actor: string, input: unknown): Promise<T[]> {
  const res = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?timeout=90`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.APIFY_TOKEN?.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(110_000),
    cache: "no-store",
  });
  if (!res.ok) throw new InsightError("Konektor pembaca sedang bermasalah. Kami coba lagi nanti.", "blocked");
  const data = (await res.json().catch(() => [])) as T[];
  return Array.isArray(data) ? data : [];
}

async function readInstagram(p: ParsedLink): Promise<Reading> {
  if (!config.hasApify) {
    throw new InsightError("Pembacaan Instagram sedang disiapkan tim kami. Link sudah tersimpan dan akan terbaca otomatis.", "needs_connector");
  }
  if (p.kind === "post") {
    const [it] = await apify<Record<string, unknown>>("apify~instagram-scraper", {
      directUrls: [p.url],
      resultsType: "posts",
      resultsLimit: 1,
      addParentData: false,
    });
    if (!it || it.error) throw new InsightError("Postingan tidak ditemukan atau akunnya privat.", "not_found");
    const likes = num(it.likesCount);
    return {
      metrics: clean({
        views: num(it.videoPlayCount, it.videoViewCount),
        likes: likes, // -1 (disembunyikan) otomatis dibuang oleh num()
        comments: num(it.commentsCount),
      }),
      title: typeof it.caption === "string" && it.caption.trim() ? it.caption.trim().slice(0, 200) : null,
      handle: typeof it.ownerUsername === "string" ? it.ownerUsername : p.handle,
      image: (it.displayUrl as string) || null,
    };
  }
  const [it] = await apify<Record<string, unknown>>("apify~instagram-scraper", {
    directUrls: [p.url],
    resultsType: "details",
    resultsLimit: 1,
  });
  if (!it || it.error || it.followersCount === undefined) throw new InsightError("Akun tidak ditemukan atau privat.", "not_found");
  return {
    metrics: clean({ followers: num(it.followersCount), following: num(it.followsCount), posts: num(it.postsCount) }),
    title: typeof it.fullName === "string" && it.fullName ? it.fullName : null,
    handle: typeof it.username === "string" ? it.username : p.handle,
    image: ((it.profilePicUrlHD ?? it.profilePicUrl) as string) || null,
  };
}

async function readTikTokApify(p: ParsedLink): Promise<Reading> {
  const input = p.kind === "post" ? { postURLs: [p.url], resultsPerPage: 1 } : { profiles: [p.handle], resultsPerPage: 1 };
  const [it] = await apify<Record<string, unknown>>("clockworks~tiktok-scraper", input);
  if (!it) throw new InsightError("Tidak ditemukan. Mungkin sudah dihapus atau akunnya privat.", "not_found");
  const a = (it.authorMeta ?? {}) as Record<string, unknown>;
  if (p.kind === "profile") {
    return {
      metrics: clean({ followers: num(a.fans), following: num(a.following), totalLikes: num(a.heart), posts: num(a.video) }),
      title: (a.nickName as string) || null,
      handle: (a.name as string) || p.handle,
      image: (a.avatar as string) || null,
    };
  }
  return {
    metrics: clean({
      views: num(it.playCount),
      likes: num(it.diggCount),
      comments: num(it.commentCount),
      shares: num(it.shareCount),
      saves: num(it.collectCount),
    }),
    title: typeof it.text === "string" && it.text.trim() ? it.text.trim().slice(0, 200) : null,
    handle: (a.name as string) || p.handle,
    image: ((it.videoMeta as Record<string, unknown> | undefined)?.coverUrl as string) || null,
  };
}

export async function readLink(p: ParsedLink): Promise<Reading> {
  if (p.platform === "instagram") return readInstagram(p);
  try {
    return await readTikTokDirect(p);
  } catch (e) {
    if (e instanceof InsightError && e.code === "blocked" && config.hasApify) return readTikTokApify(p);
    if (e instanceof InsightError) throw e;
    throw new InsightError("TikTok sedang membatasi akses. Kami coba lagi nanti.", "blocked");
  }
}

// ---------------------------------------------------------------- simpan

/** Salin gambar ke storage kita: URL CDN TikTok/Instagram kedaluwarsa & sering menolak hotlink. */
async function storeImage(w: WorkspaceRepo, id: string, src: string): Promise<string | null> {
  try {
    const res = await fetch(src, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    const buf = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(480, 600, { fit: "cover", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    const url = await w.uploadFile(`insights/${id}-${Date.now().toString(36)}.webp`, buf, "image/webp");
    return url;
  } catch {
    return null;
  }
}

const dayWib = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);

/** Baca ulang satu link dan simpan hasilnya (riwayat: satu titik per hari, maks 90). */
export async function refreshLink(w: WorkspaceRepo, link: TrackedLink): Promise<TrackedLink> {
  const now = new Date();
  const p: ParsedLink = { platform: link.platform, kind: link.kind, url: link.url, handle: link.handle };
  try {
    const r = await readLink(p);
    const thumb = r.image ? ((await storeImage(w, link.id, r.image)) ?? link.thumbnail) : link.thumbnail;
    const history = [...(link.history ?? [])];
    const point = { at: now.toISOString(), m: r.metrics };
    if (history.length && dayWib(new Date(history.at(-1)!.at)) === dayWib(now)) history[history.length - 1] = point;
    else history.push(point);
    const patch: Partial<TrackedLink> = {
      metrics: r.metrics,
      title: r.title ?? link.title,
      handle: r.handle ?? link.handle,
      thumbnail: thumb,
      history: history.slice(-90),
      status: "ok",
      error: null,
      checked_at: now.toISOString(),
    };
    await w.updateLink(link.id, patch);
    return { ...link, ...patch };
  } catch (e) {
    const err = e instanceof InsightError ? e : new InsightError("Gagal membaca link. Kami coba lagi nanti.", "blocked");
    const patch: Partial<TrackedLink> = {
      // Angka lama tetap ditampilkan; status hanya jadi "error" kalau belum pernah terbaca.
      status: link.metrics ? "ok" : err.code === "needs_connector" ? "pending" : "error",
      error: err.message,
      checked_at: now.toISOString(),
    };
    await w.updateLink(link.id, patch);
    return { ...link, ...patch };
  }
}

export async function addLink(w: WorkspaceRepo, raw: string, postId: string | null = null): Promise<TrackedLink> {
  const p = await resolveLink(raw);
  if (!p) throw new InsightError("Tempel link TikTok atau Instagram: postingan, reels, video, atau profil.", "invalid");
  const existing = (await w.listLinks()).find((l) => l.url === p.url);
  if (existing) throw new InsightError("Link ini sudah dipantau.", "invalid");
  const link = await w.createLink({ ...p, post_id: postId });
  return refreshLink(w, link);
}

/** Perbarui link yang sudah lama tidak dicek (dipanggil di latar belakang saat halaman dibuka). */
export async function refreshStale(w: WorkspaceRepo, links: TrackedLink[], maxAgeMs: number, limit = 8) {
  const due = links
    .filter((l) => !l.checked_at || Date.now() - new Date(l.checked_at).getTime() > maxAgeMs)
    .filter((l) => !(l.platform === "instagram" && !config.hasApify && l.status === "pending" && l.checked_at))
    .slice(0, limit);
  for (const l of due) await refreshLink(w, l);
  return due.length;
}

// ---------------------------------------------------------------- konten yang diposting lewat aplikasi

/** URL postingan dari respons Ayrshare (postIds[].postUrl) untuk dipantau otomatis. */
export function postUrlsFromPublish(raw: unknown): string[] {
  const ids = (raw as { postIds?: { postUrl?: unknown; status?: unknown }[] } | null)?.postIds;
  if (!Array.isArray(ids)) return [];
  return ids.map((x) => x.postUrl).filter((u): u is string => typeof u === "string" && parseLink(u) !== null);
}

// ---------------------------------------------------------------- angka turunan

export const engagementOf = (m: InsightMetrics | null | undefined) =>
  (m?.likes ?? 0) + (m?.comments ?? 0) + (m?.shares ?? 0) + (m?.saves ?? 0);

export function compact(n: number | undefined | null): string {
  if (n === undefined || n === null) return "–";
  return new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: n >= 1e6 ? 1 : n >= 1e4 ? 0 : 1 }).format(n);
}
