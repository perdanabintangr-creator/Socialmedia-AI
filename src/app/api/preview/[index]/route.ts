import { db } from "@/lib/db";
import { renderSlidePng } from "@/lib/render";
import type { Slide, TemplateKey } from "@/lib/types";

export const runtime = "nodejs";

/** Contoh desain untuk halaman Brand, memakai brand kit yang tersimpan. */
export async function GET(req: Request, ctx: { params: Promise<{ index: string }> }) {
  const { index } = await ctx.params;
  const brand = await db().getBrand();
  const t = new URL(req.url).searchParams.get("template") as TemplateKey | null;
  const slides: Slide[] = [
    { layout: "cover", kicker: brand.pillars[0] ?? "Tips", headline: "5 hal yang bikin konten kamu lebih dilirik", body: "Geser untuk lihat ›", stat: "" },
    { layout: "point", kicker: "Tips 1", headline: "Satu slide, satu ide", body: "Pembaca hanya butuh 2-3 detik per slide. Taruh detail di caption.", stat: "" },
    { layout: "stat", kicker: "Fakta", headline: "Hook di slide pertama menentukan segalanya", body: "", stat: "3 detik" },
    { layout: "cta", kicker: "", headline: brand.cta || "Follow untuk tips berikutnya", body: brand.handle, stat: "" },
  ];
  const png = await renderSlidePng(brand, { slides, template: t ?? brand.defaultTemplate }, Number(index) % slides.length);
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
}
