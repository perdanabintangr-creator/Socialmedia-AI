import { workspaceOrThrow } from "@/lib/session";
import { renderSlidePng } from "@/lib/render";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; index: string }> }) {
  const { id, index } = await ctx.params;
  let w;
  try {
    ({ w } = await workspaceOrThrow());
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const post = await w.getPost(id); // hanya konten milik workspace sendiri
  if (!post) return new Response("Not found", { status: 404 });
  const png = await renderSlidePng(await w.getBrand(), post, Number(index));
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=60" },
  });
}
