-- Biaya AI per pekerjaan (Claude + pembuat gambar), per workspace & konten.
create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null,
  post_id uuid references public.posts(id) on delete set null,
  ai_usd numeric(12, 6) not null default 0,
  image_usd numeric(12, 6) not null default 0,
  images int not null default 0,
  ai_calls int not null default 0,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  detail text,
  created_at timestamptz not null default now()
);
alter table public.usage_logs enable row level security;
create index if not exists usage_logs_ws_idx on public.usage_logs (workspace_id, created_at desc);
create index if not exists usage_logs_created_idx on public.usage_logs (created_at desc);
create index if not exists usage_logs_post_idx on public.usage_logs (post_id);
