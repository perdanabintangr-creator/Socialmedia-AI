"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Camera, Check, ImagePlus, Loader2, Music2, Palette, PenLine, Send, Sparkles } from "lucide-react";
import { Logo } from "./logo";
import { completeOnboardingAction, uploadLogoAction, type OnboardingInput } from "@/app/onboarding-actions";
import type { TemplateKey } from "@/lib/types";

const INDUSTRIES = ["Kuliner", "Fashion", "Kecantikan", "Kesehatan", "Pendidikan", "Jasa", "Properti", "Teknologi", "Hobi & kreatif", "Lainnya"];
const GOALS = ["Dikenal lebih luas", "Jualan", "Edukasi", "Bangun kepercayaan", "Komunitas"];
const AUDIENCE_HINTS = ["Mahasiswa & first jobber", "Ibu muda", "Pemilik UMKM", "Profesional kantoran", "Gen Z", "Keluarga"];

const TONES = [
  { key: "Santai & akrab, seperti ngobrol dengan teman. Pakai “kamu”, kalimat pendek.", label: "Santai & akrab", sample: "“Lagi cari kopi yang nggak bikin kantong bolong? Sini, kita kenalin.”" },
  { key: "Profesional & tepercaya, jelas dan to the point. Pakai “Anda”.", label: "Profesional", sample: "“Kami membantu bisnis Anda tampil konsisten di media sosial.”" },
  { key: "Hangat & inspiratif, penuh semangat dan empati.", label: "Hangat & inspiratif", sample: "“Setiap langkah kecil hari ini adalah awal dari mimpi besar besok.”" },
  { key: "Seru & jenaka, playful, boleh sedikit bercanda tapi tetap sopan.", label: "Seru & jenaka", sample: "“Senin lagi? Tenang, kopi kami siap jadi moodbooster resmi.”" },
];

const TEMPLATES: { key: TemplateKey; label: string; desc: string }[] = [
  { key: "mix", label: "Editorial", desc: "Cover gelap, isi terang. Elegan & mudah dibaca." },
  { key: "bold", label: "Bold", desc: "Warna penuh & bentuk dekoratif. Paling mencolok." },
  { key: "clean", label: "Clean", desc: "Minimalis terang. Rapi & profesional." },
];

const STEPS = ["Bisnis", "Audiens", "Gaya bahasa", "Visual", "Sosmed", "Selesai"];

export function Onboarding({ firstName, initial }: { firstName: string; initial: OnboardingInput }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingInput>(initial);
  const [palette, setPalette] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, startSaving] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof OnboardingInput>(k: K, v: OnboardingInput[K]) => setData((d) => ({ ...d, [k]: v }));

  const canNext = [
    data.name.trim().length >= 2 && Boolean(data.industry),
    data.audience.trim().length >= 3 && data.goals.length > 0,
    Boolean(data.tone),
    true,
    true,
    true,
  ][step];

  const next = () => {
    setError(null);
    if (!canNext) {
      setError(["Isi nama brand dan pilih bidang usaha.", "Ceritakan target audiens dan pilih minimal satu tujuan.", "Pilih satu gaya bahasa."][step] ?? null);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.set("logo", file);
    const res = await uploadLogoAction(fd);
    setUploading(false);
    if (res.error) return setError(res.error);
    set("logoUrl", res.url ?? null);
    const p = res.palette ?? [];
    setPalette(p);
    if (p[0]) setData((d) => ({ ...d, logoUrl: res.url ?? null, colors: { primary: p[0], accent: p[1] ?? d.colors.accent } }));
  };

  const finish = () =>
    startSaving(async () => {
      const res = await completeOnboardingAction(data);
      if (res?.error) setError(res.error);
    });

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Logo size={28} />
        <span className="text-sm font-semibold text-slate-500">
          Langkah {step + 1} dari {STEPS.length}
        </span>
      </header>

      <div className="mx-auto max-w-3xl px-5">
        <div className="flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full transition-colors ${i <= step ? "bg-brand-600" : "bg-line"}`} />
              <div className={`mt-2 hidden text-xs font-semibold sm:block ${i === step ? "text-ink" : "text-slate-400"}`}>{s}</div>
            </div>
          ))}
        </div>

        <main key={step} className="animate-fade-up py-10 sm:py-14">
          {step === 0 && (
            <Step title={`Halo ${firstName}! Ceritakan brand kamu`} sub="Ini membantu tim AI menulis dan mendesain sesuai bisnismu.">
              <Label text="Nama brand">
                <input value={data.name} onChange={(e) => set("name", e.target.value)} className={input} autoFocus />
              </Label>
              <Label text="Bidang usaha">
                <Chips options={INDUSTRIES} value={[data.industry]} onToggle={(v) => set("industry", v)} />
              </Label>
              <Label text="Apa yang kamu jual & apa keunggulannya?" hint="Makin detail, makin tepat kontennya. Contoh: kopi susu gula aren, harga mulai 18rb, biji kopi lokal Jawa Barat.">
                <textarea value={data.description} onChange={(e) => set("description", e.target.value)} rows={3} className={input} />
              </Label>
              <Label text="Username Instagram (opsional)">
                <div className="flex items-center rounded-xl bg-white ring-1 ring-line focus-within:ring-2 focus-within:ring-brand-500">
                  <span className="pl-3.5 text-sm text-slate-400">@</span>
                  <input value={data.handle} onChange={(e) => set("handle", e.target.value.replace(/^@+/, ""))} className="w-full bg-transparent px-1.5 py-2.5 text-sm outline-none" placeholder="brandkamu" />
                </div>
              </Label>
            </Step>
          )}

          {step === 1 && (
            <Step title="Siapa yang ingin kamu jangkau?" sub="Tim AI menyesuaikan topik dan bahasa untuk mereka.">
              <Label text="Target audiens">
                <textarea value={data.audience} onChange={(e) => set("audience", e.target.value)} rows={2} className={input} placeholder="Contoh: pekerja kantoran 22–35 tahun di Jakarta yang suka nongkrong" />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {AUDIENCE_HINTS.map((h) => (
                    <button key={h} type="button" onClick={() => set("audience", data.audience ? `${data.audience}, ${h.toLowerCase()}` : h)} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-line hover:ring-brand-300">
                      + {h}
                    </button>
                  ))}
                </div>
              </Label>
              <Label text="Tujuan konten kamu" hint="Boleh pilih lebih dari satu.">
                <Chips options={GOALS} value={data.goals} onToggle={(v) => set("goals", data.goals.includes(v) ? data.goals.filter((g) => g !== v) : [...data.goals, v])} />
              </Label>
            </Step>
          )}

          {step === 2 && (
            <Step title="Bagaimana brand kamu berbicara?" sub="Pilih gaya bahasa yang paling mirip. Bisa diubah kapan saja.">
              <div className="grid gap-3 sm:grid-cols-2">
                {TONES.map((t) => {
                  const on = data.tone === t.key;
                  return (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => set("tone", t.key)}
                      aria-pressed={on}
                      className={`rounded-2xl bg-white p-5 text-left transition ${on ? "shadow-lift ring-2 ring-brand-600" : "shadow-soft ring-1 ring-line hover:ring-brand-300"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{t.label}</span>
                        <span className={`grid h-5 w-5 place-items-center rounded-full ${on ? "bg-brand-600 text-white" : "ring-1 ring-line"}`}>{on && <Check size={13} />}</span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-500">{t.sample}</p>
                    </button>
                  );
                })}
              </div>
            </Step>
          )}

          {step === 3 && (
            <Step title="Tampilan brand kamu" sub="Upload logo, warna brand akan kami ambil otomatis.">
              <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="grid aspect-square place-items-center rounded-2xl bg-white p-4 text-center shadow-soft ring-1 ring-line ring-dashed hover:ring-brand-300"
                >
                  {uploading ? (
                    <Loader2 className="animate-spin text-brand-600" />
                  ) : data.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.logoUrl} alt="Logo brand" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-sm text-slate-500">
                      <ImagePlus className="mx-auto mb-2 text-slate-400" />
                      Upload logo
                      <span className="block text-xs text-slate-400">PNG transparan paling bagus</span>
                    </span>
                  )}
                </button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
                <div className="space-y-4">
                  {palette.length > 0 && (
                    <div>
                      <div className="mb-2 text-sm font-semibold text-slate-700">Warna dari logo kamu</div>
                      <div className="flex flex-wrap gap-2">
                        {palette.map((c) => (
                          <button key={c} type="button" title={`Jadikan warna utama ${c}`} onClick={() => set("colors", { ...data.colors, primary: c })} className="h-9 w-9 rounded-xl ring-1 ring-black/10 transition hover:scale-110" style={{ background: c }} />
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <ColorField label="Warna utama" value={data.colors.primary} onChange={(v) => set("colors", { ...data.colors, primary: v })} />
                    <ColorField label="Warna aksen" value={data.colors.accent} onChange={(v) => set("colors", { ...data.colors, accent: v })} />
                  </div>
                </div>
              </div>
              <Label text="Gaya desain">
                <div className="grid gap-3 sm:grid-cols-3">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => set("template", t.key)}
                      aria-pressed={data.template === t.key}
                      className={`rounded-2xl bg-white p-3 text-left transition ${data.template === t.key ? "shadow-lift ring-2 ring-brand-600" : "shadow-soft ring-1 ring-line hover:ring-brand-300"}`}
                    >
                      <TemplateThumb kind={t.key} primary={data.colors.primary} accent={data.colors.accent} />
                      <div className="mt-3 font-bold">{t.label}</div>
                      <div className="text-xs leading-relaxed text-slate-500">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </Label>
            </Step>
          )}

          {step === 4 && (
            <Step title="Hubungkan akun sosmed" sub="Supaya konten yang kamu ACC bisa terbit otomatis. Bisa juga dilewati dan diatur nanti.">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { name: "Instagram", icon: Camera, note: "Akun Business atau Creator" },
                  { name: "TikTok", icon: Music2, note: "Mode foto (carousel)" },
                ].map(({ name, icon: Icon, note }) => (
                  <div key={name} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-line">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-50 ring-1 ring-line">
                      <Icon size={20} />
                    </span>
                    <div>
                      <div className="font-bold">{name}</div>
                      <div className="text-xs text-slate-500">{note}</div>
                    </div>
                  </div>
                ))}
              </div>
              <label className={`flex cursor-pointer gap-3 rounded-2xl bg-white p-4 transition ${data.socialRequested ? "ring-2 ring-brand-600" : "ring-1 ring-line"}`}>
                <input type="checkbox" checked={data.socialRequested} onChange={(e) => set("socialRequested", e.target.checked)} className="mt-1 h-4 w-4 accent-brand-600" />
                <span className="text-sm leading-relaxed">
                  <span className="font-semibold">Ya, bantu hubungkan akun saya</span>
                  <span className="block text-slate-500">Tim kami akan memandu proses penghubungan. Sambil menunggu, desain tetap bisa dibuat dan diunduh.</span>
                </span>
              </label>
            </Step>
          )}

          {step === 5 && (
            <Step title="Tim kamu siap bekerja!" sub="Ini ringkasan Brand Kit kamu. Semua bisa diubah nanti di menu Brand Kit.">
              <div className="overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-line">
                <div className="flex items-center gap-4 p-5" style={{ background: `linear-gradient(120deg, ${data.colors.primary}14, transparent)` }}>
                  {data.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.logoUrl} alt="" className="h-14 w-14 rounded-xl bg-white object-contain p-1.5 ring-1 ring-line" />
                  ) : (
                    <span className="grid h-14 w-14 place-items-center rounded-xl text-lg font-bold text-white" style={{ background: data.colors.primary }}>
                      {data.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <div className="text-lg font-bold">{data.name}</div>
                    <div className="text-sm text-slate-500">
                      {data.industry}
                      {data.handle ? ` · @${data.handle}` : ""}
                    </div>
                  </div>
                  <div className="ml-auto flex gap-1.5">
                    <span className="h-7 w-7 rounded-lg ring-1 ring-black/10" style={{ background: data.colors.primary }} />
                    <span className="h-7 w-7 rounded-lg ring-1 ring-black/10" style={{ background: data.colors.accent }} />
                  </div>
                </div>
                <dl className="grid gap-4 border-t border-line p-5 text-sm sm:grid-cols-2">
                  <Summary k="Audiens" v={data.audience} />
                  <Summary k="Tujuan" v={data.goals.join(", ")} />
                  <Summary k="Gaya bahasa" v={TONES.find((t) => t.key === data.tone)?.label ?? "-"} />
                  <Summary k="Gaya desain" v={TEMPLATES.find((t) => t.key === data.template)?.label ?? "-"} />
                </dl>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { n: "Kata", i: PenLine, t: "from-amber-300 to-orange-400", d: "siap menulis" },
                  { n: "Rupa", i: Palette, t: "from-brand-400 to-brand-600", d: "siap mendesain" },
                  { n: "Siar", i: Send, t: "from-sky-400 to-blue-600", d: "siap menjadwalkan" },
                ].map(({ n, i: Icon, t, d }) => (
                  <div key={n} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-soft ring-1 ring-line">
                    <span className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br text-white ${t}`}>
                      <Icon size={18} />
                    </span>
                    <div className="text-sm">
                      <div className="font-bold">{n}</div>
                      <div className="text-slate-500">{d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Step>
          )}

          {error && (
            <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </p>
          )}

          <div className="mt-10 flex items-center justify-between">
            {step > 0 ? (
              <button type="button" onClick={() => setStep((s) => s - 1)} className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-white">
                <ArrowLeft size={16} /> Kembali
              </button>
            ) : (
              <span />
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={next} className="inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3 text-sm font-semibold text-white shadow-soft hover:bg-ink/85">
                {step === 4 && !data.socialRequested ? "Lewati dulu" : "Lanjut"} <ArrowRight size={16} />
              </button>
            ) : (
              <button type="button" onClick={finish} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lift hover:bg-brand-500 disabled:opacity-60">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {saving ? "Menyiapkan Studio…" : "Masuk ke Studio"}
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

const input =
  "w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-sm text-ink ring-1 ring-line shadow-[0_1px_2px_rgb(15_18_34/0.04)] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500";

function Step({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section>
      <h1 className="text-[28px] leading-tight font-extrabold tracking-tight sm:text-[32px]">{title}</h1>
      <p className="mt-2 text-[15px] text-slate-500">{sub}</p>
      <div className="mt-8 space-y-6">{children}</div>
    </section>
  );
}

function Label({ text, hint, children }: { text: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-slate-700">{text}</div>
      {children}
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{hint}</p>}
    </div>
  );
}

function Chips({ options, value, onToggle }: { options: string[]; value: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            aria-pressed={on}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${on ? "bg-ink text-white" : "bg-white text-slate-600 ring-1 ring-line hover:ring-brand-300"}`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-xl bg-white p-2.5 ring-1 ring-line">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-9 cursor-pointer rounded-lg border-0 bg-transparent" />
      <span className="text-sm">
        <span className="block font-semibold">{label}</span>
        <span className="font-mono text-xs text-slate-500 uppercase">{value}</span>
      </span>
    </label>
  );
}

function TemplateThumb({ kind, primary, accent }: { kind: TemplateKey; primary: string; accent: string }) {
  const dark = kind !== "clean";
  return (
    <div className="flex gap-1.5">
      {[0, 1, 2].map((i) => {
        const bg = kind === "bold" ? (i % 2 ? accent : primary) : kind === "mix" ? (i === 0 ? primary : "#F7F6F2") : "#F7F6F2";
        const fg = (kind === "mix" && i === 0) || kind === "bold" ? "#fff" : primary;
        return (
          <div key={i} className="flex aspect-[4/5] flex-1 flex-col justify-end gap-1 rounded-md p-1.5 ring-1 ring-black/5" style={{ background: bg }}>
            <span className="h-1 w-3/4 rounded-full" style={{ background: fg, opacity: 0.9 }} />
            <span className="h-1 w-1/2 rounded-full" style={{ background: dark && i === 0 ? accent : fg, opacity: 0.6 }} />
          </div>
        );
      })}
    </div>
  );
}

function Summary({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{k}</dt>
      <dd className="mt-1 font-medium">{v || "-"}</dd>
    </div>
  );
}
