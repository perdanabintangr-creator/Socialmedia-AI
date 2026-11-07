import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { requireWorkspace } from "@/lib/session";
import { renderPackPng } from "@/lib/render-pack";
import { isDensity, isPack, PACK_DEFAULT_PAIR, type PackKey } from "@/lib/design";
import { isFontPair } from "@/lib/font-pairs";
import type { Slide } from "@/lib/types";

export const dynamic = "force-dynamic";

const SAMPLE: Record<PackKey, number> = { editorial: 2, poster: 5, scrapbook: 3 };

const slide = (layout: Slide["layout"], kicker: string, headline: string, body: string, image: string | null): Slide => ({
  layout,
  kicker,
  headline,
  body,
  stat: "",
  items: [],
  itemsB: [],
  labelA: "",
  labelB: "",
  icon: "Sparkles",
  image: image ? { url: image, source: "upload", query: "", prompt: "", credit: "" } : null,
});

/** Pratinjau Design Pack + pasangan huruf memakai nama & warna brand customer sendiri. */
export async function GET(req: Request) {
  const { w } = await requireWorkspace();
  const u = new URL(req.url);
  const pack = isPack(u.searchParams.get("pack")) ? (u.searchParams.get("pack") as PackKey) : "editorial";
  const pairQ = u.searchParams.get("pair");
  const pair = isFontPair(pairQ) ? pairQ : PACK_DEFAULT_PAIR[pack];
  const densityQ = u.searchParams.get("density");
  const density = isDensity(densityQ) ? densityQ : "visual";
  const brand = await w.getBrand();
  // Foto contoh lokal (milik aplikasi) atau foto brand sendiri bila ada.
  const own = brand.assets.find((a) => a.url)?.url;
  const sample = own ?? `data:image/jpeg;base64,${(await fs.readFile(path.join(process.cwd(), "public", "samples", `${SAMPLE[pack]}.jpg`))).toString("base64")}`;
  const name = brand.name || "Brand Kamu";
  const slides = [slide("cover_photo", brand.industry ? brand.industry.split(/[,(]/)[0].trim().slice(0, 24) : "Edisi baru", `Cerita *terbaik* dari ${name}`, "Satu kalimat pendukung yang singkat dan jelas.", sample)];
  const png = await renderPackPng(brand, slides, 0, pack, { pair, density });
  const jpg = await sharp(png).resize(432, 540).jpeg({ quality: 80 }).toBuffer();
  return new Response(new Uint8Array(jpg), { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=600" } });
}
