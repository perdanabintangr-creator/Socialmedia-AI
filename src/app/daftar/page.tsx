import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Submit } from "@/components/forms";
import { AuthShell } from "@/components/auth-shell";
import { Field, inputCls } from "@/components/ui";
import { currentUser } from "@/lib/session";
import { registerAction } from "../auth-actions";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await currentUser()) redirect("/");
  return (
    <AuthShell title="Daftar" subtitle="Buat akun baru. Akun aktif setelah disetujui admin.">
      <ActionForm action={registerAction} className="space-y-4" resetOnOk>
        <Field label="Nama">
          <input name="name" autoComplete="name" required className={inputCls} />
        </Field>
        <Field label="Email">
          <input type="email" name="email" autoComplete="email" required className={inputCls} />
        </Field>
        <Field label="Password" hint="Minimal 8 karakter.">
          <input type="password" name="password" autoComplete="new-password" minLength={8} required className={inputCls} />
        </Field>
        <Field label="Ulangi password">
          <input type="password" name="confirm" autoComplete="new-password" minLength={8} required className={inputCls} />
        </Field>
        <Submit className="w-full" pendingText="Mendaftar…">Daftar</Submit>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-500">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-semibold text-indigo-600 hover:underline">
          Masuk
        </Link>
      </p>
    </AuthShell>
  );
}
