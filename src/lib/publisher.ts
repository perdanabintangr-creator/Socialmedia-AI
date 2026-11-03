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
}

export interface PublishResult {
  ok: boolean;
  ref: string | null;
  raw: unknown;
  error: string | null;
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.AYRSHARE_API_KEY}`,
    "Content-Type": "application/json",
  };
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
  const res = await fetch(`${BASE}/post`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
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

export async function getPublishStatus(ref: string) {
  if (!config.hasPublisher) return null;
  const res = await fetch(`${BASE}/post/${encodeURIComponent(ref)}`, { headers: headers() });
  return (await res.json().catch(() => null)) as Record<string, unknown> | null;
}
