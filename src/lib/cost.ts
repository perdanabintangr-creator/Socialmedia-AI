import "server-only";
import { AsyncLocalStorage } from "async_hooks";
import type { WorkspaceRepo } from "./db";

/**
 * Pencatat biaya: setiap panggilan Claude & pembuat gambar di dalam `metered()` dijumlahkan,
 * lalu disimpan ke usage_logs (per workspace, per konten). Angka gambar dari OpenRouter adalah
 * biaya nyata yang dilaporkan provider; Claude dihitung dari token × tarif di bawah.
 */

/** Tarif Claude per 1 juta token (USD). Override lewat env CLAUDE_PRICE_IN / CLAUDE_PRICE_OUT. */
const PRICES: Record<string, { in: number; out: number; cacheRead: number }> = {
  "claude-opus-5-5": { in: 4, out: 20, cacheRead: 0.2 },
  "claude-opus-5": { in: 5, out: 25, cacheRead: 0.5 },
  "claude-opus-4-8": { in: 5, out: 25, cacheRead: 0.5 },
  "claude-sonnet-5-5": { in: 2, out: 10, cacheRead: 0.2 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5, cacheRead: 0.01 },
};
const priceFor = (model: string) => {
  const base = PRICES[model] ?? PRICES[Object.keys(PRICES).find((k) => model.startsWith(k)) ?? ""] ?? PRICES["claude-opus-5-5"];
  return {
    in: Number(process.env.CLAUDE_PRICE_IN) || base.in,
    out: Number(process.env.CLAUDE_PRICE_OUT) || base.out,
    cacheRead: base.cacheRead,
  };
};

/** Perkiraan bila provider tidak melaporkan biaya. */
const IMAGE_ESTIMATE: Record<string, number> = { cloudflare: 0, openrouter: 0.034, google: 0.039, openai: 0.04 };

export interface Meter {
  postId?: string | null;
  aiUsd: number;
  aiCalls: number;
  inputTokens: number;
  outputTokens: number;
  imageUsd: number;
  images: number;
  detail: string[];
}

const store = new AsyncLocalStorage<Meter>();

interface Usage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function recordAI(model: string, usage: Usage | null | undefined) {
  const m = store.getStore();
  if (!m || !usage) return;
  const p = priceFor(model);
  const inTok = usage.input_tokens ?? 0;
  const outTok = usage.output_tokens ?? 0;
  const read = usage.cache_read_input_tokens ?? 0;
  const write = usage.cache_creation_input_tokens ?? 0;
  const usd = (inTok * p.in + outTok * p.out + read * p.cacheRead + write * p.in * 1.25) / 1_000_000;
  m.aiUsd += usd;
  m.aiCalls += 1;
  m.inputTokens += inTok + read + write;
  m.outputTokens += outTok;
}

export function recordImage(provider: string, model: string, costUsd?: number) {
  const m = store.getStore();
  if (!m) return;
  const usd = typeof costUsd === "number" ? costUsd : (IMAGE_ESTIMATE[provider] ?? 0.04);
  m.imageUsd += usd;
  m.images += 1;
  m.detail.push(`${model} $${usd.toFixed(4)}`);
}

/** Tandai konten yang sedang dikerjakan supaya biaya tercatat ke konten itu. */
export function setMeterPost(postId: string) {
  const m = store.getStore();
  if (m) m.postId = postId;
}

export type UsageKind = "ideas" | "create_post" | "build_post" | "revise" | "image" | "reference" | "other";

/**
 * Jalankan pekerjaan sambil menghitung biayanya, lalu simpan ke log.
 * `postIdOf` membaca id konten dari hasil (bila ada) supaya biaya tercatat per konten.
 */
export async function metered<T>(w: WorkspaceRepo, kind: UsageKind, fn: () => Promise<T>, postIdOf?: (r: T) => string | null | undefined): Promise<T> {
  // Sudah di dalam meter lain (mis. tugas chat yang memanggil pipeline): jangan dobel.
  if (store.getStore()) return fn();
  const m: Meter = { aiUsd: 0, aiCalls: 0, inputTokens: 0, outputTokens: 0, imageUsd: 0, images: 0, detail: [] };
  let result: T | undefined;
  try {
    result = await store.run(m, fn);
    return result;
  } finally {
    if (m.aiCalls || m.images) {
      await w
        .addUsage({
          kind,
          post_id: m.postId ?? (result !== undefined && postIdOf ? (postIdOf(result) ?? null) : null),
          ai_usd: round(m.aiUsd),
          image_usd: round(m.imageUsd),
          images: m.images,
          ai_calls: m.aiCalls,
          input_tokens: m.inputTokens,
          output_tokens: m.outputTokens,
          detail: m.detail.slice(0, 20).join(" | ") || null,
        })
        .catch((e) => console.error("Gagal mencatat biaya:", e));
    }
  }
}

const round = (n: number) => Math.round(n * 1_000_000) / 1_000_000;

/** Kurs kasar untuk tampilan (bisa diatur lewat env USD_IDR). */
export const USD_IDR = Number(process.env.USD_IDR) || 16500;
export const fmtUsd = (n: number) => `$${n < 1 ? n.toFixed(3) : n.toFixed(2)}`;
export const fmtIdr = (n: number) => `Rp${new Intl.NumberFormat("id-ID").format(Math.round(n * USD_IDR))}`;
