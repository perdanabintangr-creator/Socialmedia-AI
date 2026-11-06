-- Konten sebulan sekali klik + Mode ACC.
alter table public.ideas add column if not exists batch jsonb;            -- antrean rencana bulanan
alter table public.posts add column if not exists planned_at timestamptz; -- slot tayang dari rencana
alter table public.posts add column if not exists revising_since timestamptz; -- revisi AI sedang berjalan
