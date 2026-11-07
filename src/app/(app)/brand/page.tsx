import { requireWorkspace } from "@/lib/session";
import Link from "next/link";
import { config } from "@/lib/config";
import { ActionForm, Submit } from "@/components/forms";
import { StylePickerField } from "@/components/style-picker";
import { DesignPickerField } from "@/components/design-picker";
import { Card, Field, PageTitle, inputCls } from "@/components/ui";
import { analyzeExamplesAction, colorsFromLogoAction, importWebsiteAction, saveBrandAction } from "@/app/actions";
import { FONT_KEYS, FONT_OPTIONS, TEMPLATE_KEYS, type Brand, type FontKey } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const FONTS: [FontKey, string][] = FONT_KEYS.map((k) => [k, FONT_OPTIONS[k].body ? FONT_OPTIONS[k].label : `${FONT_OPTIONS[k].label} (judul)`]);
const BODY_FONTS = FONTS.filter(([k]) => FONT_OPTIONS[k].body);
const COLORS: [keyof Brand["colors"], string, string][] = [
  ["primary", "Utama", "Latar slide cover & CTA"],
  ["secondary", "Sekunder", "Aksen di slide terang"],
  ["accent", "Aksen", "Highlight, label, garis"],
  ["background", "Latar terang", "Latar slide isi"],
  ["text", "Teks", "Warna teks di latar terang"],
];

const TEMPLATE_LABEL = { mix: "Brand", bold: "Bold", clean: "Clean", promo: "Promo", news: "Berita", folk: "Info cepat", editorial: "Editorial", creative: "Kreatif 3D" } as const;

export default async function BrandPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const { w } = await requireWorkspace();
  const brand = await w.getBrand();
  const { template } = await searchParams;
  const tpl = TEMPLATE_KEYS.find((x) => x === template) ?? brand.defaultTemplate;
  const v = Date.now();

  return (
    <div className="space-y-6">
      <PageTitle title="Brand Kit" subtitle="Diisi sekali. Semua ide, tulisan, dan desain AI mengikuti pedoman ini." />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Preview 11 layout dengan Brand Kit sekarang</h2>
            <p className="text-xs text-slate-500">
              {brand.assets.length ? "Foto diambil dari library foto brand." : "Foto contoh abstrak — upload foto brand atau hubungkan AI image / Pexels untuk foto asli."}
            </p>
          </div>
          <div className="flex gap-1">
            {TEMPLATE_KEYS.map((k) => (
              <Link key={k} href={`/brand?template=${k}`} className={`rounded-full px-3 py-1 text-xs font-semibold ${k === tpl ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
                {TEMPLATE_LABEL[k]}{k === brand.defaultTemplate ? " ✓" : ""}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {Array.from({ length: 17 }, (_, i) => (
            <a key={i} href={`/api/preview/${i}?template=${tpl}`} target="_blank" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/preview/${i}?template=${tpl}&v=${v}`} alt="" loading="lazy" className="aspect-[4/5] w-[200px] rounded-lg bg-slate-100 ring-1 ring-slate-200" />
            </a>
          ))}
        </div>
      </Card>

      <Card className="bg-gradient-to-br from-brand-50 to-white ring-brand-100">
        <h2 className="font-semibold">Isi otomatis dari website</h2>
        <p className="mt-1 text-sm text-slate-500">
          Tempel alamat website brand kamu. Tim AI membaca halamannya lalu mengisi logo, deskripsi, audiens, gaya bahasa, dan pilar konten yang masih kosong.
        </p>
        <ActionForm action={importWebsiteAction} className="mt-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input name="url" defaultValue={brand.website} placeholder="brandkamu.com" inputMode="url" className={`${inputCls} sm:flex-1`} />
            <Submit variant="accent" pendingText="Membaca website…">Isi otomatis</Submit>
          </div>
        </ActionForm>
      </Card>

      {brand.logoUrl && (
        <Card className="flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.logoUrl} alt="" className="h-12 w-12 rounded-xl bg-white object-contain p-1 ring-1 ring-line" />
          <div className="flex gap-1.5">
            {(["primary", "secondary", "accent", "background"] as const).map((k) => (
              <span key={k} title={k} className="h-8 w-8 rounded-lg ring-1 ring-black/10" style={{ background: brand.colors[k] }} />
            ))}
          </div>
          <p className="min-w-0 flex-1 text-sm text-slate-500">Warna desain harus senada dengan logo supaya vibes-nya pas.</p>
          <ActionForm action={colorsFromLogoAction}>
            <Submit variant="ghost" pendingText="Membaca warna logo…">🎨 Samakan warna dengan logo</Submit>
          </ActionForm>
        </Card>
      )}

      <ActionForm action={saveBrandAction} className="space-y-6">
        <Card className="space-y-4">
          <h2 className="font-semibold">Identitas</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Nama brand"><input name="name" defaultValue={brand.name} className={inputCls} /></Field>
            <Field label="Handle sosmed"><input name="handle" defaultValue={brand.handle} className={inputCls} placeholder="@brandkamu" /></Field>
            <Field label="Website"><input name="website" defaultValue={brand.website} className={inputCls} placeholder="brandkamu.com" /></Field>
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

        <Card className="scroll-mt-24 space-y-4">
          <div id="desain" className="scroll-mt-24">
            <h2 className="font-semibold">Desain konten</h2>
            <p className="mt-1 text-sm text-slate-500">Sistem desain ala desainer sosmed profesional. Pilih gaya, karakter huruf, dan seberapa banyak tulisan di slide — atau biarkan AI memilih yang paling cocok untuk brand kamu.</p>
          </div>
          <DesignPickerField defaults={{ pack: brand.designPack ?? "auto", pair: brand.fontPair ?? "auto", density: brand.density ?? "visual" }} />
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
          <div>
            <p className="mb-1.5 text-sm font-semibold text-slate-700">Arah visual default</p>
            <p className="mb-2 text-xs text-slate-500">Editorial & Promo memakai Design Pack (Editorial / Poster). Berita, Info cepat & Kreatif 3D memakai template khususnya sendiri.</p>
            <StylePickerField name="visualStyle" defaultValue={brand.visualStyle ?? "auto"} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Font judul" hint="Untuk template klasik. Design Pack memakai pasangan huruf di atas.">
              <select name="headingFont" defaultValue={brand.headingFont} className={inputCls}>
                {FONTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="Font isi">
              <select name="bodyFont" defaultValue={brand.bodyFont} className={inputCls}>
                {BODY_FONTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="Template default">
              <select name="defaultTemplate" defaultValue={brand.defaultTemplate} className={inputCls}>
                <option value="mix">Editorial (cover gelap, isi terang)</option>
                <option value="bold">Bold (warna penuh + bentuk dekoratif)</option>
                <option value="clean">Clean (minimalis terang)</option>
                <option value="promo">Promo (gaya iklan: warna kontras, starburst, stiker)</option>
                <option value="news">Media berita (foto + judul kapital, latar hitam)</option>
                <option value="folk">Info cepat (foto + panel putih)</option>
                <option value="editorial">Editorial majalah (close-up + serif italic)</option>
                <option value="creative">Kreatif 3D / AI (judul raksasa + tulisan tangan)</option>
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

        <Card className="space-y-4">
          <div>
            <h2 className="font-semibold">Foto & ilustrasi</h2>
            <p className="mt-1 text-xs text-slate-500">
              Status: AI image {config.imageProvider ? `aktif (${config.imageProvider})` : "belum aktif"} • Stok foto Pexels {config.hasStock ? "aktif" : "belum aktif"}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Sumber gambar">
              <select name="imageSource" defaultValue={brand.imageSource} className={inputCls}>
                <option value="auto">Otomatis (foto brand → AI image → stok foto)</option>
                <option value="ai">Utamakan AI image</option>
                <option value="stock">Hanya stok foto</option>
                <option value="brand">Hanya foto brand sendiri</option>
                <option value="none">Tanpa foto (grafis saja)</option>
              </select>
            </Field>
            <label className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
              <input type="checkbox" name="autoReview" defaultChecked={brand.autoReview} className="mt-1" />
              <span>
                <span className="font-medium">AI art director review</span>
                <span className="block text-xs text-slate-500">Setelah desain dibuat, AI melihat hasil render dan memperbaiki teks kepanjangan, layout monoton, atau foto yang kurang relevan sebelum dikirim ke kamu.</span>
              </span>
            </label>
          </div>
          <Field label="Art direction foto" hint="Pedoman gaya foto/ilustrasi untuk AI image & pemilihan stok foto.">
            <textarea name="imageStyle" rows={2} defaultValue={brand.imageStyle} className={inputCls} />
          </Field>
          <Field label="Library foto brand" hint="Foto produk, tim, kantor, event. AI memilih foto ini bila relevan — foto asli paling meyakinkan. Beri deskripsi singkat tiap foto.">
            <input type="file" name="assets" multiple accept="image/png,image/jpeg,image/webp" className="text-sm" />
          </Field>
          {brand.assets.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {brand.assets.map((a) => (
                <div key={a.id} className="flex gap-3 rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt="" className="h-20 w-16 shrink-0 rounded-md object-cover" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <textarea name={`asset_${a.id}`} defaultValue={a.description} rows={2} className={`${inputCls} text-xs`} placeholder="Deskripsi foto" />
                    <label className="flex items-center gap-1 text-xs text-red-600"><input type="checkbox" name="removeAsset" value={a.id} /> hapus</label>
                  </div>
                </div>
              ))}
            </div>
          )}
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
