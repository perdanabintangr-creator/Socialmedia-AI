import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { ActionForm, Submit } from "@/components/forms";
import { Card, Field, Pill, StatusBadge, formatWIB, inputCls } from "@/components/ui";
import { approvePostAction, checkStatusAction, rejectPostAction, revisePostAction, updatePostAction } from "../../actions";
import type { Post } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PRESETS = [
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
  const { id } = await params;
  const [post, brand] = await Promise.all([db().getPost(id), db().getBrand()]);
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
                  {!config.hasPublisher && (
                    <p className="text-xs text-slate-500">Auto-posting belum terhubung: desain final akan dibuat & bisa diunduh.</p>
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
              {post.status === "approved" && !config.hasPublisher && (
                <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  Auto-posting belum terhubung. Setelah AYRSHARE_API_KEY diisi, tombol kirim otomatis muncul di sini — atau unduh desain di atas untuk diposting manual.
                </p>
              )}
              {post.status === "approved" && config.hasPublisher && <SendApproved post={post} />}
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
      <details>
        <summary className="cursor-pointer font-semibold">Edit manual (teks, layout, template)</summary>
        <ActionForm action={updatePostAction.bind(null, post.id)} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Judul internal"><input name="title" defaultValue={post.title} className={inputCls} /></Field>
            <Field label="Template desain">
              <select name="template" defaultValue={post.template} className={inputCls}>
                <option value="mix">Mix (cover bold, isi clean)</option>
                <option value="bold">Bold (semua warna utama)</option>
                <option value="clean">Clean (latar terang)</option>
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
              <div className="grid gap-2 sm:grid-cols-[140px_1fr_120px]">
                <select name={`slide_${i}_layout`} defaultValue={s.layout} className={inputCls}>
                  <option value="cover">Cover</option>
                  <option value="point">Poin</option>
                  <option value="stat">Angka</option>
                  <option value="quote">Kutipan</option>
                  <option value="cta">CTA</option>
                </select>
                <input name={`slide_${i}_kicker`} defaultValue={s.kicker} placeholder="Label kecil" className={inputCls} />
                <input name={`slide_${i}_stat`} defaultValue={s.stat} placeholder="Angka" className={inputCls} />
              </div>
              <input name={`slide_${i}_headline`} defaultValue={s.headline} placeholder="Judul" className={`${inputCls} mt-2 font-semibold`} />
              <textarea name={`slide_${i}_body`} defaultValue={s.body} rows={2} placeholder="Teks pendukung" className={`${inputCls} mt-2`} />
            </fieldset>
          ))}
          <Submit pendingText="Menyimpan…">Simpan perubahan</Submit>
        </ActionForm>
      </details>
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
