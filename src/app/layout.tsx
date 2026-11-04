import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const jakarta = localFont({
  src: [
    { path: "./fonts/jakarta-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/jakarta-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/jakarta-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/jakarta-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/jakarta-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "SosmedAutopilot — Tim sosmed AI untuk brand kamu", template: "%s · SosmedAutopilot" },
  description:
    "Tiga agen AI menyiapkan ide, menulis, mendesain, sampai menjadwalkan posting Instagram & TikTok. Kamu tinggal kasih arahan dan ACC.",
};

export const viewport: Viewport = {
  themeColor: "#f8f8fb",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
