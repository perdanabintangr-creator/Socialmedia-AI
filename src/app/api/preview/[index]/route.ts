import { workspaceOrThrow } from "@/lib/session";
import { renderSlidePng } from "@/lib/render";
import { demoImageDataUrl } from "@/lib/images";
import { normalizeSlide, type Slide, type TemplateKey } from "@/lib/types";

export const runtime = "nodejs";

/** Galeri contoh semua layout dengan Brand Kit yang tersimpan. */
export async function GET(req: Request, ctx: { params: Promise<{ index: string }> }) {
  const { index } = await ctx.params;
  let brand;
  try {
    brand = await (await workspaceOrThrow()).w.getBrand();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const t = new URL(req.url).searchParams.get("template") as TemplateKey | null;
  const photo = async (n: number) => {
    const url = brand.assets.length ? brand.assets[n % brand.assets.length].url : await demoImageDataUrl(brand, n);
    return { url, source: "demo" as const, query: "", prompt: "", credit: "" };
  };
  const raw: Partial<Slide>[] = [
    { layout: "cover_photo", kicker: brand.pillars[0] ?? "Tips", headline: "Konten bagus itu *bukan* soal alat mahal" , body: "5 hal yang benar-benar bikin orang berhenti scroll", image: await photo(0) },
    { layout: "cover_split", kicker: "Panduan", headline: "Bangun brand yang *diingat* orang", body: "Mulai dari 3 langkah sederhana ini", image: await photo(1) },
    { layout: "cover_type", kicker: "Edisi minggu ini", headline: "Stop posting *asal jadi*", body: "Ini cara tim kecil terlihat seperti agency", image: await photo(2) },
    { layout: "point_photo", kicker: "Tips", headline: "Tentukan *satu* tujuan per konten", body: "Edukasi, membangun kepercayaan, atau jualan. Jangan campur semuanya.", image: await photo(3) },
    { layout: "point_icon", kicker: "Tips", headline: "Hook di 3 detik *pertama*", body: "Slide pertama menentukan apakah orang mau geser atau lanjut scroll.", icon: "Zap" },
    { layout: "list", kicker: "Checklist", headline: "Sebelum klik *posting*", items: ["Hook jelas di slide pertama", "Satu slide, satu ide", "Warna & font sesuai brand", "CTA yang spesifik"] },
    { layout: "steps", kicker: "Cara kerja", headline: "Dari brief ke *posting*", items: ["Tulis brief singkat", "ACC ide dari AI", "Review desain & caption", "Terbit otomatis"] },
    { layout: "compare", headline: "Mitos vs *Fakta*", labelA: "Mitos", labelB: "Fakta", items: ["Harus posting tiap hari", "Konten harus viral"], itemsB: ["Konsisten lebih penting dari sering", "Relevan lebih penting dari viral"] },
    { layout: "stat", kicker: "Fakta", stat: "73%", headline: "orang memutuskan *follow* dari slide pertama", body: "Ilustrasi angka untuk contoh desain." },
    { layout: "quote", kicker: "Founder", headline: "Konsisten lebih penting daripada *sempurna*.", body: brand.name, image: await photo(4) },
    { layout: "cta", headline: "Simpan & *bagikan* ke tim kamu", body: brand.cta },
  ];
  const slides = raw.map(normalizeSlide);
  const png = await renderSlidePng(brand, { slides, template: t ?? brand.defaultTemplate }, Number(index) % slides.length);
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
}
