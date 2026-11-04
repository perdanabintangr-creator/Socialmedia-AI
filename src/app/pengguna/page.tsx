import { db } from "@/lib/db";
import { publicUser, requireAdmin, requireUser } from "@/lib/session";
import { ActionForm, Submit } from "@/components/forms";
import { Card, Field, PageTitle, formatWIB, inputCls } from "@/components/ui";
import { changePasswordAction, deleteUserAction, setUserRoleAction, setUserStatusAction } from "../auth-actions";

export const dynamic = "force-dynamic";

const STATUS = {
  pending: ["Menunggu persetujuan", "bg-amber-100 text-amber-800"],
  active: ["Aktif", "bg-emerald-100 text-emerald-800"],
  disabled: ["Nonaktif", "bg-slate-200 text-slate-600"],
} as const;

export default async function UsersPage() {
  const me = await requireUser();
  const isAdmin = me.role === "admin";
  const users = isAdmin ? (await db().listUsers()).map(publicUser) : [];
  if (isAdmin) await requireAdmin();
  const pending = users.filter((u) => u.status === "pending");

  return (
    <div className="space-y-6">
      <PageTitle title="Akun" subtitle={isAdmin ? "Kelola pengguna yang bisa masuk ke Studio." : "Pengaturan akun kamu."} />

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
        <Card className="p-0">
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="font-semibold">Pengguna ({users.length})</h2>
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
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {u.email} · daftar {formatWIB(u.created_at)}
                      {u.last_login_at ? ` · login terakhir ${formatWIB(u.last_login_at)}` : ""}
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{u.role === "admin" ? "Admin" : "Anggota"}</span>
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
                        <Submit variant="danger" pendingText="…" className="px-2.5 py-1 text-xs">Hapus</Submit>
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
