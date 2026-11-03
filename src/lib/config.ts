export const config = {
  hasAI: Boolean(process.env.ANTHROPIC_API_KEY),
  hasSupabase: Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  ),
  hasPublisher: Boolean(process.env.AYRSHARE_API_KEY),
  appUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  timezone: "Asia/Jakarta",
};
