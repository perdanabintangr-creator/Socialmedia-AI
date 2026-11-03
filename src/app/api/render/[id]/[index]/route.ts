import { db } from "@/lib/db";
import { renderSlidePng } from "@/lib/render";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; index: string }> }) {
  const { id, index } = await ctx.params;
  const post = await db().getPost(id);
  if (!post) return new Response("Not found", { status: 404 });
  const png = await renderSlidePng(await db().getBrand(), post, Number(index));
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=60" },
  });
}
