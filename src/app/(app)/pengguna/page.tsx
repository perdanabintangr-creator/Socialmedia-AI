import Link from "next/link";
import { accounts } from "@/lib/db";
import { publicUser, requireAdmin, requireWorkspace } from "@/lib/session";
import { publishTarget } from "@/lib/pipeline";
import { ActionForm, Submit } from "@/components/forms";
import { Card, Field, PageTitle, formatWIB, inputCls } from "@/components/ui";
import { disconnectInstagramAction, disconnectTiktokAction, requestSocialAction } from "@/app/onboarding-actions";
import { hasUploadPost } from "@/lib/uploadpost";
import { hasInstagramApp } from "@/lib/instagram";
import { changePasswordAction, deleteUserAction, setPublishKeyAction, setUserRoleAction, setUserStatusAction, setWorkspacePlanAction } from "@/app/auth-actions";
import { PLAN_RULES, quotaOf } from "@/lib/plans";
import { PLANS } from "@/lib/pricing";
import { PLAN_KEYS, type PlanKey } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS = {
  pending: ["Menunggu persetujuan", "bg-amber-100 text-amber-800"],
  active: ["Aktif", "bg-emerald-100 text-emerald-800"],
  disabled: ["Nonaktif", "bg-slate-200 text-slate-600"],
} as const;

const IG_MSG: Record<string, [string, boolean]> = {
  ok: ["Instagram terhubung! Konten yang kamu ACC akan terbit otomatis sesuai jadwal.", true],
  batal: ["Menghubungkan Instagram dibatalkan.", false],
  gagal: ["Instagram gagal dihubungkan.", false],
  "belum-siap": ["Koneksi Instagram belum diaktifkan oleh admin aplikasi (INSTAGRAM_APP_ID/SECRET).", false],
};
const TT_MSG: Record<string, [string, boolean]> = {
  ok: ["TikTok terhubung! Konten yang kamu ACC juga terbit di TikTok (mode foto/slideshow).", true],
  batal: ["TikTok belum terhubung — selesaikan login TikTok di halaman tadi, lalu klik “Cek koneksi”.", false],
  gagal: ["TikTok gagal dihubungkan.", false],
  "belum-siap": ["Koneksi TikTok belum diaktifkan oleh admin aplikasi (UPLOAD_POST_API_KEY).", false],
};

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ ig?: string; tt?: string; u?: string; m?: string }> }) {
  const { user: me, w } = await requireWorkspace();
  const sp = await searchParams;
  const [brand, target, quota, ig, tt] = await Promise.all([w.getBrand(), publishTarget(w.id), quotaOf(w), w.getSocial("instagram"), w.getSocial("tiktok")]);
  const igMsg = sp.ig ? IG_MSG[sp.ig] : sp.tt ? TT_MSG[sp.tt] : undefined;
  const support = process.env.SUPPORT_EMAIL;
  const isAdmin = me.role === "admin";
  const [allUsers, workspaces] = isAdmin ? await Promise.all([accounts().listUsers(), accounts().listWorkspaces()]) : [[], []];
  const users = allUsers.map(publicUser);
  const wsName = new Map(workspaces.map((x) => [x.id, x.name]));
  const wsKey = new Map(workspaces.map((x) => [x.id, x.publish_key]));
  const wsPlan = new Map(workspaces.map((x) => [x.id, (x.plan ?? "free") as PlanKey]));
  if (isAdmin) await requireAdmin();
  const pending = users.filter((u) => u.status === "pending");

  return (
    <div className="space-y-6">
      <PageTitle title={isAdmin ? "Pengguna & klien" : "Akun"} subtitle={isAdmin ? "Setujui klien baru dan kelola akses. Isi konten tiap workspace bersifat pribadi milik klien." : "Pengaturan akun kamu."} />

      <Card>
        <div id="paket" className="scroll-mt-24" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Paket kamu: {quota.plan.label}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {quota.plan.quality === "full"
                ? "Kualitas penuh: foto AI wajib di tiap konten, logo, paham brand, dan dicek ulang AI art director."
                : "Kualitas dasar: desain grafis & tipografi tanpa foto AI."}
            </p>
          </div>
          {Number.isFinite(quota.plan.quota) && (
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${quota.ok ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-red-50 text-red-700 ring-1 ring-red-200"}`}>
              {quota.used} / {quota.plan.quota} konten {quota.plan.per === "total" ? "(coba gratis)" : "bulan ini"}
            </span>
          )}
        </div>
        {Number.isFinite(quota.plan.quota) && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="bg-social h-full rounded-full" style={{ width: `${Math.min(100, (quota.used / quota.plan.quota) * 100)}%` }} />
          </div>
        )}
        {!isAdmin && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <div key={p.name} className={`rounded-2xl p-4 ring-1 ${p.name === quota.plan.label ? "bg-brand-50 ring-brand-300" : "ring-line"}`}>
                <div className="font-bold">{p.name}</div>
                <div className="mt-0.5 text-lg font-extrabold">
                  {p.price}
                  <span className="text-xs font-semibold text-slate-500">{p.period}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">{p.features[0]}</div>
                {p.name !== quota.plan.label && support && (
                  <a
                    href={`mailto:${support}?subject=${encodeURIComponent(`Upgrade ke paket ${p.name}`)}&body=${encodeURIComponent(`Halo, saya ingin pindah ke paket ${p.name} untuk brand ${brand.name}.`)}`}
                    className="mt-3 inline-flex rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink/85"
                  >
                    Pilih {p.name}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="scroll-mt-24" >
        <div id="sosmed" className="scroll-mt-24" />
        <h2 className="font-semibold">Akun sosmed</h2>
        <p className="mt-1 text-sm text-slate-500">Hubungkan Instagram (Business/Creator) dan TikTok supaya konten yang kamu ACC terbit otomatis sesuai jadwal.</p>
        {igMsg && (
          <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-semibold ${igMsg[1] ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {igMsg[0]} {sp.m ? <span className="font-normal">({sp.m})</span> : null}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl p-4 ring-1 ring-line">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)] text-sm font-black text-white">IG</span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Instagram</div>
            <div className="text-xs text-slate-500">
              {ig ? (
                <>Terhubung sebagai <b className="text-ink">@{ig.username}</b>{ig.expires_at ? ` · token diperpanjang otomatis (berlaku s/d ${formatWIB(ig.expires_at)})` : ""}</>
              ) : hasInstagramApp() ? (
                "Belum terhubung. Login dengan akun Instagram Business/Creator."
              ) : (
                "Belum tersedia — admin perlu memasang INSTAGRAM_APP_ID & INSTAGRAM_APP_SECRET."
              )}
            </div>
          </div>
          {ig ? (
            <ActionForm action={disconnectInstagramAction}>
              <Submit variant="ghost" pendingText="Memutus…" className="py-2 text-xs">Putuskan</Submit>
            </ActionForm>
          ) : (
            hasInstagramApp() && (
              <a href="/api/auth/instagram" className="inline-flex rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/90">
                Hubungkan Instagram
              </a>
            )
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl p-4 ring-1 ring-line">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-sm font-black text-white">
            <span className="[text-shadow:2px_0_#25F4EE,-2px_0_#FE2C55]">TT</span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">TikTok</div>
            <div className="text-xs text-slate-500">
              {tt ? (
                <>Terhubung sebagai <b className="text-ink">@{tt.username}</b> · diposting sebagai foto/slideshow dengan musik otomatis</>
              ) : hasUploadPost() ? (
                "Belum terhubung. Login TikTok lewat halaman aman Upload-Post."
              ) : (
                "Belum tersedia — admin perlu memasang UPLOAD_POST_API_KEY."
              )}
            </div>
          </div>
          {tt ? (
            <ActionForm action={disconnectTiktokAction}>
              <Submit variant="ghost" pendingText="Memutus…" className="py-2 text-xs">Putuskan</Submit>
            </ActionForm>
          ) : (
            hasUploadPost() && (
              <div className="flex items-center gap-2">
                <a href="/api/auth/tiktok/callback" className="text-xs font-semibold text-slate-500 hover:text-ink">Cek koneksi</a>
                <a href="/api/auth/tiktok" className="inline-flex rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/90">
                  Hubungkan TikTok
                </a>
              </div>
            )
          )}
        </div>
        {!ig && target.via === "ayrshare" && <p className="mt-3 text-xs text-emerald-700">Saat ini auto-posting memakai layanan Ayrshare.</p>}
        {!target.connected && !brand.socialRequested && !hasInstagramApp() && !hasUploadPost() && (
          <ActionForm action={requestSocialAction} className="mt-3">
            <Submit variant="primary" pendingText="Mengirim…" className="py-2 text-xs">Minta dihubungkan</Submit>
          </ActionForm>
        )}
        {!target.connected && <p className="mt-3 text-xs text-slate-500">Selama belum terhubung, desain final tetap dibuat dan bisa diunduh untuk diposting manual.</p>}
      </Card>

      <Card>
        <h2 className="font-semibold">Akun saya</h2>
        <p className="mt-1 text-sm text-slate-600">
          {me.name} · {me.email} · {me.role === "admin" ? "Admin" : "Anggota"}
        </p>
        <ActionForm action={changePasswordAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" resetOnOk>
          <Field label="Password lama">
            <input type="password" name="current" autoComplete="current-password" required className={inputCls} />
          </Field>
          <Field label="Password baru">
            <input type="password" name="next" autoComplete="new-password" minLength={8} required className={inputCls} />
          </Field>
          <Submit variant="ghost" pendingText="Menyimpan…">Ganti password</Submit>
        </ActionForm>
      </Card>

      {isAdmin && (
        <Link href="/pengguna/cek-gambar" className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 text-sm font-semibold shadow-soft ring-1 ring-line hover:ring-brand-200">
          Cek pembuat gambar (Gemini / OpenRouter / Cloudflare)
          <span className="text-slate-400">›</span>
        </Link>
      )}
      {isAdmin && (
        <Link href="/pengguna/biaya" className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 text-sm font-semibold shadow-soft ring-1 ring-line hover:ring-brand-200">
          Biaya AI (per bulan, per klien, per konten)
          <span className="text-slate-400">›</span>
        </Link>
      )}

      {isAdmin && (
        <Card className="p-0">
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="font-semibold">Klien & pengguna ({users.length})</h2>
            {pending.length > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">{pending.length} menunggu persetujuan</span>}
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {users.map((u) => {
              const [label, cls] = STATUS[u.status];
              const self = u.id === me.id;
              return (
                <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {u.name} {self && <span className="text-xs text-slate-400">(kamu)</span>}
                      {u.workspace_id && wsName.get(u.workspace_id) && (
                        <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{wsName.get(u.workspace_id)}</span>
                      )}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {u.email} · daftar {formatWIB(u.created_at)}
                      {u.last_login_at ? ` · login terakhir ${formatWIB(u.last_login_at)}` : ""}
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{u.role === "admin" ? "Admin" : "Anggota"}</span>
                  {u.workspace_id && u.role !== "admin" && (
                    <ActionForm action={setWorkspacePlanAction.bind(null, u.workspace_id)} className="flex items-center gap-1.5">
                      <select name="plan" defaultValue={wsPlan.get(u.workspace_id) ?? "free"} aria-label={`Paket ${u.name}`} className={`${inputCls} w-auto py-1 text-xs`}>
                        {PLAN_KEYS.map((k) => (
                          <option key={k} value={k}>
                            {PLAN_RULES[k].label}
                          </option>
                        ))}
                      </select>
                      <Submit variant="ghost" pendingText="…" className="px-2.5 py-1 text-xs">Simpan paket</Submit>
                    </ActionForm>
                  )}
                  {u.workspace_id && u.role !== "admin" && (
                    <ActionForm action={setPublishKeyAction.bind(null, u.workspace_id)} className="flex w-full items-center gap-1.5 sm:w-auto">
                      <input
                        name="publishKey"
                        defaultValue={wsKey.get(u.workspace_id) ?? ""}
                        placeholder="Ayrshare Profile Key"
                        aria-label={`Profile Key sosmed ${u.name}`}
                        className={`${inputCls} w-full py-1 text-xs sm:w-48`}
                      />
                      <Submit variant="ghost" pendingText="…" className="px-2.5 py-1 text-xs">{wsKey.get(u.workspace_id) ? "Ubah" : "Hubungkan sosmed"}</Submit>
                    </ActionForm>
                  )}
                  {!self && (
                    <div className="flex flex-wrap gap-1.5">
                      {u.status !== "active" ? (
                        <ActionForm action={setUserStatusAction.bind(null, u.id, "active")}>
                          <Submit variant="approve" pendingText="…" className="px-2.5 py-1 text-xs">{u.status === "pending" ? "Setujui" : "Aktifkan"}</Submit>
                        </ActionForm>
                      ) : (
                        <ActionForm action={setUserStatusAction.bind(null, u.id, "disabled")}>
                          <Submit variant="ghost" pendingText="…" className="px-2.5 py-1 text-xs">Nonaktifkan</Submit>
                        </ActionForm>
                      )}
                      <ActionForm action={setUserRoleAction.bind(null, u.id, u.role === "admin" ? "member" : "admin")}>
                        <Submit variant="ghost" pendingText="…" className="px-2.5 py-1 text-xs">{u.role === "admin" ? "Jadikan anggota" : "Jadikan admin"}</Submit>
                      </ActionForm>
                      <ActionForm action={deleteUserAction.bind(null, u.id)}>
                        <Submit variant="danger" pendingText="…" className="px-2.5 py-1 text-xs">Hapus akun & workspace</Submit>
                      </ActionForm>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
