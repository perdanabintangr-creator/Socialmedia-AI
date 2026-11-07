import { cookies } from "next/headers";
import { config } from "@/lib/config";
import { workspaceOrThrow } from "@/lib/session";
import { exchangeCode, hasInstagramApp } from "@/lib/instagram";

export const dynamic = "force-dynamic";

const back = (q: string) => Response.redirect(`${config.appUrl}/pengguna?${q}#sosmed`, 302);

/** Instagram mengembalikan kode → token jangka panjang → simpan ke workspace yang sedang login. */
export async function GET(req: Request) {
  if (!hasInstagramApp()) return back("ig=belum-siap");
  const url = new URL(req.url);
  const jar = await cookies();
  const expected = jar.get("ig_state")?.value;
  jar.delete("ig_state");
  if (url.searchParams.get("error")) return back("ig=batal");
  const code = url.searchParams.get("code")?.replace(/#_$/, "");
  const state = url.searchParams.get("state");
  if (!code || !state || !expected || state !== expected) return back("ig=gagal");
  try {
    const { w } = await workspaceOrThrow();
    const acc = await exchangeCode(code);
    await w.saveSocial({ platform: "instagram", account_id: acc.accountId, username: acc.username, token: acc.token, expires_at: acc.expiresAt });
    return back(`ig=ok&u=${encodeURIComponent(acc.username)}`);
  } catch (e) {
    console.error("Hubungkan Instagram gagal:", e instanceof Error ? e.message : e);
    return back(`ig=gagal&m=${encodeURIComponent((e instanceof Error ? e.message : "").slice(0, 160))}`);
  }
}
