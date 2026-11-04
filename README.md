# SosmedAutopilot

Tim agen AI yang menjalankan sosial media brand end-to-end: **brief → ide → konten (copy + desain) → posting otomatis ke Instagram & TikTok**. Owner cukup menekan **ACC** di 2 titik:

1. **ACC ide.** AI mengusulkan ide dari brief mingguan. Setelah di-ACC, AI langsung menulis caption dan menyusun slide.
2. **ACC konten.** Review desain dan caption, minta revisi ke AI (atau edit manual), lalu ACC. Desain final dirender jadi JPEG 1080×1350 dan dikirim ke Instagram & TikTok, langsung atau terjadwal.

## Halaman untuk customer

| Halaman | Isi |
|---|---|
| `/` | Landing page publik: hero, cara kerja, tim AI, contoh hasil (render asli), fitur, harga, FAQ |
| `/daftar`, `/login`, `/lupa-password` | Akun customer. Pendaftar langsung aktif dan mendapat workspace sendiri |
| `/onboarding` | 6 langkah: bisnis → audiens & tujuan → gaya bahasa → logo (warna diambil otomatis) & gaya desain → sosmed → ringkasan |
| `/studio` | Chat dengan tim agen; kartu konten bisa dibuka **di mockup HP** |
| `/posts/[id]` | Review konten di **mockup Instagram/TikTok** (bisa digeser), ACC & jadwal, revisi per slide atau caption saja |
| `/posts`, `/ideas`, `/dashboard`, `/brand`, `/pengguna` | Konten, ide, ringkasan, Brand Kit, akun |

Harga di landing page masih **contoh**; ubah di `src/lib/pricing.ts`. Gambar contoh di landing (`public/showcase/`) adalah hasil render asli mesin desain dengan brand fiktif.

## Studio: ngobrol dengan tim agen AI

Halaman utama adalah **Studio**, chat dengan tiga agen:

| Agen | Peran |
|---|---|
| **Kata** | Strategi & naskah: ide, hook, isi slide, caption |
| **Rupa** | Desain & visual: layout, foto, ikon, review hasil render |
| **Siar** | Jadwal & posting: render final, jadwal, posting ke Instagram & TikTok |

Cukup ketik arahan, misalnya "buatkan 5 ide konten minggu ini", "bikin carousel tentang tips branding", "revisi: hook-nya lebih nendang", "ACC, jadwalkan besok jam 7 malam", atau "apa jadwal minggu ini?". Claude membaca maksudnya, lalu agen yang tepat mengerjakan di latar belakang dan melaporkan progresnya langsung di chat. Hasilnya muncul sebagai kartu: daftar ide dengan tombol ACC/Tolak, dan preview carousel dengan tombol ACC & jadwalkan / Posting sekarang / Revisi.

Halaman Ringkasan, Ide, Konten, dan Brand Kit tetap ada untuk pemantauan dan edit manual.

## Akun, klien & workspace

- **/daftar**: klien mengisi nama, **nama brand/bisnis**, email, dan password. Setiap pendaftar otomatis mendapat **workspace sendiri**: Brand Kit, chat dengan tim agen, ide, konten, gambar, dan jadwal yang terpisah total dari klien lain.
- Pendaftar **pertama** otomatis menjadi **admin** (owner aplikasi). Klien berikutnya berstatus *menunggu persetujuan*.
- Halaman **Pengguna** (`/pengguna`), khusus admin:
  - menyetujui, menonaktifkan, atau mengubah peran akun;
  - **menghubungkan akun sosmed klien** (Ayrshare *Profile Key*);
  - menghapus klien beserta workspace-nya.
  Admin melihat daftar klien, tapi tidak melihat isi konten mereka.
- **Isolasi data:** semua query selalu difilter per workspace, termasuk akses langsung lewat id/URL. Ini dites otomatis: klien B mendapat 404 saat membuka konten klien A.
- **Auto-posting per klien:** konten klien hanya diposting ke akun sosmed yang terhubung ke workspace-nya. Tanpa Profile Key, desain hanya bisa diunduh, jadi tidak pernah terposting ke akun orang lain. Workspace milik admin memakai akun Ayrshare utama.
- Login memakai email + password (scrypt). Sesi berupa cookie bertanda tangan (HMAC dengan `SESSION_SECRET`), berlaku 30 hari.

## Cara kerja

| Bagian | Teknologi | File |
|---|---|---|
| Studio chat + dashboard | Next.js 15 (App Router, server actions, `after()` untuk job latar belakang) | `src/app/`, `src/components/studio.tsx` |
| Orkestrator tim agen | Claude memilih aksi, lalu pipeline dijalankan per agen | `src/lib/studio.ts`, `src/lib/pipeline.ts` |
| Otak konten: strategi, copy, art direction, revisi | Claude API (`claude-opus-5-5`, structured output) | `src/lib/ai.ts` |
| AI art director (review visual otomatis) | Claude vision melihat hasil render lalu memperbaiki | `src/lib/ai.ts` → `reviewDesign` |
| Desain otomatis | 11 layout × 3 gaya → PNG (next/og / satori) → JPEG (sharp) | `src/lib/templates.tsx`, `src/lib/render.tsx` |
| Foto & ilustrasi | Foto brand → AI image (Gemini / OpenAI) → stok Pexels | `src/lib/images.ts` |
| Database + storage | Supabase (Postgres + bucket publik `media`) | `src/lib/db.ts`, `supabase/migrations/` |
| Posting ke IG & TikTok | Ayrshare API | `src/lib/publisher.ts` |

### Sistem visual

Untuk tiap slide, Claude bertindak sebagai art director: memilih layout, menentukan foto (dari library foto brand, prompt AI image, atau kata kunci stok foto), memilih ikon, dan menandai kata kunci untuk di-highlight. Desain dirender dari template berbasis Brand Kit, jadi warna, font, dan logo selalu konsisten dan teks tidak pernah typo.

- **11 layout:** cover foto penuh, cover foto + panel, cover tipografi + foto berbingkai, poin + foto, poin + ikon, checklist, langkah bernomor, perbandingan (mitos vs fakta), angka + ring chart, kutipan + foto, CTA.
- **3 gaya:** Editorial (cover gelap, isi terang), Bold (warna penuh + bentuk dekoratif), Clean (minimalis).
- Layout foto yang tidak mendapat foto otomatis berubah ke varian grafis, jadi tidak pernah ada slide rusak.
- **AI art director review** (bisa dimatikan di Brand Kit): setelah render, Claude melihat gambarnya dan memperbaiki teks kepanjangan, layout monoton, atau foto yang kurang relevan.
- Di halaman review, tiap slide bisa **ganti foto** (dengan kata kunci baru), **upload foto sendiri**, atau **hapus foto**.

Tanpa API key apa pun, aplikasi tetap jalan di **mode demo**: AI memakai contoh konten, foto diambil dari library foto brand (atau gambar abstrak), dan data disimpan di `.data/`.

## Menjalankan lokal

```bash
npm install
cp .env.example .env.local   # isi yang sudah ada
npm run dev
```

Buka http://localhost:3000. Daftar akun pertama di `/daftar`; akun itu otomatis menjadi admin.

## Setup produksi

1. **Supabase.** Buat project, lalu jalankan `supabase/migrations/0001_social_autopilot.sql` di SQL Editor. Isi `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API). Service role key hanya dipakai di server; tabel memakai RLS tanpa policy, jadi tidak bisa diakses publik.
2. **Claude.** Buat API key di https://platform.claude.com, lalu isi `ANTHROPIC_API_KEY`.
3. **Gambar** (minimal satu agar foto otomatis):
   - **AI image:** isi `GEMINI_API_KEY` (Google AI Studio) atau `OPENAI_API_KEY`. AI image paling bagus untuk visual custom yang on-brand.
   - **Stok foto:** isi `PEXELS_API_KEY` (gratis di https://www.pexels.com/api/). Dipakai sebagai cadangan atau bila mode "stok" dipilih.
   - **Foto brand:** upload di Brand Kit → Library foto brand. Foto asli selalu diprioritaskan bila relevan.
4. **Ayrshare** (auto-posting):
   - Daftar di https://www.ayrshare.com. Pilih paket yang mendukung Instagram + TikTok.
   - Di dashboard Ayrshare, **Social Accounts** → connect **Instagram** (harus akun Business/Creator yang terhubung ke Facebook Page) dan **TikTok**.
   - Salin API key ke `AYRSHARE_API_KEY`.
5. **Deploy ke Vercel.** Import repo ini, isi semua env dari `.env.example`, lalu deploy. Set `APP_URL` ke domain dashboard.

## Catatan

- Gambar final berformat **JPEG 4:5 (1080×1350)**. Instagram dan TikTok photo mode hanya menerima JPEG/WebP.
- Hashtag dibatasi maksimal 5 per post.
- Jadwal memakai zona waktu **WIB**. Jam default diatur di Brand Kit.
- Ganti provider posting (misalnya ke API resmi Meta/TikTok) cukup di `src/lib/publisher.ts`.
