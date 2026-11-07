import "server-only";
import { config } from "./config";

/**
 * Instagram API resmi (Instagram API with Instagram Login) — gratis, tanpa perantara.
 * Butuh akun Instagram Business/Creator. App Meta di Development mode sudah bisa memposting
 * ke akun yang terdaftar sebagai tester; untuk umum perlu App Review.
 * Dokumentasi: developers.facebook.com/docs/instagram-platform
 */

const GRAPH = "https://graph.instagram.com/v21.0";
export const IG_SCOPES = ["instagram_business_basic", "instagram_business_content_publish"];

export const hasInstagramApp = () => Boolean(process.env.INSTAGRAM_APP_ID?.trim() && process.env.INSTAGRAM_APP_SECRET?.trim());
export const igRedirectUri = () => `${config.appUrl}/api/auth/instagram/callback`;

const appId = () => process.env.INSTAGRAM_APP_ID!.trim();
const appSecret = () => process.env.INSTAGRAM_APP_SECRET!.trim();

export class InstagramError extends Error {}

async function json<T>(res: Response, what: string): Promise<T> {
  const body = (await res.json().catch(() => null)) as (T & { error?: { message?: string; error_user_msg?: string } | string; error_message?: string }) | null;
  if (!res.ok || !body || (body as { error?: unknown }).error) {
    const e = body?.error;
    const msg = typeof e === "string" ? e : e?.error_user_msg || e?.message || body?.error_message || `HTTP ${res.status}`;
    throw new InstagramError(`Instagram (${what}): ${msg}`);
  }
  return body;
}

export function authorizeUrl(state: string) {
  const u = new URL("https://www.instagram.com/oauth/authorize");
  u.search = new URLSearchParams({
    client_id: appId(),
    redirect_uri: igRedirectUri(),
    response_type: "code",
    scope: IG_SCOPES.join(","),
    state,
    enable_fb_login: "0",
    force_reauth: "true",
  }).toString();
  return u.toString();
}

/** Kode OAuth → token jangka panjang (±60 hari) + profil. */
export async function exchangeCode(code: string) {
  const form = new URLSearchParams({ client_id: appId(), client_secret: appSecret(), grant_type: "authorization_code", redirect_uri: igRedirectUri(), code });
  const short = await json<{ access_token: string; user_id: number | string }>(
    await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body: form }),
    "tukar kode",
  );
  const long = await json<{ access_token: string; expires_in: number }>(
    await fetch(`https://graph.instagram.com/access_token?${new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: appSecret(), access_token: short.access_token })}`),
    "token jangka panjang",
  );
  const me = await profile(long.access_token);
  return { token: long.access_token, expiresAt: new Date(Date.now() + long.expires_in * 1000).toISOString(), ...me };
}

export async function profile(token: string) {
  const me = await json<{ user_id?: string; id: string; username: string; account_type?: string }>(
    await fetch(`${GRAPH}/me?${new URLSearchParams({ fields: "user_id,username,account_type", access_token: token })}`),
    "profil",
  );
  return { accountId: String(me.user_id ?? me.id), username: me.username, accountType: me.account_type ?? null };
}

/** Perpanjang token (boleh setelah umur ≥ 24 jam, sebelum kedaluwarsa). */
export async function refreshToken(token: string) {
  const r = await json<{ access_token: string; expires_in: number }>(
    await fetch(`https://graph.instagram.com/refresh_access_token?${new URLSearchParams({ grant_type: "ig_refresh_token", access_token: token })}`),
    "perpanjang token",
  );
  return { token: r.access_token, expiresAt: new Date(Date.now() + r.expires_in * 1000).toISOString() };
}

const post = (path: string, params: Record<string, string>, token: string, what: string) =>
  fetch(`${GRAPH}/${path}`, { method: "POST", body: new URLSearchParams({ ...params, access_token: token }) }).then((r) => json<{ id: string }>(r, what));

/** Tunggu container media siap (gambar diunduh & diproses Instagram). */
async function waitReady(id: string, token: string) {
  for (let i = 0; i < 20; i++) {
    const s = await json<{ status_code?: string; status?: string }>(
      await fetch(`${GRAPH}/${id}?${new URLSearchParams({ fields: "status_code,status", access_token: token })}`),
      "status media",
    );
    if (!s.status_code || s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new InstagramError(`Instagram menolak gambar: ${s.status ?? s.status_code}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new InstagramError("Instagram terlalu lama memproses gambar, coba lagi nanti");
}

/**
 * Posting ke feed: 1 gambar = single post, 2-10 gambar = carousel.
 * Gambar harus JPEG dengan URL https publik. Mengembalikan id media + permalink.
 */
export async function publishFeed(accountId: string, token: string, imageUrls: string[], caption: string) {
  const urls = imageUrls.slice(0, 10);
  if (!urls.length) throw new InstagramError("Tidak ada gambar untuk diposting");
  if (!urls.every((u) => u.startsWith("https://"))) throw new InstagramError("Gambar harus punya URL publik https");
  let creation: string;
  if (urls.length === 1) {
    creation = (await post(`${accountId}/media`, { image_url: urls[0], caption }, token, "buat media")).id;
  } else {
    const children: string[] = [];
    for (const u of urls) children.push((await post(`${accountId}/media`, { image_url: u, is_carousel_item: "true" }, token, "buat slide carousel")).id);
    for (const c of children) await waitReady(c, token);
    creation = (await post(`${accountId}/media`, { media_type: "CAROUSEL", children: children.join(","), caption }, token, "buat carousel")).id;
  }
  await waitReady(creation, token);
  const media = await post(`${accountId}/media_publish`, { creation_id: creation }, token, "publikasi");
  const info = await fetch(`${GRAPH}/${media.id}?${new URLSearchParams({ fields: "permalink", access_token: token })}`)
    .then((r) => r.json() as Promise<{ permalink?: string }>)
    .catch(() => ({}) as { permalink?: string });
  return { id: media.id, permalink: info.permalink ?? null };
}
