import { renderPackPng } from "@/lib/render-pack";
import { mergeBrandForDev } from "./merge";

export const dynamic = "force-dynamic";

/** Khusus development: render slide dengan Design Pack. */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return new Response("not found", { status: 404 });
  const { brand, slides, index, pack, pair, density } = await req.json();
  const png = await renderPackPng(mergeBrandForDev(brand), slides, index, pack, { pair, density });
  return new Response(new Uint8Array(png), { headers: { "content-type": "image/png" } });
}
