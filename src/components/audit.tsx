"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ImagePlus, Loader2, Sparkles, Stethoscope, Wand2, X } from "lucide-react";
import { applyAuditAction, planFromAuditAction, runAuditAction, type AuditResult } from "@/app/audit-actions";

/** Form audit: link profil, tujuan, screenshot. */
export function AuditForm({ hasAudit }: { hasAudit: boolean }) {
  const router = useRouter();
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [res, setRes] = useState<AuditResult | null>(null);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(!hasAudit);

  const add = (list: FileList | File[]) =>
    setFiles((prev) => [...prev, ...[...list].filter((f) => f.type.startsWith("image/")).map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, 6));

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="bg-social inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-soft hover:brightness-105">
        <Stethoscope size={16} /> Audit ulang
      </button>
    );
  }

  return (
    <form
      className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-line sm:p-6"
      onPaste={(e) => {
        const imgs = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
        if (imgs.length) add(imgs);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        add(e.dataTransfer.files);
      }}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.delete("shots");
        files.forEach((f) => fd.append("shots", f.file));
        setRes(null);
        start(async () => {
          const r = await runAuditAction(fd);
          setRes(r);
          if (r.ok) {
            setFiles([]);
            setOpen(false);
            router.refresh();
          }
        });
      }}
    >
      <div className="flex items-start gap-3">
        <span className="bg-social grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white">
          <Stethoscope size={18} />
        </span>
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-ink">Audit akun oleh konsultan AI</h2>
          <p className="text-sm text-slate-500">Strategist, copywriter, dan art director menilai akunmu, lalu memberi skor, masalah + solusinya, bio baru, rencana aksi, dan ide konten.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Link profil Instagram / TikTok</span>
          <textarea
            name="links"
            rows={2}
            placeholder={"instagram.com/namaakun\ntiktok.com/@namaakun"}
            className="w-full resize-none rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm ring-1 ring-line outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-400"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Tujuan utama (opsional)</span>
          <textarea
            name="goal"
            rows={2}
            placeholder="Mis. “naikkan penjualan dari IG”, “tambah followers yang relevan”, “bangun kepercayaan sebelum launching”"
            className="w-full resize-none rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm ring-1 ring-line outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-400"
          />
        </label>
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-sm font-semibold text-slate-700">Screenshot profil (sangat disarankan)</p>
        <p className="mb-2 text-xs text-slate-500">
          Instagram & TikTok membatasi pembacaan profil dari luar, jadi screenshot membuat analisis jauh lebih akurat: halaman profil (bio + grid), beberapa post, dan halaman Insight bila ada. Bisa tempel (Ctrl+V) atau seret ke sini. Maks 6.
        </p>
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span key={f.url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={`Screenshot ${i + 1}`} className="h-24 w-16 rounded-lg object-cover ring-1 ring-line" />
              <button
                type="button"
                aria-label="Hapus screenshot"
                onClick={() => setFiles((p) => p.filter((x) => x !== f))}
                className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-white"
              >
                <X size={11} />
              </button>
            </span>
          ))}
          {files.length < 6 && (
            <label className="grid h-24 w-16 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-line text-slate-400 hover:border-brand-300 hover:text-brand-600">
              <ImagePlus size={18} />
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => e.target.files && add(e.target.files)} />
            </label>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="bg-social inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-soft hover:brightness-105 disabled:opacity-50">
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {pending ? "Konsultan sedang menganalisis… (±1 menit)" : "Mulai audit"}
        </button>
        {hasAudit && !pending && (
          <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-slate-500 hover:text-ink">
            Batal
          </button>
        )}
        {res && !res.ok && <p className="text-sm font-semibold text-red-600">{res.message}</p>}
      </div>
    </form>
  );
}

/** Tombol aksi hasil audit. */
export function AuditActions({ applied }: { applied: boolean }) {
  const router = useRouter();
  const [res, setRes] = useState<AuditResult | null>(null);
  const [pending, start] = useTransition();
  const [which, setWhich] = useState<string | null>(null);
  const run = (k: string, fn: () => Promise<AuditResult>) => {
    setWhich(k);
    start(async () => {
      const r = await fn();
      setRes(r);
      setWhich(null);
      if (r.ok) router.refresh();
    });
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run("apply", applyAuditAction)}
          className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white shadow-soft hover:bg-ink/90 disabled:opacity-50"
        >
          {which === "apply" ? <Loader2 size={15} className="animate-spin" /> : applied ? <Check size={15} /> : <Wand2 size={15} />}
          {applied ? "Terapkan ulang ke Brand Kit" : "Terapkan ke Brand Kit & otak AI"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("plan", planFromAuditAction)}
          className="bg-social inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-soft hover:brightness-105 disabled:opacity-50"
        >
          {which === "plan" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Jadikan rencana di Mode ACC
        </button>
      </div>
      {res && <p className={`mt-2 text-sm font-semibold ${res.ok ? "text-emerald-700" : "text-red-600"}`}>{res.message}</p>}
    </div>
  );
}

export function CopyText({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          // clipboard tidak tersedia
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-ink ring-1 ring-line hover:ring-brand-300"
    >
      {done ? <Check size={13} /> : <Copy size={13} />} {done ? "Tersalin" : "Salin"}
    </button>
  );
}
