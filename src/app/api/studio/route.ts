import { studioState } from "@/lib/studio-view";
import { workspaceOrThrow } from "@/lib/session";
import { inChat } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let w;
  try {
    ({ w } = await workspaceOrThrow());
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const chatId = new URL(req.url).searchParams.get("chat") ?? "";
  if (!(await w.getChat(chatId))) return new Response("Not found", { status: 404 });
  return Response.json(await studioState(inChat(w, chatId)), { headers: { "Cache-Control": "no-store" } });
}
