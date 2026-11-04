import { AGENT_LIST } from "@/lib/agents";

/** Bingkai halaman masuk/daftar: penjelasan singkat produk + kartu form. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-4xl items-center gap-8 py-6 md:grid-cols-2 md:py-12">
      <div className="hidden md:block">
        <div className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Tim konten AI untuk brand kamu</div>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Kasih arahan. Cek hasilnya. Tinggal ACC.</h2>
        <p className="mt-3 text-slate-600">Tiga agen AI menyiapkan ide, menulis, mendesain, sampai menjadwalkan posting ke Instagram & TikTok.</p>
        <ul className="mt-6 space-y-3">
          {AGENT_LIST.map((a) => (
            <li key={a.id} className="flex items-center gap-3">
              <span className={`h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br ${a.gradient}`} />
              <span className="text-sm">
                <span className="font-semibold">{a.name}</span> <span className="text-slate-500">· {a.does}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
