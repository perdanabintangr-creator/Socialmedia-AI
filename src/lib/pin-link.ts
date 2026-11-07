/** Deteksi link Pinterest (dipakai di klien & server). */
const PIN_RE = /https?:\/\/(?:[a-z]{2,3}\.)?pinterest\.[a-z.]{2,8}\/pin\/[^\s<>"']+|https?:\/\/pin\.it\/[A-Za-z0-9]+/gi;
const ANY_RE = /https?:\/\/(?:[a-z]{2,3}\.)?pinterest\.[a-z.]{2,8}\/[^\s<>"']+/gi;

/** Link pin di dalam teks (maks n). */
export function pinLinks(text: string, n = 6): string[] {
  return [...new Set((text.match(PIN_RE) ?? []).map((u) => u.replace(/[).,!?]+$/, "")))].slice(0, n);
}
/** Link Pinterest yang bukan pin (board/profil) — tidak bisa dipakai langsung. */
export const boardLinks = (text: string) => (text.match(ANY_RE) ?? []).filter((u) => !/\/pin\//.test(u));
