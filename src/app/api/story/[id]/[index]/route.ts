import { workspaceOrThrow } from "@/lib/session";
import { renderStoryJpeg, renderStoryPng } from "@/lib/render";

export const runtime = "nodejs";

/** Pratinjau / unduhan versi Story 9:16 dari satu slide. ?download=1 untuk mengunduh JPEG. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string; index: string }> }) {
  const { id, index } = await ctx.params;
  let w;
  try {
    ({ w } = await workspaceOrThrow());
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const post = await w.getPost(id);
  if (!post) return new Response("Not found", { status: 404 });
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0 || i >= post.slides.length) return new Response("Not found", { status: 404 });
  const brand = await w.getBrand();
  if (new URL(req.url).searchParams.get("download")) {
    const jpg = await renderStoryJpeg(brand, post, i);
    return new Response(new Uint8Array(jpg), {
      headers: { "Content-Type": "image/jpeg", "Content-Disposition": `attachment; filename="story-${i + 1}.jpg"`, "Cache-Control": "private, max-age=60" },
    });
  }
  const png = await renderStoryPng(brand, post, i);
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=60" } });
}
