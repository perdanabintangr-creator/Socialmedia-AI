# SosmedAutopilot

Tim agen AI yang menjalankan sosial media brand end-to-end: **brief → ide → konten (copy + desain) → posting otomatis ke Instagram & TikTok**. Owner cukup menekan **ACC** di 2 titik:

1. **ACC ide.** AI mengusulkan ide dari brief mingguan. Setelah di-ACC, AI langsung menulis caption dan menyusun slide.
2. **ACC konten.** Review desain dan caption, minta revisi ke AI (atau edit manual), lalu ACC. Desain final dirender jadi JPEG 1080×1350 dan dikirim ke Instagram & TikTok, langsung atau terjadwal.

## Halaman untuk customer

Alurnya mengikuti pola Marqthink: **landing → masuk → Beranda → chat**.

| Halaman | Isi |
|---|---|
| `/` | Landing page publik: label harga, demo chat yang bergerak, pita kata kunci berjalan, cara kerja, tim AI, contoh hasil (render asli), fitur, harga, FAQ |
| `/login`, `/daftar`, `/lupa-password` | Kartu di tengah, tombol lihat password, dan **Lanjut dengan Google** (muncul bila `GOOGLE_CLIENT_ID/SECRET` diisi). Pendaftar langsung aktif dan mendapat workspace sendiri |
| `/beranda` | Sapaan sesuai jam (WIB), kotak perintah besar (tiap kiriman membuka **percakapan baru**), 4 aksi cepat, checklist "Mulai di sini", dan percakapan terakhir |
| `/chat/[id]` | Satu percakapan dengan Kata, Rupa & Siar. Kartu ide/konten, ACC & jadwal, preview mockup HP |
| `/posts`, `/posts/[id]` | Hasil konten; review di mockup Instagram/TikTok, revisi per slide atau caption |
| `/kalender` | Kalender bulanan konten yang di-ACC/terjadwal/terbit (agenda di HP) |
| `/ideas`, `/brand`, `/onboarding`, `/pengguna` | Bank ide, Brand Kit, wizard Brand Kit, akun & akun sosmed |

Sidebar desktop berisi tombol **Chat baru**, menu utama, **riwayat percakapan**, brand, dan profil dengan badge paket. Di HP, navigasinya berupa tab bar bawah.

Harga di landing masih **contoh**; ubah di `src/lib/pricing.ts`.

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
