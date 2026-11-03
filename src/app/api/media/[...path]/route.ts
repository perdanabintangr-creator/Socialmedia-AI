import { promises as fs } from "fs";
import path from "path";
import { LOCAL_MEDIA } from "@/lib/db";

export const runtime = "nodejs";

const TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

/** Menyajikan file untuk mode lokal (tanpa Supabase). */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  const full = path.resolve(LOCAL_MEDIA, ...parts);
  if (!full.startsWith(path.resolve(LOCAL_MEDIA) + path.sep)) return new Response("Forbidden", { status: 403 });
  try {
    const data = await fs.readFile(full);
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": TYPES[path.extname(full).toLowerCase()] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
