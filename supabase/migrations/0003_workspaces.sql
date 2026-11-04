-- Multi-tenant: setiap klien punya workspace sendiri.
-- Semua data konten (brand, ide, konten, chat, job) terikat ke workspace dan ikut terhapus bila workspace dihapus.
-- Catatan: migrasi ini juga mengosongkan data contoh/demo yang ada sebelumnya.

truncate table public.ideas, public.posts, public.messages, public.jobs, public.brand;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references public.users(id) on delete set null,
  publish_key text, -- Ayrshare Profile-Key: akun sosmed milik klien ini
  created_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;

alter table public.users
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

-- Brand Kit: satu per workspace (sebelumnya satu baris global).
drop table if exists public.brand;
create table public.brand (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.brand enable row level security;

alter table public.ideas add column workspace_id uuid not null references public.workspaces(id) on delete cascade;
alter table public.posts add column workspace_id uuid not null references public.workspaces(id) on delete cascade;
alter table public.messages add column workspace_id uuid not null references public.workspaces(id) on delete cascade;
alter table public.jobs add column workspace_id uuid not null references public.workspaces(id) on delete cascade;

drop index if exists public.ideas_status_idx;
drop index if exists public.posts_status_idx;
drop index if exists public.messages_created_idx;
create index ideas_ws_idx on public.ideas (workspace_id, created_at desc);
create index posts_ws_idx on public.posts (workspace_id, created_at desc);
create index messages_ws_idx on public.messages (workspace_id, created_at desc);
create index jobs_ws_running_idx on public.jobs (workspace_id, status, created_at desc);
create index users_ws_idx on public.users (workspace_id);
