export const config = {
  hasAI: Boolean(process.env.ANTHROPIC_API_KEY),
  hasSupabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  hasPublisher: Boolean(process.env.AYRSHARE_API_KEY),
  /** Nama provider gambar yang aktif (rantai lengkap ada di lib/image-gen.ts). */
  imageProvider:
    [
      process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_AI_TOKEN ? "Cloudflare" : "",
      process.env.OPENROUTER_API_KEY?.trim() ? "OpenRouter" : "",
      process.env.GEMINI_API_KEY?.trim() ? "Gemini" : "",
      process.env.OPENAI_API_KEY?.trim() ? "OpenAI" : "",
    ]
      .filter(Boolean)
      .join(" + ") || null,
  hasStock: Boolean(process.env.PEXELS_API_KEY),
  hasApify: Boolean(process.env.APIFY_TOKEN?.trim()),
  hasGoogle: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  appUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  timezone: "Asia/Jakarta",
};
