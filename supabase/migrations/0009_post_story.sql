-- Versi Story 9:16 dari konten feed (frame, status, jadwal, file).
alter table public.posts add column if not exists story jsonb;
