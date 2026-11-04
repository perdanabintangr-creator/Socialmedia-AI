import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Submit } from "@/components/forms";
import { AuthShell } from "@/components/auth-shell";
import { Field, inputCls } from "@/components/ui";
import { currentUser } from "@/lib/session";
import { registerAction } from "@/app/auth-actions";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await currentUser()) redirect("/studio");
  return (
    <AuthShell title="Mulai dengan tim AI kamu" subtitle="Buat workspace untuk brand kamu. Gratis untuk dicoba, tanpa kartu kredit.">
      <ActionForm action={registerAction} className="space-y-4">
        <Field label="Nama kamu">
          <input name="name" autoComplete="name" required className={inputCls} />
        </Field>
        <Field label="Nama brand / bisnis" hint="Bisa diubah kapan saja.">
          <input name="brand" autoComplete="organization" required className={inputCls} />
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
        <Submit className="w-full py-3" pendingText="Menyiapkan workspace…">Buat workspace</Submit>
        <p className="text-center text-xs leading-relaxed text-slate-400">Dengan mendaftar, kamu menyetujui Ketentuan Layanan & Kebijakan Privasi SosmedAutopilot.</p>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-500">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Masuk
        </Link>
      </p>
    </AuthShell>
  );
}
