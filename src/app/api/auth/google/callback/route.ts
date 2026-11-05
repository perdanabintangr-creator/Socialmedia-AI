import { cookies } from "next/headers";
import { accounts, db } from "@/lib/db";
import { config } from "@/lib/config";
import { startSession } from "@/lib/session";
import { DEFAULT_BRAND } from "@/lib/types";

export const dynamic = "force-dynamic";

const back = (path: string) => Response.redirect(`${config.appUrl}${path}`, 302);

/** Google mengembalikan kode → tukar token → ambil profil → masuk / buat akun + workspace. */
export async function GET(req: Request) {
  if (!config.hasGoogle) return back("/login");
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const expected = jar.get("g_state")?.value;
  jar.delete("g_state");
  if (!code || !state || !expected || state !== expected) return back("/login?error=google");

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${config.appUrl}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!tokenRes.ok || !token.access_token) throw new Error("token");
    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } });
    const info = (await infoRes.json()) as { email?: string; email_verified?: boolean; name?: string; given_name?: string };
    if (!infoRes.ok || !info.email || !info.email_verified) throw new Error("profil");

    const email = info.email.toLowerCase();
    let user = await accounts().getUserByEmail(email);
    if (user?.status === "disabled") return back("/login?error=disabled");
    if (!user) {
      const name = (info.name || email.split("@")[0]).slice(0, 80);
      const first = (await accounts().countUsers()) === 0;
      const brandName = `Brand ${info.given_name || name.split(" ")[0]}`;
      const ws = await accounts().createWorkspace(brandName);
      // password_hash kosong: akun Google tidak bisa masuk lewat form password.
      user = await accounts().createUser({ name, email, password_hash: "", role: first ? "admin" : "member", status: "active", workspace_id: ws.id });
      await accounts().setWorkspaceOwner(ws.id, user.id);
      await db(ws.id).saveBrand({ ...DEFAULT_BRAND, name: brandName, handle: "" });
    }
    await accounts().updateUser(user.id, { last_login_at: new Date().toISOString() });
    await startSession(user.id);
    return back("/beranda");
  } catch (e) {
    console.error("Google login gagal:", e);
    return back("/login?error=google");
  }
}
