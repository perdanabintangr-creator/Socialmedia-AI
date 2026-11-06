import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { checkImageProviders, imageProviders } from "@/lib/image-gen";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Diagnosa penyedia gambar (pesan error sudah disensor). Tanda tangan harian dari CRON_SECRET. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const day = new Date().toISOString().slice(0, 10);
  const sig = new URL(req.url).searchParams.get("sig");
  const want = secret ? createHash("sha256").update(`${secret}:image-check:${day}`).digest("hex").slice(0, 32) : null;
  if (!want || sig !== want) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ configured: imageProviders(), results: await checkImageProviders() });
}
