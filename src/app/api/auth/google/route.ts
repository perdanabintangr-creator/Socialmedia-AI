import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Mulai login Google (OAuth 2.0 authorization code). */
export async function GET() {
  if (!config.hasGoogle) return Response.redirect(`${config.appUrl}/login`, 302);
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set("g_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/" });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${config.appUrl}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  return Response.redirect(url.toString(), 302);
}
