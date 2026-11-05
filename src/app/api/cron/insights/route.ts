import { NextResponse } from "next/server";
import { accounts, db } from "@/lib/db";
import { refreshLink } from "@/lib/insights";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Dipanggil Vercel Cron tiap hari: perbarui angka semua link yang dipantau (riwayat harian). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  const before = new Date(Date.now() - 20 * 3600_000).toISOString();
  const links = await accounts().listStaleLinks(before, 200);
  const brands = new Map<string, boolean>();
  let done = 0;
  for (const l of links) {
    if (Date.now() - started > 270_000) break;
    const w = db(l.workspace_id);
    if (!brands.has(l.workspace_id)) brands.set(l.workspace_id, (await w.getBrand()).performance);
    if (!brands.get(l.workspace_id)) continue;
    await refreshLink(w, l);
    done++;
  }
  return NextResponse.json({ checked: done, due: links.length });
}
