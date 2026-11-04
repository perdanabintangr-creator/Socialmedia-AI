import Link from "next/link";
import { Mail } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Lupa password" };

export default function ForgotPasswordPage() {
  // Reset otomatis via email menyusul (butuh layanan email di backend).
  const support = process.env.SUPPORT_EMAIL;
  return (
    <AuthShell title="Lupa password?" subtitle="Tenang, akunmu aman. Kami bantu atur ulang password-nya.">
      <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-line">
        <div className="flex gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <Mail size={18} />
          </span>
          <div className="text-sm leading-relaxed text-slate-600">
            <p className="font-semibold text-ink">Hubungi tim SosmedAutopilot</p>
            <p className="mt-1">
              Kirim email dari alamat yang kamu pakai untuk mendaftar, sebutkan nama brand kamu, dan kami akan membantu mengatur ulang password.
            </p>
            {support && (
              <a href={`mailto:${support}?subject=Reset%20password%20SosmedAutopilot`} className="mt-3 inline-flex font-semibold text-brand-600 hover:underline">
                {support}
              </a>
            )}
          </div>
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">
        Sudah ingat?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Kembali masuk
        </Link>
      </p>
    </AuthShell>
  );
}
