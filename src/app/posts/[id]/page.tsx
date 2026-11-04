import { publishTarget } from "@/lib/pipeline";
import { requireWorkspace } from "@/lib/session";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Disclosure, Submit } from "@/components/forms";
import { Card, Field, Pill, StatusBadge, formatWIB, inputCls } from "@/components/ui";
import { approvePostAction, checkStatusAction, rejectPostAction, removeSlideImageAction, replaceImageAction, revisePostAction, updatePostAction, uploadSlideImageAction } from "../../actions";
import { ICON_NAMES } from "@/lib/icons";
import { PHOTO_LAYOUTS, SLIDE_LAYOUTS, type Post, type SlideLayout } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LAYOUT_LABEL: Record<SlideLayout, string> = {
  cover_photo: "Cover • foto penuh",
  cover_split: "Cover • foto + panel",
  cover_type: "Cover • tipografi",
  point_photo: "Poin + foto",
  point_icon: "Poin + ikon",
  list: "Checklist",
  steps: "Langkah",
  compare: "Perbandingan",
  stat: "Angka / chart",
  quote: "Kutipan",
  cta: "Penutup / CTA",
};

const SOURCE_LABEL = { ai: "AI image", stock: "Stok foto", brand: "Foto brand", upload: "Upload", demo: "Demo" } as const;

const PRESETS = [
  "Visualnya kurang wow, buat lebih eye-catching",
  "Ganti foto cover dengan yang lebih relevan",
  "Buat hook di slide pertama lebih nendang",
  "Bahasanya lebih santai",
  "Lebih singkat, kurangi teks di slide",
  "Tambah 1 slide contoh nyata",
  "Caption lebih persuasif untuk jualan",
];

function defaultSchedule(time: string) {
  const tomorrow = new Date(Date.now() + 24 * 3600_000);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(tomorrow);
  return `${date}T${time}`;
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { w } = await requireWorkspace();
  const target = await publishTarget(w.id);
  const { id } = await params;
  const [post, brand] = await Promise.all([w.getPost(id), w.getBrand()]);
  if (!post) notFound();
  const editable = post.status === "review" || post.status === "failed";
  const v = encodeURIComponent(post.updated_at);
  const images = post.media_urls.length
    ? post.media_urls
    : post.slides.map((_, i) => `/api/render/${post.id}/${i}?v=${v}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/posts" className="text-sm text-slate-500 hover:underline">← Semua konten</Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{post.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={post.status} />
            <Pill tone="indigo">{post.slides.length > 1 ? `Carousel • ${post.slides.length} slide` : "Single post"}</Pill>
            {post.platforms.map((p) => <Pill key={p}>{p === "instagram" ? "Instagram" : "TikTok"}</Pill>)}
            {post.revision_count > 0 && <Pill tone="amber">Revisi ke-{post.revision_count}</Pill>}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Preview */}
        <div className="space-y-4">
          <div className="flex snap-x gap-3 overflow-x-auto pb-2">
            {images.map((src, i) => (
              <a key={src} href={src} target="_blank" className="w-[260px] shrink-0 snap-start sm:w-[300px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Slide ${i + 1}`} className="aspect-[4/5] w-full rounded-xl bg-slate-200 object-cover shadow-sm ring-1 ring-slate-200" />
              </a>
            ))}
          </div>
          <Card>
            <h2 className="text-sm font-semibold text-slate-500">Caption</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{post.caption}</p>
            <p className="mt-3 text-sm text-indigo-600">{post.hashtags.map((h) => `#${h}`).join(" ")}</p>
          </Card>
          {post.design_notes && (
            <Card className="bg-indigo-50/60 ring-indigo-200">
              <h2 className="text-sm font-semibold text-indigo-900">🎨 Catatan AI art director</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm text-indigo-900/80">{post.design_notes}</p>
            </Card>
          )}
          {editable && <ImagePanel post={post} />}
          {editable && <EditForm post={post} />}
        </div>

        {/* Panel aksi */}
        <div className="space-y-4">
          {editable ? (
            <>
              <Card className="ring-2 ring-emerald-200">
                <h2 className="font-semibold">Sudah oke? ACC & posting</h2>
                <ActionForm action={approvePostAction.bind(null, post.id)} className="mt-3 space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="when" value="schedule" defaultChecked /> Jadwalkan
                  </label>
                  <input type="datetime-local" name="scheduledAt" defaultValue={defaultSchedule(brand.postingTime)} className={inputCls} />
                  <p className="-mt-1 text-xs text-slate-500">Waktu dalam WIB.</p>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="when" value="now" /> Posting sekarang
                  </label>
                  <Submit variant="approve" className="w-full" pendingText="Merender desain & mengirim…">✓ ACC konten</Submit>
                  {!target.connected && (
                    <p className="text-xs text-slate-500">{target.reason} Desain final tetap dibuat & bisa diunduh.</p>
                  )}
                </ActionForm>
              </Card>

              <Card>
                <h2 className="font-semibold">Minta revisi ke AI</h2>
                <ActionForm action={revisePostAction.bind(null, post.id)} className="mt-3 space-y-3" resetOnOk>
                  <textarea name="instruction" rows={3} className={inputCls} placeholder="Contoh: ganti contoh di slide 3 dengan kasus UMKM kuliner" />
                  <Submit className="w-full" pendingText="AI sedang merevisi…">↻ Revisi</Submit>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESETS.map((p) => (
                      <button key={p} name="preset" value={p} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200">{p}</button>
                    ))}
                  </div>
                </ActionForm>
              </Card>

              <ActionForm action={rejectPostAction.bind(null, post.id)}>
                <Submit variant="danger" className="w-full" pendingText="…">Tolak konten ini</Submit>
              </ActionForm>
            </>
          ) : (
            <Card>
              <h2 className="font-semibold">Status posting</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Status</dt><dd><StatusBadge status={post.status} /></dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Jadwal</dt><dd>{formatWIB(post.scheduled_at)}</dd></div>
                {post.publish_ref && <div className="flex justify-between gap-3"><dt className="text-slate-500">ID publisher</dt><dd className="truncate font-mono text-xs">{post.publish_ref}</dd></div>}
              </dl>
              {post.error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{post.error}</p>}
              {post.media_urls.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium">Desain final (JPEG)</h3>
                  <ul className="mt-1 space-y-1 text-sm">
                    {post.media_urls.map((u, i) => <li key={u}><a href={u} target="_blank" download className="text-indigo-600 hover:underline">Unduh slide {i + 1}</a></li>)}
                  </ul>
                </div>
              )}
              {post.status === "approved" && !target.connected && (
                <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  {target.reason} Setelah terhubung, tombol kirim otomatis muncul di sini. Sementara itu, unduh desain di atas untuk diposting manual.
                </p>
              )}
              {post.status === "approved" && target.connected && <SendApproved post={post} />}
              {post.publish_ref && (
                <ActionForm action={checkStatusAction.bind(null, post.id)} className="mt-3">
                  <Submit variant="ghost" className="w-full" pendingText="Mengecek…">Cek status di publisher</Submit>
                </ActionForm>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function EditForm({ post }: { post: Post }) {
  return (
    <Card>
      <Disclosure title="Edit manual (teks, layout, ikon, template)">
        <ActionForm action={updatePostAction.bind(null, post.id)} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Judul internal"><input name="title" defaultValue={post.title} className={inputCls} /></Field>
            <Field label="Template desain">
              <select name="template" defaultValue={post.template} className={inputCls}>
                <option value="mix">Editorial (cover gelap, isi terang)</option>
                <option value="bold">Bold (warna penuh + bentuk dekoratif)</option>
                <option value="clean">Clean (minimalis terang)</option>
              </select>
            </Field>
          </div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="platforms" value="instagram" defaultChecked={post.platforms.includes("instagram")} /> Instagram</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="platforms" value="tiktok" defaultChecked={post.platforms.includes("tiktok")} /> TikTok</label>
          </div>
          <Field label="Caption"><textarea name="caption" rows={6} defaultValue={post.caption} className={inputCls} /></Field>
          <Field label="Hashtag" hint="Pisahkan dengan spasi atau koma, maks 5."><input name="hashtags" defaultValue={post.hashtags.map((h) => `#${h}`).join(" ")} className={inputCls} /></Field>
          {post.slides.map((s, i) => (
            <fieldset key={i} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="mb-2 flex items-center justify-between">
                <legend className="text-sm font-semibold">Slide {i + 1}</legend>
                <label className="flex items-center gap-1 text-xs text-red-600"><input type="checkbox" name={`slide_${i}_delete`} /> hapus</label>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <select name={`slide_${i}_layout`} defaultValue={s.layout} className={inputCls}>
                  {SLIDE_LAYOUTS.map((l) => <option key={l} value={l}>{LAYOUT_LABEL[l]}</option>)}
                </select>
                <input name={`slide_${i}_kicker`} defaultValue={s.kicker} placeholder="Label / sticker" className={inputCls} />
                <select name={`slide_${i}_icon`} defaultValue={s.icon || "Lightbulb"} className={inputCls}>
                  {ICON_NAMES.map((n) => <option key={n} value={n}>Ikon: {n}</option>)}
                </select>
              </div>
              <input name={`slide_${i}_headline`} defaultValue={s.headline} placeholder="Judul (pakai *kata* untuk highlight)" className={`${inputCls} mt-2 font-semibold`} />
              <textarea name={`slide_${i}_body`} defaultValue={s.body} rows={2} placeholder="Teks pendukung" className={`${inputCls} mt-2`} />
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_120px]">
                <input name={`slide_${i}_labelA`} defaultValue={s.labelA} placeholder="Label kolom kiri (perbandingan)" className={inputCls} />
                <input name={`slide_${i}_labelB`} defaultValue={s.labelB} placeholder="Label kolom kanan" className={inputCls} />
                <input name={`slide_${i}_stat`} defaultValue={s.stat} placeholder="Angka" className={inputCls} />
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <textarea name={`slide_${i}_items`} defaultValue={s.items.join("\n")} rows={3} placeholder="Item list / langkah / kolom kiri (1 per baris)" className={inputCls} />
                <textarea name={`slide_${i}_itemsB`} defaultValue={s.itemsB.join("\n")} rows={3} placeholder="Kolom kanan perbandingan (1 per baris)" className={inputCls} />
              </div>
            </fieldset>
          ))}
          <Submit pendingText="Menyimpan…">Simpan perubahan</Submit>
        </ActionForm>
      </Disclosure>
    </Card>
  );
}

function toWibInput(iso: string) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

/** Konten yang di-ACC sebelum auto-post aktif: kirim sesuai jadwal yang tersimpan (atau sekarang jika sudah lewat). */
function SendApproved({ post }: { post: Post }) {
  const future = post.scheduled_at && new Date(post.scheduled_at).getTime() > Date.now() + 10 * 60_000;
  return (
    <ActionForm action={approvePostAction.bind(null, post.id)} className="mt-4">
      <input type="hidden" name="when" value={future ? "schedule" : "now"} />
      {future && <input type="hidden" name="scheduledAt" value={toWibInput(post.scheduled_at!)} />}
      <Submit variant="approve" className="w-full" pendingText="Mengirim…">
        {future ? "Jadwalkan ke Instagram & TikTok" : "Kirim ke Instagram & TikTok sekarang"}
      </Submit>
    </ActionForm>
  );
}

function ImagePanel({ post }: { post: Post }) {
  return (
    <Card>
      <h2 className="font-semibold">Gambar per slide</h2>
      <p className="mt-1 text-xs text-slate-500">Layout bertanda 📷 memakai foto. Tanpa foto, slide otomatis memakai versi grafis.</p>
      <div className="mt-3 divide-y divide-slate-100">
        {post.slides.map((s, i) => {
          const usesPhoto = PHOTO_LAYOUTS.includes(s.layout) || ["cover_type", "quote", "cta"].includes(s.layout);
          return (
            <div key={i} className="flex gap-3 py-3">
              {s.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image.url} alt="" className="h-20 w-16 shrink-0 rounded-md object-cover ring-1 ring-slate-200" />
              ) : (
                <div className="grid h-20 w-16 shrink-0 place-items-center rounded-md bg-slate-100 text-xs text-slate-400">{usesPhoto ? "tanpa foto" : "grafis"}</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {i + 1}. {LAYOUT_LABEL[s.layout]} {PHOTO_LAYOUTS.includes(s.layout) ? "📷" : ""}
                </div>
                <div className="truncate text-xs text-slate-500">
                  {s.image ? `${SOURCE_LABEL[s.image.source]}${s.image.credit ? ` • ${s.image.credit}` : ""}${s.image.query ? ` • “${s.image.query}”` : ""}` : usesPhoto ? "Belum ada foto — slide memakai versi grafis" : "Slide grafis (ikon/teks), tidak butuh foto"}
                </div>
                {usesPhoto && (
                  <div className="mt-2 flex flex-wrap items-start gap-2">
                    <ActionForm action={replaceImageAction.bind(null, post.id, i)} className="flex items-center gap-1">
                      <input name="query" placeholder="kata kunci (opsional)" className={`${inputCls} w-44 py-1.5 text-xs`} />
                      <Submit variant="ghost" pendingText="Mencari…" className="whitespace-nowrap px-2.5 py-1.5 text-xs">Ganti foto</Submit>
                    </ActionForm>
                    <ActionForm action={uploadSlideImageAction.bind(null, post.id, i)} className="flex items-center gap-1">
                      <input type="file" name="file" accept="image/*" className="w-48 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1.5 file:text-xs" />
                      <Submit variant="ghost" pendingText="…" className="px-2.5 py-1.5 text-xs">Upload</Submit>
                    </ActionForm>
                    {s.image && (
                      <ActionForm action={removeSlideImageAction.bind(null, post.id, i)}>
                        <Submit variant="danger" pendingText="…" className="px-2.5 py-1.5 text-xs">Hapus</Submit>
                      </ActionForm>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
