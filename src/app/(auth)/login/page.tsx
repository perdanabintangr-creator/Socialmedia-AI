import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Submit } from "@/components/forms";
import { AuthShell } from "@/components/auth-shell";
import { Field, inputCls } from "@/components/ui";
import { currentUser } from "@/lib/session";
import { loginAction } from "@/app/auth-actions";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentUser()) redirect("/studio");
  return (
    <AuthShell title="Selamat datang kembali" subtitle="Masuk untuk melanjutkan kerja bareng tim AI kamu.">
      <ActionForm action={loginAction} className="space-y-4">
        <Field label="Email">
          <input type="email" name="email" autoComplete="email" required autoFocus className={inputCls} />
        </Field>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-semibold text-slate-700">Password</label>
            <Link href="/lupa-password" className="text-xs font-semibold text-brand-600 hover:underline">Lupa password?</Link>
          </div>
          <input id="password" type="password" name="password" autoComplete="current-password" required className={inputCls} />
        </div>
        <Submit className="w-full py-3" pendingText="Masuk…">Masuk</Submit>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-500">
        Belum punya akun?{" "}
        <Link href="/daftar" className="font-semibold text-brand-600 hover:underline">
          Coba gratis
        </Link>
      </p>
    </AuthShell>
  );
}
