import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { LOCAL_MEDIA } from "./db";
import { config } from "./config";

/** Ambil isi file dari URL (file lokal dibaca langsung tanpa HTTP). */
export async function readMedia(url: string): Promise<Buffer> {
  if (url.startsWith("data:")) return Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
  const localPrefix = `${config.appUrl}/api/media/`;
  if (url.startsWith(localPrefix) || url.startsWith("/api/media/")) {
    const rel = url.startsWith("/") ? url.slice("/api/media/".length) : url.slice(localPrefix.length);
    const full = path.resolve(LOCAL_MEDIA, decodeURIComponent(rel.split("?")[0]));
    if (!full.startsWith(path.resolve(LOCAL_MEDIA))) throw new Error("Path tidak valid");
    return fs.readFile(full);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gagal mengambil gambar (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
