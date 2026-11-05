-- Paket langganan per workspace. "free" = coba 3 konten kualitas dasar.
alter table public.workspaces add column if not exists plan text not null default 'free'
  check (plan in ('free', 'newbie', 'starter', 'growth', 'agency'));
