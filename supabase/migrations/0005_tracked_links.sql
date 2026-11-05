-- Performa: link TikTok / Instagram yang dipantau per workspace. Angka dibaca otomatis.
create table if not exists public.tracked_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  platform text not null check (platform in ('tiktok', 'instagram')),
  kind text not null check (kind in ('post', 'profile')),
  url text not null,
  handle text,
  title text,
  thumbnail text,
  metrics jsonb,
  history jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'ok', 'error')),
  error text,
  post_id uuid references public.posts(id) on delete set null,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, url)
);
alter table public.tracked_links enable row level security;
create index if not exists tracked_links_ws_idx on public.tracked_links (workspace_id, created_at desc);
create index if not exists tracked_links_checked_idx on public.tracked_links (checked_at nulls first);
