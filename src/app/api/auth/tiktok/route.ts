import { config } from "@/lib/config";
import { workspaceOrThrow } from "@/lib/session";
import { connectUrl, ensureProfile, hasUploadPost } from "@/lib/uploadpost";

export const dynamic = "force-dynamic";

const back = (q: string) => Response.redirect(`${config.appUrl}/pengguna?${q}#sosmed`, 302);

/** Mulai menghubungkan TikTok (halaman connect Upload-Post untuk profile workspace ini). */
export async function GET() {
  if (!hasUploadPost()) return back("tt=belum-siap");
  try {
    const { w } = await workspaceOrThrow();
    const brand = await w.getBrand();
    await ensureProfile(w.id, brand.name);
    const url = await connectUrl(w.id, `${config.appUrl}/api/auth/tiktok/callback`, brand.logoUrl);
    return Response.redirect(url, 302);
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    if (/sesi berakhir/i.test(m)) return Response.redirect(`${config.appUrl}/login`, 302);
    console.error("Mulai hubungkan TikTok gagal:", m);
    return back(`tt=gagal&m=${encodeURIComponent(m.slice(0, 240))}`);
  }
}
