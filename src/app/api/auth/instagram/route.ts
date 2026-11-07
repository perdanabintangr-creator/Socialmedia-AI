import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { config } from "@/lib/config";
import { currentUser } from "@/lib/session";
import { authorizeUrl, hasInstagramApp } from "@/lib/instagram";

export const dynamic = "force-dynamic";

/** Mulai menghubungkan akun Instagram (Instagram API with Instagram Login). */
export async function GET() {
  const s = await currentUser();
  if (!s) return Response.redirect(`${config.appUrl}/login`, 302);
  if (!hasInstagramApp()) return Response.redirect(`${config.appUrl}/pengguna?ig=belum-siap#sosmed`, 302);
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set("ig_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/" });
  return Response.redirect(authorizeUrl(state), 302);
}
