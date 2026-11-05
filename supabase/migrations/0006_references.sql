-- Referensi desain: owner bisa melampirkan contoh desain ("bikin seperti ini").
alter table public.messages add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.ideas add column if not exists reference jsonb;
alter table public.posts add column if not exists reference jsonb;
