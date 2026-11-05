import Link from "next/link";
import { Coins, ImageIcon, Sparkles } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { accounts, db } from "@/lib/db";
import { fmtIdr, fmtUsd } from "@/lib/cost";
import { PageTitle } from "@/components/ui";
import type { UsageLog } from "@/lib/types";

export const metadata = { title: "Biaya AI" };
export const dynamic = "force-dynamic";

const KIND: Record<string, string> = {
  ideas: "Ide konten",
  create_post: "Buat konten",
  build_post: "Konten dari ide",
  revise: "Revisi",
  image: "Ganti foto",
  reference: "Analisis referensi",
  other: "Lainnya",
};

const startOfMonthWib = () => {
  const ym = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date());
  return new Date(`${ym}-01T00:00:00+07:00`).toISOString();
};
const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(iso));
const total = (rows: UsageLog[]) => rows.reduce((a, r) => a + r.ai_usd + r.image_usd, 0);

/** Khusus admin: biaya Claude & pembuat gambar per bulan, per klien, dan per pekerjaan. */
export default async function BiayaPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireAdmin();
  const { range } = await searchParams;
  const since = range === "30d" ? new Date(Date.now() - 30 * 86_400_000).toISOString() : startOfMonthWib();
  const [rows, workspaces] = await Promise.all([accounts().listUsageAll(since), accounts().listWorkspaces()]);
  const wsName = new Map(workspaces.map((w) => [w.id, w.name]));

  const ai = rows.reduce((a, r) => a + r.ai_usd, 0);
  const img = rows.reduce((a, r) => a + r.image_usd, 0);
  const images = rows.reduce((a, r) => a + r.images, 0);
  const posts = new Set(rows.map((r) => r.post_id).filter(Boolean));

  const byWs = [...rows.reduce((m, r) => m.set(r.workspace_id, [...(m.get(r.workspace_id) ?? []), r]), new Map<string, UsageLog[]>())]
    .map(([id, list]) => ({ id, name: wsName.get(id) ?? "(terhapus)", usd: total(list), jobs: list.length, posts: new Set(list.map((r) => r.post_id).filter(Boolean)).size }))
    .sort((a, b) => b.usd - a.usd);

  // judul konten untuk 40 baris terbaru
  const recent = rows.slice(0, 40);
  const titles = new Map<string, string>();
  await Promise.all(
    [...new Set(recent.filter((r) => r.post_id).map((r) => `${r.workspace_id}|${r.post_id}`))].map(async (k) => {
      const [ws, id] = k.split("|");
      const p = await db(ws).getPost(id).catch(() => null);
      if (p) titles.set(id, p.title);
    }),
  );

  const tiles: [typeof Coins, string, string, string][] = [
    [Coins, "Total", fmtUsd(ai + img), fmtIdr(ai + img)],
    [Sparkles, "Otak AI (Claude)", fmtUsd(ai), `${rows.reduce((a, r) => a + r.ai_calls, 0)} panggilan`],
    [ImageIcon, "Pembuat gambar", fmtUsd(img), `${images} gambar`],
    [Coins, "Rata-rata per konten", posts.size ? fmtUsd((ai + img) / posts.size) : "–", posts.size ? `${fmtIdr((ai + img) / posts.size)} · ${posts.size} konten` : "belum ada"],
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle title="Biaya AI" subtitle="Dicatat otomatis setiap tim AI bekerja. Biaya gambar dari OpenRouter adalah angka nyata; Claude dihitung dari token × tarif.">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
          <Link href="/pengguna/biaya" className={`rounded-lg px-3 py-1.5 ${range !== "30d" ? "bg-white shadow-soft" : "text-slate-500"}`}>Bulan ini</Link>
          <Link href="/pengguna/biaya?range=30d" className={`rounded-lg px-3 py-1.5 ${range === "30d" ? "bg-white shadow-soft" : "text-slate-500"}`}>30 hari</Link>
        </div>
      </PageTitle>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([Icon, label, value, sub]) => (
          <div key={label} className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-line">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Icon size={14} /> {label}
            </div>
            <div className="mt-2 text-2xl font-extrabold tabular-nums">{value}</div>
            <div className="mt-1 text-xs text-slate-500">{sub}</div>
          </div>
        ))}
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-line">
        <h2 className="border-b border-line px-5 py-3 font-semibold">Per klien</h2>
        {byWs.length ? (
          <ul className="divide-y divide-line text-sm">
            {byWs.map((w) => (
              <li key={w.id} className="flex items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1 truncate font-medium">{w.name}</span>
                <span className="text-slate-500">{w.posts} konten · {w.jobs} pekerjaan</span>
                <span className="w-28 text-right font-bold tabular-nums">{fmtUsd(w.usd)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-slate-500">Belum ada biaya tercatat di periode ini. Pencatatan berlaku untuk pekerjaan setelah fitur ini aktif.</p>
        )}
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-line">
        <h2 className="border-b border-line px-5 py-3 font-semibold">Pekerjaan terbaru</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="px-5 py-2 font-semibold">Waktu</th>
                <th className="px-3 py-2 font-semibold">Klien</th>
                <th className="px-3 py-2 font-semibold">Pekerjaan</th>
                <th className="px-3 py-2 text-right font-semibold">Claude</th>
                <th className="px-3 py-2 text-right font-semibold">Gambar</th>
                <th className="px-5 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recent.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-2.5 whitespace-nowrap text-slate-500">{fmtTime(r.created_at)}</td>
                  <td className="max-w-[140px] truncate px-3 py-2.5">{wsName.get(r.workspace_id) ?? "–"}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{KIND[r.kind] ?? r.kind}</div>
                    {r.post_id && titles.get(r.post_id) && <div className="max-w-[260px] truncate text-xs text-slate-500">{titles.get(r.post_id)}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtUsd(r.ai_usd)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {fmtUsd(r.image_usd)} <span className="text-xs text-slate-400">({r.images})</span>
                  </td>
                  <td className="px-5 py-2.5 text-right font-bold tabular-nums">{fmtUsd(r.ai_usd + r.image_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="mt-4 text-xs text-slate-500">
        Mode hemat aktif: maks. 4 foto AI baru per konten, maks. 2 foto diganti saat cek ulang, revisi tidak mengganti foto kecuali diminta. Kurs tampilan Rp
        {new Intl.NumberFormat("id-ID").format(Number(process.env.USD_IDR) || 16500)}/USD.
      </p>
    </div>
  );
}
