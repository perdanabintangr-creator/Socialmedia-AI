// Dipakai di middleware (edge) dan server — hanya Web Crypto.
export const SESSION_COOKIE = "mt_session";

export async function sessionToken(password: string) {
  const data = new TextEncoder().encode(`marqthink-social:${password}:${process.env.SESSION_SECRET ?? ""}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
