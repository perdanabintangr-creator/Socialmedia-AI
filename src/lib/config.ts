const imageProvider =
  (process.env.IMAGE_PROVIDER as "openai" | "gemini" | undefined) ??
  (process.env.GEMINI_API_KEY ? "gemini" : process.env.OPENAI_API_KEY ? "openai" : undefined);

export const config = {
  hasAI: Boolean(process.env.ANTHROPIC_API_KEY),
  hasSupabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  hasPublisher: Boolean(process.env.AYRSHARE_API_KEY),
  imageProvider: imageProvider && (imageProvider === "gemini" ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY) ? imageProvider : null,
  hasStock: Boolean(process.env.PEXELS_API_KEY),
  hasApify: Boolean(process.env.APIFY_TOKEN?.trim()),
  hasGoogle: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  appUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  timezone: "Asia/Jakarta",
};
