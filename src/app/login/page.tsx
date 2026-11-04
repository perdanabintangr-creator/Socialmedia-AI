import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Submit } from "@/components/forms";
import { AuthShell } from "@/components/auth-shell";
import { Field, inputCls } from "@/components/ui";
import { currentUser } from "@/lib/session";
import { loginAction } from "../auth-actions";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  return (
    <AuthShell title="Masuk" subtitle="Masuk ke Studio Social Media AI">
      <ActionForm action={loginAction} className="space-y-4">
        <Field label="Email">
          <input type="email" name="email" autoComplete="email" required autoFocus className={inputCls} />
        </Field>
        <Field label="Password">
          <input type="password" name="password" autoComplete="current-password" required className={inputCls} />
        </Field>
        <Submit className="w-full" pendingText="Masuk…">Masuk</Submit>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-500">
        Belum punya akun?{" "}
        <Link href="/daftar" className="font-semibold text-indigo-600 hover:underline">
          Daftar
        </Link>
      </p>
    </AuthShell>
  );
}
