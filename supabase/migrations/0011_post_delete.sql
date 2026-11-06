-- Hapus konten (lunak): hilang dari aplikasi, tetap dihitung di kuota paket.
alter table public.posts add column if not exists deleted_at timestamptz;
