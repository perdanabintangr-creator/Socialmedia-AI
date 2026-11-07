import { after, NextResponse } from "next/server";
import { accounts, db } from "@/lib/db";
import { publishDuePost } from "@/lib/pipeline";
import { refreshToken } from "@/lib/instagram";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Dipanggil tiap ±10 menit (Supabase pg_cron) dan harian (Vercel cron):
 * posting konten Instagram yang sudah jatuh tempo + perpanjang token yang hampir habis.
 */
async function run(req: Request) {
  // CRON_SECRET (Vercel Cron harian) atau kunci di Supabase Vault (pg_cron tiap 10 menit).
  const auth = req.headers.get("authorization") ?? "";
  const cron = process.env.CRON_SECRET?.trim();
  const ok = (cron && auth === `Bearer ${cron}`) || (auth.length > 40 && auth === `Bearer ${await accounts().publishCronKey()}`);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Jawab cepat, kerjakan di latar belakang (pg_net tidak menunggu lama).
  after(() => work().catch((e) => console.error("Cron posting gagal:", e)));
  return NextResponse.json({ accepted: true }, { status: 202 });
}

async function work() {
  const started = Date.now();
  const due = await accounts().listDuePosts(new Date().toISOString(), 20);
  const posted: { id: string; ok: boolean; error?: string | null }[] = [];
  for (const p of due) {
    if (Date.now() - started > 240_000) break;
    const r = await publishDuePost(db(p.workspace_id), p).catch((e) => ({ ok: false, post: { ...p, error: e instanceof Error ? e.message : "gagal" } }));
    posted.push({ id: p.id, ok: r.ok, error: r.ok ? undefined : r.post.error });
  }
  // Token Instagram berlaku 60 hari: perpanjang yang tinggal < 10 hari.
  const refreshed: string[] = [];
  const expiring = await accounts().listExpiringSocial(new Date(Date.now() + 10 * 86400_000).toISOString(), 20);
  for (const a of expiring) {
    if (a.platform !== "instagram") continue;
    try {
      const t = await refreshToken(a.token);
      await db(a.workspace_id).saveSocial({ platform: a.platform, account_id: a.account_id, username: a.username, token: t.token, expires_at: t.expiresAt });
      refreshed.push(a.username ?? a.account_id);
    } catch (e) {
      console.error("Perpanjang token IG gagal:", a.username, e instanceof Error ? e.message : e);
    }
  }
  if (due.length || refreshed.length) console.log("Cron posting:", JSON.stringify({ due: due.length, posted, refreshed }));
}

export const GET = run;
export const POST = run;
