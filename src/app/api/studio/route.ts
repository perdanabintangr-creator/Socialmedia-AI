import { studioState } from "@/lib/studio-view";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await studioState(), { headers: { "Cache-Control": "no-store" } });
}
