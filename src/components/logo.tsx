/** Logo SosmedAutopilot: simbol "jalur terbang" + wordmark. */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#0f1222" />
      {/* lintasan */}
      <path d="M9 27c5.5 0 8-2.2 10.5-5.5S24 15 30 14" fill="none" stroke="#8b7bff" strokeWidth="3" strokeLinecap="round" />
      {/* pesawat kertas */}
      <path d="M26.2 9.6 32.4 12.9c.7.4.6 1.4-.1 1.6l-6.6 2.3-2.1 4.2c-.3.7-1.3.6-1.5-.1l-1-5.4 4.1-5.6c.3-.4.7-.5 1-.3Z" fill="#fff" />
      <circle cx="9" cy="27" r="2.4" fill="#fff" />
    </svg>
  );
}

export function Logo({ size = 32, className = "", tone = "dark" }: { size?: number; className?: string; tone?: "dark" | "light" }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className={`text-[17px] tracking-tight ${tone === "light" ? "text-white" : "text-ink"}`}>
        <span className="font-medium">Sosmed</span>
        <span className="font-extrabold">Autopilot</span>
      </span>
    </span>
  );
}
