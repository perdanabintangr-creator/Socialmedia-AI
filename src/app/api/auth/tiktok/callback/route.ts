import { config } from "@/lib/config";
import { workspaceOrThrow } from "@/lib/session";
import { hasUploadPost, tiktokAccount, upProfile } from "@/lib/uploadpost";

export const dynamic = "force-dynamic";

const back = (q: string) => Response.redirect(`${config.appUrl}/pengguna?${q}#sosmed`, 302);

/** Kembali dari halaman connect: baca akun TikTok di profile workspace lalu simpan. */
export async function GET() {
  if (!hasUploadPost()) return back("tt=belum-siap");
  try {
    const { w } = await workspaceOrThrow();
    const acc = await tiktokAccount(w.id);
    if (!acc) return back("tt=batal");
    await w.saveSocial({ platform: "tiktok", account_id: upProfile(w.id), username: acc.handle, token: "upload-post", expires_at: null });
    return back(`tt=ok&u=${encodeURIComponent(acc.handle)}`);
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    if (/sesi berakhir/i.test(m)) return Response.redirect(`${config.appUrl}/login`, 302);
    console.error("Hubungkan TikTok gagal:", m);
    return back(`tt=gagal&m=${encodeURIComponent(m.slice(0, 160))}`);
  }
}
