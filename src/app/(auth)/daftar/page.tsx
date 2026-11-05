import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Submit } from "@/components/forms";
import { AuthShell, GoogleButton } from "@/components/auth-shell";
import { PasswordInput } from "@/components/password-input";
import { Field, inputCls } from "@/components/ui";
import { config } from "@/lib/config";
import { currentUser } from "@/lib/session";
import { registerAction } from "@/app/auth-actions";

export const metadata = { title: "Daftar" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await currentUser()) redirect("/beranda");
  return (
    <AuthShell
      title="Coba gratis"
      subtitle="Buat workspace untuk brand kamu. Tanpa kartu kredit."
      footer={
        <>
          Sudah punya akun?{" "}
          <Link href="/login" className="font-semibold text-brand-600 hover:underline">
            Masuk
          </Link>
        </>
      }
    >
      {config.hasGoogle && <GoogleButton label="Daftar dengan Google" />}
      <ActionForm action={registerAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama kamu">
            <input name="name" autoComplete="name" required className={inputCls} />
          </Field>
          <Field label="Nama brand">
            <input name="brand" autoComplete="organization" required className={inputCls} />
          </Field>
        </div>
        <Field label="Email">
          <input type="email" name="email" autoComplete="email" required className={inputCls} />
        </Field>
        <Field label="Password" hint="Minimal 8 karakter.">
          <PasswordInput name="password" autoComplete="new-password" minLength={8} required className={inputCls} />
        </Field>
        <Field label="Ulangi password">
          <PasswordInput name="confirm" autoComplete="new-password" minLength={8} required className={inputCls} />
        </Field>
        <Submit className="w-full py-3" pendingText="Menyiapkan workspace…">Buat workspace</Submit>
        <p className="text-center text-xs leading-relaxed text-slate-400">Dengan mendaftar, kamu menyetujui Ketentuan Layanan & Kebijakan Privasi SosmedAutopilot.</p>
      </ActionForm>
    </AuthShell>
  );
}
