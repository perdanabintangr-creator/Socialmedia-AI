import { after, NextResponse } from "next/server";
import { accounts, db } from "@/lib/db";
import { kickBatch, processBatchStep } from "@/lib/month";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Satu langkah antrean "konten sebulan": buat 1 konten, lalu panggil diri sendiri untuk berikutnya. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { ws } = (await req.json().catch(() => ({}))) as { ws?: string };
  if (!ws || !(await accounts().getWorkspace(ws))) return NextResponse.json({ error: "workspace" }, { status: 400 });
  const origin = new URL(req.url).origin;
  after(async () => {
    const more = await processBatchStep(db(ws)).catch((e) => {
      console.error("Langkah antrean bulanan gagal:", e);
      return true;
    });
    if (more) await kickBatch(ws, origin);
  });
  return NextResponse.json({ accepted: true }, { status: 202 });
}
