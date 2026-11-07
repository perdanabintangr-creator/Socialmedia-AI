import "server-only";

/**
 * Referensi dari link Pinterest: customer cukup menempel link pin (pinterest.com/pin/… atau pin.it/…).
 * Gambar diambil lewat oEmbed resmi Pinterest (cadangan: meta og:image halaman pin).
 * Hanya dipakai sebagai referensi gaya untuk AI — tidak diposting ulang.
 */

export { boardLinks, pinLinks } from "./pin-link";

const UA = "Mozilla/5.0 (compatible; SosmedAutopilotBot/1.0; +https://socialmedia-ai-puce.vercel.app)";
const MAX = 10 * 1024 * 1024;

async function get(url: string, accept = "*/*") {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    return await fetch(url, { headers: { "user-agent": UA, accept }, redirect: "follow", signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** pin.it/xxx → https://www.pinterest.com/pin/123/ (ikuti redirect). */
async function canonicalPin(url: string) {
  if (!/pin\.it\//i.test(url)) return url.split("?")[0];
  const res = await get(url, "text/html");
  const final = res.url;
  const id = final.match(/\/pin\/(\d+)/)?.[1];
  return id ? `https://www.pinterest.com/pin/${id}/` : final.split("?")[0];
}

/** Ukuran terbesar yang tersedia di CDN Pinterest. */
function bigger(src: string): string[] {
  const m = src.match(/^(https:\/\/i\.pinimg\.com\/)([^/]+)(\/.+)$/);
  if (!m) return [src];
  return [...new Set([`${m[1]}originals${m[3]}`, `${m[1]}736x${m[3]}`, src])];
}

async function imageUrlsOf(pin: string): Promise<string[]> {
  // 1) oEmbed resmi
  try {
    const r = await get(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(pin)}`, "application/json");
    if (r.ok) {
      const j = (await r.json()) as { thumbnail_url?: string };
      if (j.thumbnail_url) return bigger(j.thumbnail_url);
    }
  } catch {
    // lanjut ke cadangan
  }
  // 2) meta og:image di halaman pin
  const r = await get(pin, "text/html");
  if (!r.ok) throw new Error(`Pinterest menjawab ${r.status}`);
  const html = (await r.text()).slice(0, 600_000);
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1];
  if (!og) throw new Error("gambar pin tidak ditemukan");
  return bigger(og.replace(/&amp;/g, "&"));
}

/** Unduh gambar dari satu link pin. */
export async function fetchPinImage(link: string): Promise<Buffer> {
  const pin = await canonicalPin(link);
  for (const src of await imageUrlsOf(pin)) {
    try {
      const r = await get(src, "image/*");
      const type = r.headers.get("content-type") ?? "";
      if (!r.ok || !type.startsWith("image/")) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 0 && buf.length <= MAX) return buf;
    } catch {
      // coba ukuran berikutnya
    }
  }
  throw new Error("gambar pin tidak bisa diunduh");
}
