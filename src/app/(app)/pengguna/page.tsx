import Link from "next/link";
import { accounts } from "@/lib/db";
import { publicUser, requireAdmin, requireWorkspace } from "@/lib/session";
import { publishTarget } from "@/lib/pipeline";
import { ActionForm, Submit } from "@/components/forms";
import { Card, Field, PageTitle, formatWIB, inputCls } from "@/components/ui";
import { requestSocialAction } from "@/app/onboarding-actions";
import { changePasswordAction, deleteUserAction, setPublishKeyAction, setUserRoleAction, setUserStatusAction } from "@/app/auth-actions";

export const dynamic = "force-dynamic";

const STATUS = {
  pending: ["Menunggu persetujuan", "bg-amber-100 text-amber-800"],
  active: ["Aktif", "bg-emerald-100 text-emerald-800"],
  disabled: ["Nonaktif", "bg-slate-200 text-slate-600"],
} as const;

export default async function UsersPage() {
  const { user: me, w } = await requireWorkspace();
  const [brand, target] = await Promise.all([w.getBrand(), publishTarget(w.id)]);
  const isAdmin = me.role === "admin";
  const [allUsers, workspaces] = isAdmin ? await Promise.all([accounts().listUsers(), accounts().listWorkspaces()]) : [[], []];
  const users = allUsers.map(publicUser);
  const wsName = new Map(workspaces.map((x) => [x.id, x.name]));
  const wsKey = new Map(workspaces.map((x) => [x.id, x.publish_key]));
  if (isAdmin) await requireAdmin();
  const pending = users.filter((u) => u.status === "pending");

  return (
    <div className="space-y-6">
      <PageTitle title={isAdmin ? "Pengguna & klien" : "Akun"} subtitle={isAdmin ? "Setujui klien baru dan kelola akses. Isi konten tiap workspace bersifat pribadi milik klien." : "Pengaturan akun kamu."} />

      <Card className="scroll-mt-24" >
        <div id="sosmed" className="scroll-mt-24" />
        <h2 className="font-semibold">Akun sosmed</h2>
        <p className="mt-1 text-sm text-slate-500">Instagram (Business/Creator) dan TikTok untuk posting otomatis setelah kamu ACC.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${target.connected ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-600"}`}>
            <span className={`h-2 w-2 rounded-full ${target.connected ? "bg-emerald-500" : "bg-slate-400"}`} />
            {target.connected ? "Terhubung" : brand.socialRequested ? "Menunggu dihubungkan oleh tim kami" : "Belum terhubung"}
          </span>
          {!target.connected && !brand.socialRequested && (
            <ActionForm action={requestSocialAction}>
              <Submit variant="primary" pendingText="Mengirim…" className="py-2 text-xs">Minta dihubungkan</Submit>
            </ActionForm>
          )}
        </div>
        {!target.connected && <p className="mt-3 text-xs text-slate-500">Sambil menunggu, desain final tetap bisa dibuat dan diunduh untuk diposting manual.</p>}
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
