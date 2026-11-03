-- Marqthink Social Autopilot — skema database
-- Semua akses lewat server (service role). RLS aktif tanpa policy = anon/public tidak bisa baca/tulis.

create table if not exists public.brand (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  hook text not null default '',
  angle text not null default '',
  pillar text not null default '',
  format text not null check (format in ('single', 'carousel')),
  rationale text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  feedback text,
  post_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid references public.ideas(id) on delete set null,
  title text not null,
  format text not null check (format in ('single', 'carousel')),
  platforms text[] not null default '{instagram,tiktok}',
  caption text not null default '',
  hashtags text[] not null default '{}',
  slides jsonb not null default '[]'::jsonb,
  template text not null default 'mix',
  status text not null default 'review'
    check (status in ('review', 'approved', 'scheduled', 'published', 'failed', 'rejected')),
  scheduled_at timestamptz,
  media_urls text[] not null default '{}',
  publish_ref text,
  publish_result jsonb,
  error text,
  revision_count int not null default 0,
  design_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ideas
  add constraint ideas_post_id_fkey foreign key (post_id) references public.posts(id) on delete set null;

create index if not exists ideas_status_idx on public.ideas (status, created_at desc);
create index if not exists posts_status_idx on public.posts (status, created_at desc);

alter table public.brand enable row level security;
alter table public.ideas enable row level security;
alter table public.posts enable row level security;

-- Bucket publik untuk gambar final: Instagram/TikTok (via Ayrshare) harus bisa mengunduh URL-nya.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;
