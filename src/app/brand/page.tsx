import { db } from "@/lib/db";
import { ActionForm, Submit } from "@/components/forms";
import { Card, Field, PageTitle, inputCls } from "@/components/ui";
import { analyzeExamplesAction, saveBrandAction } from "../actions";
import type { Brand, FontKey } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const FONTS: [FontKey, string][] = [
  ["plus-jakarta-sans", "Plus Jakarta Sans"],
  ["poppins", "Poppins"],
  ["montserrat", "Montserrat"],
  ["inter", "Inter"],
  ["playfair-display", "Playfair Display (serif)"],
];
const COLORS: [keyof Brand["colors"], string, string][] = [
  ["primary", "Utama", "Latar slide cover & CTA"],
  ["secondary", "Sekunder", "Aksen di slide terang"],
  ["accent", "Aksen", "Highlight, label, garis"],
  ["background", "Latar terang", "Latar slide isi"],
  ["text", "Teks", "Warna teks di latar terang"],
];

export default async function BrandPage() {
  const brand = await db().getBrand();
  const v = Date.now();

  return (
    <div className="space-y-6">
      <PageTitle title="Brand Kit" subtitle="Diisi sekali. Semua ide, tulisan, dan desain AI mengikuti pedoman ini." />

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Preview desain dengan brand kit sekarang</h2>
          <span className="text-xs text-slate-500">Template: {brand.defaultTemplate}</span>
        </div>
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {[0, 1, 2, 3].map((i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={`/api/preview/${i}?v=${v}`} alt="" className="aspect-[4/5] w-[200px] shrink-0 rounded-lg bg-slate-100 ring-1 ring-slate-200" />
          ))}
        </div>
      </Card>

      <ActionForm action={saveBrandAction} className="space-y-6">
        <Card className="space-y-4">
          <h2 className="font-semibold">Identitas</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Nama brand"><input name="name" defaultValue={brand.name} className={inputCls} /></Field>
            <Field label="Handle sosmed"><input name="handle" defaultValue={brand.handle} className={inputCls} placeholder="@marqthink" /></Field>
            <Field label="Website"><input name="website" defaultValue={brand.website} className={inputCls} placeholder="marqthink.com" /></Field>
          </div>
          <Field label="Tentang brand / produk" hint="Apa yang dijual, keunggulan, fitur utama. Makin detail, makin akurat kontennya.">
            <textarea name="description" rows={4} defaultValue={brand.description} className={inputCls} />
          </Field>
          <Field label="Target audiens"><textarea name="audience" rows={2} defaultValue={brand.audience} className={inputCls} placeholder="Contoh: pemilik UMKM 25-40 th yang belum punya tim marketing" /></Field>
          <Field label="Gaya bahasa / tone"><textarea name="tone" rows={2} defaultValue={brand.tone} className={inputCls} /></Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Pilar konten" hint="Satu per baris."><textarea name="pillars" rows={4} defaultValue={brand.pillars.join("\n")} className={inputCls} /></Field>
            <Field label="Wajib / dilarang" hint="Mis. jangan sebut kompetitor, selalu pakai 'kamu'."><textarea name="doDont" rows={4} defaultValue={brand.doDont} className={inputCls} /></Field>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="CTA default"><input name="cta" defaultValue={brand.cta} className={inputCls} /></Field>
            <Field label="Hashtag brand (opsional)"><input name="hashtags" defaultValue={brand.hashtags.join(", ")} className={inputCls} /></Field>
            <Field label="Jam posting default (WIB)"><input type="time" name="postingTime" defaultValue={brand.postingTime} className={inputCls} /></Field>
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-semibold">Visual</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {COLORS.map(([k, label, hint]) => (
              <Field key={k} label={label} hint={hint}>
                <input type="color" name={`color_${k}`} defaultValue={brand.colors[k]} className="h-10 w-full cursor-pointer rounded-lg ring-1 ring-slate-300" />
              </Field>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Font judul">
              <select name="headingFont" defaultValue={brand.headingFont} className={inputCls}>
                {FONTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="Font isi">
              <select name="bodyFont" defaultValue={brand.bodyFont} className={inputCls}>
                {FONTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="Template default">
              <select name="defaultTemplate" defaultValue={brand.defaultTemplate} className={inputCls}>
                <option value="mix">Mix (cover bold, isi clean)</option>
                <option value="bold">Bold</option>
                <option value="clean">Clean</option>
              </select>
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <LogoField name="logo" removeName="removeLogo" url={brand.logoUrl} label="Logo utama" hint="PNG transparan paling bagus. Dipakai di slide berlatar warna utama (gelap)." />
              <LogoField name="logoAlt" removeName="removeLogoAlt" url={brand.logoAltUrl} label="Logo untuk latar terang (opsional)" hint="Upload jika logo utama berwarna putih/terang, supaya tetap terlihat di slide berlatar terang." />
            </div>
            <Field label="Contoh post yang disukai" hint="Upload 2–8 screenshot post (milik sendiri atau inspirasi). AI mempelajari gayanya.">
              <input type="file" name="examples" multiple accept="image/png,image/jpeg,image/webp" className="text-sm" />
            </Field>
          </div>
          {brand.exampleUrls.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {brand.exampleUrls.map((u) => (
                <label key={u} className="w-24 text-center text-xs text-slate-500">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="aspect-[4/5] w-24 rounded-lg object-cover ring-1 ring-slate-200" />
                  <span className="mt-1 flex items-center justify-center gap-1"><input type="checkbox" name="removeExample" value={u} /> hapus</span>
                </label>
              ))}
            </div>
          )}
          <Field label="Catatan gaya (diisi otomatis oleh AI dari contoh post, boleh diedit)">
            <textarea name="styleNotes" rows={5} defaultValue={brand.styleNotes} className={inputCls} />
          </Field>
        </Card>

        <div className="sticky bottom-4 flex justify-end">
          <Submit pendingText="Menyimpan…" className="shadow-lg">Simpan Brand Kit</Submit>
        </div>
      </ActionForm>

      {brand.exampleUrls.length > 0 && (
        <Card>
          <h2 className="font-semibold">Pelajari gaya dari contoh post</h2>
          <p className="mt-1 text-sm text-slate-500">AI melihat {brand.exampleUrls.length} contoh post lalu menulis catatan gaya & memilih template yang paling mirip.</p>
          <ActionForm action={analyzeExamplesAction} className="mt-3">
            <Submit variant="ghost" pendingText="AI sedang menganalisis…">🔍 Analisis contoh post</Submit>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}

function LogoField({ name, removeName, url, label, hint }: { name: string; removeName: string; url: string | null; label: string; hint: string }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-3">
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="logo" className="h-12 max-w-[140px] rounded bg-slate-300 object-contain p-1" />
        )}
        <input type="file" name={name} accept="image/png,image/jpeg,image/svg+xml,image/webp" className="text-sm" />
      </div>
      {url && <label className="mt-2 flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" name={removeName} /> Hapus</label>}
    </Field>
  );
}
