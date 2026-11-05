-- Banyak percakapan per workspace (Chat baru + riwayat di sidebar).
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null default 'Percakapan baru',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.chats enable row level security;
create index if not exists chats_ws_idx on public.chats (workspace_id, updated_at desc);

alter table public.messages add column if not exists chat_id uuid references public.chats(id) on delete cascade;
create index if not exists messages_chat_idx on public.messages (chat_id, created_at desc);
