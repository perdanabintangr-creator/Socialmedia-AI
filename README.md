# Marqthink Social Autopilot

AI yang menjalankan sosmed Marqthink end-to-end: **brief → ide → konten (copy + desain) → posting otomatis ke Instagram & TikTok**. Owner cukup menekan **ACC** di 2 titik:

1. **ACC ide.** AI mengusulkan ide dari brief mingguan. Setelah di-ACC, AI langsung menulis caption dan menyusun slide.
2. **ACC konten.** Review desain dan caption, minta revisi ke AI (atau edit manual), lalu ACC. Desain final dirender jadi JPEG 1080×1350 dan dikirim ke Instagram & TikTok, langsung atau terjadwal.

## Cara kerja

| Bagian | Teknologi | File |
|---|---|---|
| Dashboard & approval | Next.js 15 (App Router, server actions) | `src/app/` |
| Otak konten (ide, copy, revisi, analisis contoh post) | Claude API (`claude-opus-5-5`, structured output) | `src/lib/ai.ts` |
| Desain otomatis | Template brand → PNG (next/og / satori) → JPEG (sharp) | `src/lib/templates.tsx`, `src/lib/render.tsx` |
| Database + storage gambar | Supabase (Postgres + Storage bucket publik `media`) | `src/lib/db.ts`, `supabase/migrations/` |
| Posting ke IG & TikTok | Ayrshare API | `src/lib/publisher.ts` |

Desain dibuat dari **template berbasis Brand Kit** (warna, font, logo), bukan gambar AI bebas. Hasilnya selalu on-brand dan tulisannya tidak typo. Ada 5 layout slide (cover, poin, angka, kutipan, CTA) dan 3 gaya template (mix, bold, clean).

Tanpa API key apa pun, aplikasi tetap jalan di **mode demo**: AI memakai contoh konten dan data disimpan di folder `.data/`. Mode ini berguna untuk mencoba alurnya.

## Menjalankan lokal

```bash
npm install
cp .env.example .env.local   # isi yang sudah ada
npm run dev
```

Buka http://localhost:3000. Di mode dev, `ADMIN_PASSWORD` boleh kosong.

## Setup produksi

1. **Supabase.** Buat project, lalu jalankan `supabase/migrations/0001_social_autopilot.sql` di SQL Editor. Isi `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API). Service role key hanya dipakai di server; tabel memakai RLS tanpa policy, jadi tidak bisa diakses publik.
2. **Claude.** Buat API key di https://platform.claude.com, lalu isi `ANTHROPIC_API_KEY`.
3. **Ayrshare** (auto-posting):
   - Daftar di https://www.ayrshare.com. Pilih paket yang mendukung Instagram + TikTok.
   - Di dashboard Ayrshare, **Social Accounts** → connect **Instagram** (harus akun Business/Creator yang terhubung ke Facebook Page) dan **TikTok**.
   - Salin API key ke `AYRSHARE_API_KEY`.
4. **Deploy ke Vercel.** Import repo ini, isi semua env dari `.env.example`, lalu deploy. Set `APP_URL` ke domain dashboard.

## Catatan

- Gambar final berformat **JPEG 4:5 (1080×1350)**. Instagram dan TikTok photo mode hanya menerima JPEG/WebP.
- Hashtag dibatasi maksimal 5 per post.
- Jadwal memakai zona waktu **WIB**. Jam default diatur di Brand Kit.
- Ganti provider posting (misalnya ke API resmi Meta/TikTok) cukup di `src/lib/publisher.ts`.
