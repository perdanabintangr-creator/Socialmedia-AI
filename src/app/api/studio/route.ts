import { studioState } from "@/lib/studio-view";
import { workspaceOrThrow } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  let w;
  try {
    ({ w } = await workspaceOrThrow());
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await studioState(w), { headers: { "Cache-Control": "no-store" } });
}
