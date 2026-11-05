import "server-only";

/**
 * Pembuat gambar dengan rantai provider (yang pertama berhasil dipakai):
 *
 * Gambar BARU (tanpa referensi), urutan termurah dulu:
 *   1. Cloudflare Workers AI — FLUX.1 schnell, GRATIS dalam kuota harian (CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_AI_TOKEN)
 *   2. OpenRouter Image API — model hemat (default meta/muse-image ±$0,01, cadangan openai/gpt-image-2)
 *   3. OpenRouter chat — Gemini Flash Image (±$0,034)
 *   4. Google AI Studio langsung (GEMINI_API_KEY, butuh billing) / OpenAI (OPENAI_API_KEY)
 *
 * Gambar MENGIKUTI REFERENSI (gambar contoh ikut dikirim) — butuh model yang menerima gambar:
 *   OpenRouter Gemini Flash Image → Google AI Studio → OpenAI edits.
 *
 * Sama seperti di Marqthink: OpenRouter cukup top-up kecil (prabayar), tanpa deposit billing Google.
 */

export interface GenResult {
  data: Buffer;
  provider: "cloudflare" | "openrouter" | "google" | "openai";
  model: string;
  costUsd?: number;
}

const clean = (v: string | undefined) => {
  const s = (v ?? "").trim().replace(/^[A-Z_]+=/, "").replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "").trim();
  return s || undefined;
};
const keys = () => ({
  openrouter: clean(process.env.OPENROUTER_API_KEY),
  cfAccount: clean(process.env.CLOUDFLARE_ACCOUNT_ID),
  cfToken: clean(process.env.CLOUDFLARE_AI_TOKEN),
  gemini: clean(process.env.GEMINI_API_KEY),
  openai: clean(process.env.OPENAI_API_KEY),
});

export function imageProviders() {
  const k = keys();
  return {
    cloudflare: Boolean(k.cfAccount && k.cfToken),
    openrouter: Boolean(k.openrouter),
    gemini: Boolean(k.gemini),
    openai: Boolean(k.openai),
  };
}
export const hasImageGen = () => Object.values(imageProviders()).some(Boolean);
/** Provider yang bisa meniru gambar referensi. */
export const supportsReferences = () => {
  const p = imageProviders();
  return p.openrouter || p.gemini || p.openai;
};

const REF_NOTE =
  "The attached image(s) are STYLE REFERENCES from the client: match their photography style, lighting, color grading, framing, pose energy and overall mood as closely as possible. Create a completely new, original image with a different person or product. Do not copy any face, logo, brand mark, packaging or text from the references.";

const APP = process.env.APP_URL || "https://socialmedia-ai-puce.vercel.app";
const OR_HEADERS = (key: string) => ({
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  "HTTP-Referer": APP,
  "X-Title": "SosmedAutopilot",
});

const list = (env: string | undefined, fallback: string[]) => (env ? env.split(",").map((s) => s.trim()).filter(Boolean) : fallback);

async function fromUrl(url: string): Promise<Buffer | null> {
  const m = url.match(/^data:[^;,]+;base64,(.+)$/);
  if (m) return Buffer.from(m[1], "base64");
  const res = await fetch(url);
  return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
}

// ---------------------------------------------------------------- provider

/** Cloudflare Workers AI: FLUX.1 schnell, termasuk kuota gratis harian Workers AI. */
async function viaCloudflare(account: string, token: string, prompt: string): Promise<GenResult> {
  const model = process.env.CLOUDFLARE_IMAGE_MODEL || "@cf/black-forest-labs/flux-1-schnell";
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: prompt.slice(0, 2000), steps: 8 }),
  });
  const json = (await res.json().catch(() => null)) as { result?: { image?: string }; errors?: { message?: string }[] } | null;
  const b64 = json?.result?.image;
  if (!res.ok || !b64) throw new Error(`cloudflare ${res.status}: ${json?.errors?.[0]?.message ?? "tidak mengembalikan gambar"}`);
  return { data: Buffer.from(b64, "base64"), provider: "cloudflare", model, costUsd: 0 };
}

/** OpenRouter Image API — model gambar murni (Muse, GPT Image). Tidak menerima referensi. */
async function viaOpenRouterImages(key: string, model: string, prompt: string): Promise<GenResult> {
  const res = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: OR_HEADERS(key),
    body: JSON.stringify({ model, prompt, aspect_ratio: "3:4", n: 1 }),
  });
  const body = await res.text();
  if (res.status === 402) throw new Error("[saldo_habis] Saldo OpenRouter habis — top-up di openrouter.ai/credits");
  if (!res.ok) throw new Error(`${model} ${res.status} ${body.slice(0, 200)}`);
  const data = JSON.parse(body) as {
    data?: { b64_json?: string; url?: string }[];
    images?: { b64_json?: string; url?: string; image_url?: { url?: string } }[];
    usage?: { cost?: number };
  };
  const item: { b64_json?: string; url?: string; image_url?: { url?: string } } | undefined = data.data?.[0] ?? data.images?.[0];
  const url = item?.url ?? item?.image_url?.url;
  const buf = item?.b64_json ? Buffer.from(item.b64_json, "base64") : url ? await fromUrl(url) : null;
  if (!buf) throw new Error(`${model}: tidak mengembalikan gambar`);
  return { data: buf, provider: "openrouter", model, costUsd: data.usage?.cost };
}

/** OpenRouter chat completions dengan output gambar (Gemini Flash Image) — bisa menerima gambar referensi. */
async function viaOpenRouterChat(key: string, model: string, prompt: string, refs: Buffer[]): Promise<GenResult> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: OR_HEADERS(key),
    body: JSON.stringify({
      model,
      modalities: model.startsWith("google/") ? ["image", "text"] : ["image"],
      usage: { include: true },
      image_config: { aspect_ratio: "4:5" },
      messages: [
        {
          role: "user",
          content: [
            ...refs.map((b) => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b.toString("base64")}` } })),
            { type: "text", text: refs.length ? `${prompt} ${REF_NOTE}` : prompt },
          ],
        },
      ],
    }),
  });
  const body = await res.text();
  if (res.status === 402) throw new Error("[saldo_habis] Saldo OpenRouter habis — top-up di openrouter.ai/credits");
  if (res.status === 401 || res.status === 403) throw new Error(`[kunci_salah] OpenRouter ${res.status} — cek OPENROUTER_API_KEY (awalan sk-or-v1-)`);
  if (!res.ok) throw new Error(`${model} ${res.status} ${body.slice(0, 200)}`);
  const data = JSON.parse(body) as { choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[]; usage?: { cost?: number } };
  const url = data.choices?.[0]?.message?.images?.find((i) => i.image_url?.url)?.image_url?.url;
  const buf = url ? await fromUrl(url) : null;
  if (!buf) throw new Error(`${model}: tidak mengembalikan gambar`);
  return { data: buf, provider: "openrouter", model, costUsd: data.usage?.cost };
}

async function viaGemini(key: string, prompt: string, refs: Buffer[]): Promise<GenResult> {
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            ...refs.map((b) => ({ inlineData: { mimeType: "image/jpeg", data: b.toString("base64") } })),
            { text: refs.length ? `${prompt} ${REF_NOTE}` : prompt },
          ],
        },
      ],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "4:5" } },
    }),
  });
  type Part = { inlineData?: { data?: string }; inline_data?: { data?: string } };
  const text = await res.text();
  if (res.status === 429 && (/limit:\s*0\b/.test(text) || /free_tier/.test(text))) {
    throw new Error("[billing_google] Kunci Gemini belum ber-billing: pembuatan gambar tidak termasuk paket gratis Google");
  }
  const json = (() => {
    try {
      return JSON.parse(text) as { candidates?: { content?: { parts?: Part[] } }[]; error?: { message?: string } };
    } catch {
      return null;
    }
  })();
  const part = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data || p.inline_data?.data);
  const b64 = part?.inlineData?.data ?? part?.inline_data?.data;
  if (!res.ok || !b64) throw new Error(`gemini ${res.status}: ${json?.error?.message?.slice(0, 200) ?? "tidak mengembalikan gambar"}`);
  return { data: Buffer.from(b64, "base64"), provider: "google", model };
}

async function viaOpenAI(key: string, prompt: string, refs: Buffer[]): Promise<GenResult> {
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const quality = process.env.OPENAI_IMAGE_QUALITY || "medium";
  let res: Response;
  if (refs.length) {
    const fd = new FormData();
    fd.set("model", model);
    fd.set("prompt", `${prompt} ${REF_NOTE}`);
    fd.set("size", "1024x1536");
    fd.set("quality", quality);
    refs.forEach((b, i) => fd.append("image[]", new Blob([new Uint8Array(b)], { type: "image/jpeg" }), `ref-${i + 1}.jpg`));
    res = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: fd });
  } else {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, size: "1024x1536", quality, n: 1 }),
    });
  }
  const json = (await res.json().catch(() => null)) as { data?: { b64_json?: string }[]; error?: { message?: string } } | null;
  const b64 = json?.data?.[0]?.b64_json;
  if (!res.ok || !b64) throw new Error(`openai ${res.status}: ${json?.error?.message ?? "tidak mengembalikan gambar"}`);
  return { data: Buffer.from(b64, "base64"), provider: "openai", model };
}

// ---------------------------------------------------------------- rantai

type Step = { name: string; run: () => Promise<GenResult> };

function chain(prompt: string, refs: Buffer[]): Step[] {
  const k = keys();
  const steps: Step[] = [];
  const orChat = list(process.env.OPENROUTER_IMAGE_MODEL, ["google/gemini-3.1-flash-image", "google/gemini-2.5-flash-image"]);
  if (refs.length) {
    if (k.openrouter) for (const m of orChat) steps.push({ name: `openrouter:${m}`, run: () => viaOpenRouterChat(k.openrouter!, m, prompt, refs) });
    if (k.gemini) steps.push({ name: "gemini", run: () => viaGemini(k.gemini!, prompt, refs) });
    if (k.openai) steps.push({ name: "openai", run: () => viaOpenAI(k.openai!, prompt, refs) });
  }
  // Tanpa referensi (atau semua jalur referensi gagal): termurah dulu.
  if (k.cfAccount && k.cfToken) steps.push({ name: "cloudflare", run: () => viaCloudflare(k.cfAccount!, k.cfToken!, prompt) });
  if (k.openrouter) {
    for (const m of list(process.env.OPENROUTER_BUDGET_IMAGE_MODEL, ["meta/muse-image", "openai/gpt-image-2"])) {
      steps.push({ name: `openrouter:${m}`, run: () => viaOpenRouterImages(k.openrouter!, m, prompt) });
    }
    if (!refs.length) for (const m of orChat) steps.push({ name: `openrouter:${m}`, run: () => viaOpenRouterChat(k.openrouter!, m, prompt, []) });
  }
  if (!refs.length && k.gemini) steps.push({ name: "gemini", run: () => viaGemini(k.gemini!, prompt, []) });
  if (!refs.length && k.openai) steps.push({ name: "openai", run: () => viaOpenAI(k.openai!, prompt, []) });
  return steps;
}

/** Buat gambar lewat provider termurah yang tersedia; `refs` = gambar contoh gaya (JPEG). */
export async function generateImage(prompt: string, refs: Buffer[] = []): Promise<GenResult & { notes?: string }> {
  const errors: string[] = [];
  for (const step of chain(prompt, refs)) {
    try {
      const out = await step.run();
      return errors.length ? { ...out, notes: errors.join(" || ") } : out;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${step.name}: ${msg}`);
      if (msg.startsWith("[saldo_habis]") || msg.startsWith("[kunci_salah]")) {
        // Tidak ada gunanya mencoba model OpenRouter lain dengan kunci/saldo yang sama.
        continue;
      }
    }
  }
  throw new Error(errors.length ? `Gagal membuat gambar: ${errors.join(" || ")}` : "Belum ada kunci pembuat gambar");
}

/** Uji setiap provider yang dikonfigurasi (untuk admin): satu gambar kecil per provider. */
export async function checkImageProviders(): Promise<{ provider: string; ok: boolean; model?: string; ms: number; error?: string; costUsd?: number }[]> {
  const k = keys();
  const prompt = "A cheerful Indonesian woman holding a smartphone, plain solid teal background, studio light. No text.";
  const tests: [string, () => Promise<GenResult>][] = [];
  if (k.cfAccount && k.cfToken) tests.push(["Cloudflare (gratis)", () => viaCloudflare(k.cfAccount!, k.cfToken!, prompt)]);
  if (k.openrouter) {
    const budget = list(process.env.OPENROUTER_BUDGET_IMAGE_MODEL, ["meta/muse-image"])[0];
    tests.push([`OpenRouter hemat (${budget})`, () => viaOpenRouterImages(k.openrouter!, budget, prompt)]);
    const ref = list(process.env.OPENROUTER_IMAGE_MODEL, ["google/gemini-3.1-flash-image"])[0];
    tests.push([`OpenRouter referensi (${ref})`, () => viaOpenRouterChat(k.openrouter!, ref, prompt, [])]);
  }
  if (k.gemini) tests.push(["Google Gemini langsung", () => viaGemini(k.gemini!, prompt, [])]);
  if (k.openai) tests.push(["OpenAI", () => viaOpenAI(k.openai!, prompt, [])]);
  const out = [];
  for (const [provider, run] of tests) {
    const t = Date.now();
    try {
      const r = await run();
      out.push({ provider, ok: true, model: r.model, ms: Date.now() - t, costUsd: r.costUsd });
    } catch (e) {
      out.push({ provider, ok: false, ms: Date.now() - t, error: (e instanceof Error ? e.message : String(e)).slice(0, 300) });
    }
  }
  return out;
}
