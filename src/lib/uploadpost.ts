import "server-only";

/**
 * Upload-Post (upload-post.com) — dipakai untuk TikTok (API resmi TikTok untuk app yang belum diaudit
 * hanya bisa posting privat). Satu "profile" Upload-Post per workspace: sa-<workspaceId>.
 * Dokumentasi: docs.upload-post.com
 */

const API = "https://api.upload-post.com/api";

export const hasUploadPost = () => Boolean(process.env.UPLOAD_POST_API_KEY?.trim());
export const upProfile = (workspaceId: string) => `sa-${workspaceId}`;

export class UploadPostError extends Error {}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Apikey ${process.env.UPLOAD_POST_API_KEY!.trim()}`, ...(init.headers ?? {}) },
  });
  const body = (await res.json().catch(() => null)) as (T & { success?: boolean; error?: string; message?: string }) | null;
  if (!res.ok || !body || body.success === false) {
    throw new UploadPostError(`Upload-Post: ${body?.error || body?.message || `HTTP ${res.status}`}`);
  }
  return body;
}

const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** Pastikan profile workspace ada (409 = sudah ada). */
export async function ensureProfile(workspaceId: string, displayName: string) {
  try {
    await call("/uploadposts/users", json({ username: upProfile(workspaceId), display_name: displayName.slice(0, 100) }));
  } catch (e) {
    if (e instanceof UploadPostError && /limit of \d+ profiles/i.test(e.message)) {
      const n = e.message.match(/limit of (\d+)/i)?.[1] ?? "2";
      throw new UploadPostError(`Kuota profil Upload-Post penuh (paket sekarang: ${n} profil, 1 profil = 1 brand). Hapus profil yang tidak dipakai di app.upload-post.com → Manage Users, atau upgrade paket Upload-Post.`);
    }
    if (!(e instanceof UploadPostError) || !/exist|already in use|409/i.test(e.message)) throw e;
  }
}

/** Link sekali pakai (48 jam) untuk menghubungkan akun TikTok ke profile workspace. */
export async function connectUrl(workspaceId: string, redirectUrl: string, logo?: string | null) {
  const r = await call<{ access_url: string }>(
    "/uploadposts/users/generate-jwt",
    json({
      username: upProfile(workspaceId),
      redirect_url: redirectUrl,
      platforms: ["tiktok"],
      show_calendar: false,
      connect_title: "Hubungkan TikTok",
      connect_description: "Login TikTok supaya konten yang kamu ACC terbit otomatis.",
      redirect_button_text: "Kembali ke SosmedAutopilot",
      ...(logo?.startsWith("https://") ? { logo_image: logo } : {}),
    }),
  );
  return r.access_url;
}

type SocialEntry = { username?: string; handle?: string; display_name?: string; reauth_required?: boolean } | string | null;

/** Akun TikTok yang terhubung di profile workspace (null bila belum). */
export async function tiktokAccount(workspaceId: string) {
  const r = await call<{ profile?: { social_accounts?: Record<string, SocialEntry> } }>(`/uploadposts/users/${encodeURIComponent(upProfile(workspaceId))}`).catch((e) => {
    if (e instanceof UploadPostError && /not found|404/i.test(e.message)) return { profile: undefined };
    throw e;
  });
  const t = r.profile?.social_accounts?.tiktok;
  if (!t || typeof t !== "object") return null;
  return { id: t.username ?? "", handle: (t.handle || t.display_name || "tiktok").replace(/^@/, ""), reauth: Boolean(t.reauth_required) };
}

export async function disconnectTiktok(workspaceId: string) {
  await call("/uploadposts/users/social", { ...json({ profile_username: upProfile(workspaceId), social_platform: "tiktok" }), method: "DELETE" });
}

/**
 * Posting foto/carousel ke TikTok (photo mode). Diproses di latar belakang oleh Upload-Post;
 * mengembalikan request_id untuk cek status.
 */
export async function publishTiktokPhotos(workspaceId: string, imageUrls: string[], caption: string, requestId: string) {
  const fd = new FormData();
  fd.append("user", upProfile(workspaceId));
  fd.append("platform[]", "tiktok");
  for (const u of imageUrls.slice(0, 35)) fd.append("photos[]", u);
  const firstLine = caption.split("\n").find((l) => l.trim()) ?? "";
  fd.append("title", firstLine.slice(0, 90));
  fd.append("tiktok_description", caption.slice(0, 4000));
  fd.append("privacy_level", "PUBLIC_TO_EVERYONE");
  fd.append("auto_add_music", "true");
  fd.append("async_upload", "true");
  fd.append("request_id", requestId);
  const r = await call<{ request_id?: string; results?: { tiktok?: { success?: boolean; url?: string; error?: string } } }>("/upload_photos", {
    method: "POST",
    body: fd,
    headers: { "Idempotency-Key": requestId },
  });
  const t = r.results?.tiktok;
  if (t && t.success === false) throw new UploadPostError(`TikTok: ${t.error ?? "gagal"}`);
  return { requestId: r.request_id ?? requestId, url: t?.url ?? null };
}

/** Status upload (untuk mengambil link postingan TikTok setelah selesai). */
export async function uploadStatus(requestId: string) {
  return call<{ status?: string; results?: { platform?: string; success?: boolean; post_url?: string | null; error_message?: string }[] | Record<string, unknown> }>(
    `/uploadposts/status?request_id=${encodeURIComponent(requestId)}`,
  );
}
