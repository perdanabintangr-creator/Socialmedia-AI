import { studioState } from "@/lib/studio-view";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await currentUser())) return new Response("Unauthorized", { status: 401 });
  return Response.json(await studioState(), { headers: { "Cache-Control": "no-store" } });
}
