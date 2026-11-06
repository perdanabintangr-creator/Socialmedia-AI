import "server-only";
import { config } from "./config";
import type { Platform } from "./types";

/**
 * Publisher via Ayrshare (https://www.ayrshare.com) — layanan perantara yang sudah
 * punya izin resmi Instagram & TikTok, jadi kita tidak perlu menunggu app review.
 * Akun IG (Business/Creator) & TikTok di-connect sekali di dashboard Ayrshare.
 * Kalau nanti mau pindah provider / API resmi, cukup ganti file ini.
 */

const BASE = "https://api.ayrshare.com/api";

export interface PublishInput {
  text: string;
  mediaUrls: string[];
  platforms: Platform[];
  scheduleAt: Date | null; // null = posting sekarang
  profileKey: string | null;
}

export interface PublishResult {
  ok: boolean;
  ref: string | null;
  raw: unknown;
  error: string | null;
}

/** profileKey: akun sosmed milik workspace klien (Ayrshare User Profile). Tanpa itu = akun utama. */
function headers(profileKey?: string | null): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${process.env.AYRSHARE_API_KEY}`,
    "Content-Type": "application/json",
  };
  if (profileKey) h["Profile-Key"] = profileKey;
  return h;
}

function errorText(raw: unknown, status: number) {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const msgs: string[] = [];
    if (typeof r.message === "string") msgs.push(r.message);
    if (Array.isArray(r.errors)) {
      for (const e of r.errors) {
        if (e && typeof e === "object" && "message" in e) {
          const platform = "platform" in e ? `${String((e as { platform: unknown }).platform)}: ` : "";
          msgs.push(platform + String((e as { message: unknown }).message));
        }
      }
    }
    if (msgs.length) return msgs.join(" | ");
  }
  return `Publisher error (HTTP ${status})`;
}

export async function publish(input: PublishInput): Promise<PublishResult> {
  if (!config.hasPublisher) {
    return { ok: false, ref: null, raw: null, error: "AYRSHARE_API_KEY belum di-set" };
  }
  const body: Record<string, unknown> = {
    post: input.text,
    platforms: input.platforms,
    mediaUrls: input.mediaUrls,
  };
  if (input.scheduleAt && input.scheduleAt.getTime() > Date.now() + 60_000) {
    body.scheduleDate = input.scheduleAt.toISOString();
  }
  const res = await fetch(`${BASE}/post`, { method: "POST", headers: headers(input.profileKey), body: JSON.stringify(body) });
  const raw = await res.json().catch(() => null);
  const r = (raw ?? {}) as Record<string, unknown>;
  const ok = res.ok && r.status !== "error";
  return {
    ok,
    ref: typeof r.id === "string" ? r.id : null,
    raw,
    error: ok ? null : errorText(raw, res.status),
  };
}

/** Batalkan postingan terjadwal di Ayrshare (dipakai sebelum revisi konten autopilot). */
export async function unpublish(ref: string, profileKey: string | null): Promise<{ ok: boolean; error: string | null }> {
  if (!config.hasPublisher) return { ok: true, error: null };
  const res = await fetch(`${BASE}/post`, { method: "DELETE", headers: headers(profileKey), body: JSON.stringify({ id: ref }) });
  const raw = await res.json().catch(() => null);
  const r = (raw ?? {}) as Record<string, unknown>;
  const ok = res.ok && r.status !== "error";
  return { ok, error: ok ? null : errorText(raw, res.status) };
}

export async function getPublishStatus(ref: string, profileKey: string | null) {
  if (!config.hasPublisher) return null;
  const res = await fetch(`${BASE}/post/${encodeURIComponent(ref)}`, { headers: headers(profileKey) });
  return (await res.json().catch(() => null)) as Record<string, unknown> | null;
}

/**
 * Upload satu frame ke Instagram Story (Ayrshare: instagramOptions.stories).
 * TikTok belum menyediakan API Story untuk aplikasi pihak ketiga.
 */
export async function publishStory(input: { mediaUrl: string; profileKey: string | null; scheduleAt: Date | null; note: string }): Promise<PublishResult> {
  if (!config.hasPublisher) return { ok: false, ref: null, raw: null, error: "AYRSHARE_API_KEY belum di-set" };
  const body: Record<string, unknown> = {
    post: input.note || "Story",
    platforms: ["instagram"],
    mediaUrls: [input.mediaUrl],
    instagramOptions: { stories: true },
  };
  if (input.scheduleAt && input.scheduleAt.getTime() > Date.now() + 60_000) body.scheduleDate = input.scheduleAt.toISOString();
  const res = await fetch(`${BASE}/post`, { method: "POST", headers: headers(input.profileKey), body: JSON.stringify(body) });
  const raw = await res.json().catch(() => null);
  const r = (raw ?? {}) as Record<string, unknown>;
  const ok = res.ok && r.status !== "error";
  return { ok, ref: typeof r.id === "string" ? r.id : null, raw, error: ok ? null : errorText(raw, res.status) };
}
