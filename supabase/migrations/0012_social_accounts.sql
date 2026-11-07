-- Akun sosmed yang dihubungkan langsung (tanpa perantara), mis. Instagram API resmi.
-- Token hanya dibaca server (service role); RLS aktif tanpa policy = tertutup untuk klien.
create table if not exists public.social_accounts (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok')),
  account_id text not null,
  username text,
  token text not null,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, platform)
);
alter table public.social_accounts enable row level security;
create index if not exists posts_due_idx on public.posts (status, scheduled_at) where deleted_at is null;
