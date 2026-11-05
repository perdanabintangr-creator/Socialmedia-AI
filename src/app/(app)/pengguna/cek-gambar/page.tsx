import Link from "next/link";
import { CheckCircle2, ImageIcon, XCircle } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { checkImageProviders, imageProviders } from "@/lib/image-gen";
import { PageTitle } from "@/components/ui";

export const metadata = { title: "Cek pembuat gambar" };
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NAMES: Record<string, [string, string]> = {
  cloudflare: ["Cloudflare Workers AI", "GRATIS dalam kuota harian · FLUX.1 schnell · tidak bisa meniru referensi"],
  openrouter: ["OpenRouter", "prabayar (top-up) · hemat ±$0,01 (Muse) · meniru referensi ±$0,03 (Gemini Flash Image)"],
  gemini: ["Google Gemini langsung", "butuh billing Google aktif · ±$0,04"],
  openai: ["OpenAI", "±$0,04–0,17"],
};

/** Khusus admin: lihat provider gambar yang aktif dan uji satu gambar per provider. */
export default async function CekGambarPage({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  await requireAdmin();
  const { run } = await searchParams;
  const active = imageProviders();
  const results = run ? await checkImageProviders() : null;
  const anyActive = Object.values(active).some(Boolean);

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Cek pembuat gambar" subtitle="Provider yang terpasang di Vercel. Urutan pemakaian: gratis dulu, lalu termurah." />
      <ul className="space-y-2">
        {Object.entries(NAMES).map(([k, [name, desc]]) => {
          const on = active[k as keyof typeof active];
          return (
            <li key={k} className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-line">
              {on ? <CheckCircle2 size={20} className="mt-0.5 text-emerald-600" /> : <XCircle size={20} className="mt-0.5 text-slate-300" />}
              <div>
                <div className="font-semibold">
                  {name} <span className={`ml-1 text-xs font-semibold ${on ? "text-emerald-700" : "text-slate-400"}`}>{on ? "terpasang" : "belum"}</span>
                </div>
                <div className="text-sm text-slate-500">{desc}</div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/pengguna/cek-gambar?run=1"
          aria-disabled={!anyActive}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${anyActive ? "bg-ink text-white hover:bg-ink/85" : "pointer-events-none bg-slate-100 text-slate-400"}`}
        >
          <ImageIcon size={16} /> Jalankan tes (1 gambar per provider)
        </Link>
        <span className="text-xs text-slate-500">Biaya tes ± $0,01–0,05 per provider berbayar. Bisa memakan waktu 10–60 detik.</span>
      </div>

      {results && (
        <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-line">
          <h2 className="border-b border-line px-5 py-3 font-semibold">Hasil tes</h2>
          <ul className="divide-y divide-line">
            {results.map((r) => (
              <li key={r.provider} className="px-5 py-3 text-sm">
                <div className="flex items-center gap-2 font-semibold">
                  {r.ok ? <CheckCircle2 size={16} className="text-emerald-600" /> : <XCircle size={16} className="text-red-600" />}
                  {r.provider}
                  <span className="font-normal text-slate-400">· {(r.ms / 1000).toFixed(1)} dtk</span>
                  {r.ok && typeof r.costUsd === "number" && <span className="font-normal text-slate-400">· ${r.costUsd.toFixed(4)}</span>}
                </div>
                {r.ok ? <div className="mt-0.5 text-slate-500">Berhasil · {r.model}</div> : <div className="mt-0.5 break-words text-red-700">{r.error}</div>}
              </li>
            ))}
            {!results.length && <li className="px-5 py-3 text-sm text-slate-500">Belum ada provider yang terpasang.</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
