// Token sesi yang ditandatangani (HMAC-SHA256). Dipakai di middleware (edge) dan server — hanya Web Crypto.
export const SESSION_COOKIE = "sm_session";
export const SESSION_DAYS = 30;

function secret(): string | null {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  return process.env.NODE_ENV === "production" ? null : "dev-only-insecure-secret";
}

export const hasSessionSecret = () => secret() !== null;

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()!), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

/** Token: <userId>.<expiresAtMs>.<signature> */
export async function signSession(userId: string) {
  const exp = Date.now() + SESSION_DAYS * 24 * 3600_000;
  const payload = `${userId}.${exp}`;
  return `${payload}.${await hmac(payload)}`;
}

/** Kembalikan userId bila token valid & belum kedaluwarsa. */
export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token || !secret()) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [uid, exp, sig] = parts;
  if (!uid || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return null;
  const expected = await hmac(`${uid}.${exp}`);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? uid : null;
}
