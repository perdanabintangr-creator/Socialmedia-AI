import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Submit } from "@/components/forms";
import { AuthShell, GoogleButton } from "@/components/auth-shell";
import { PasswordInput } from "@/components/password-input";
import { Field, inputCls } from "@/components/ui";
import { config } from "@/lib/config";
import { currentUser } from "@/lib/session";
import { loginAction } from "@/app/auth-actions";

export const metadata = { title: "Masuk" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  google: "Login Google gagal. Coba lagi atau masuk dengan email.",
  disabled: "Akun ini dinonaktifkan. Hubungi kami.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentUser()) redirect("/beranda");
  const err = ERRORS[(await searchParams).error ?? ""];
  return (
    <AuthShell
      title="Masuk ke SosmedAutopilot"
      subtitle="Lanjutkan kerja bareng tim sosmed AI kamu."
      footer={
        <>
          Belum punya akun?{" "}
          <Link href="/daftar" className="font-semibold text-brand-600 hover:underline">
            Daftar gratis
          </Link>
        </>
      }
    >
      {err && <p role="alert" className="mb-5 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">{err}</p>}
      {config.hasGoogle && <GoogleButton />}
      <ActionForm action={loginAction} className="space-y-4">
        <Field label="Email">
          <input type="email" name="email" autoComplete="email" required autoFocus className={inputCls} />
        </Field>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-semibold text-slate-700">Password</label>
            <Link href="/lupa-password" className="text-xs font-semibold text-slate-500 hover:text-brand-600">Lupa password?</Link>
          </div>
          <PasswordInput id="password" name="password" autoComplete="current-password" required className={inputCls} />
        </div>
        <Submit className="w-full py-3" pendingText="Masuk…">Masuk</Submit>
      </ActionForm>
    </AuthShell>
  );
}
