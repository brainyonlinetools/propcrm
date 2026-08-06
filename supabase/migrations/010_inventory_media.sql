-- Inventory media uploads + public share support
-- Creates inventory_notes if missing (006 may not have been applied), then opens anon RLS

-- Activity notes (from 006; safe if already present)
create table if not exists public.inventory_notes (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid references public.inventory(id) on delete cascade,
  content text not null,
  note_type text default 'note' check (note_type in ('note', 'call', 'visit', 'whatsapp')),
  created_at timestamptz default now()
);

alter table public.inventory_notes enable row level security;

drop policy if exists "Enable all for authenticated users" on public.inventory_notes;
drop policy if exists "anon_all" on public.inventory_notes;
create policy "anon_all" on public.inventory_notes
  for all to anon using (true) with check (true);

grant all on public.inventory_notes to anon;

-- Media table
create table if not exists public.inventory_media (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventory(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null check (media_type in ('image', 'video')),
  mime_type text not null,
  file_size bigint,
  caption text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_inventory_media_inventory_id
  on public.inventory_media(inventory_id, sort_order);

drop trigger if exists inventory_media_updated_at on public.inventory_media;
create trigger inventory_media_updated_at
  before update on public.inventory_media
  for each row execute function public.set_updated_at();

alter table public.inventory_media enable row level security;

drop policy if exists "anon_all" on public.inventory_media;
create policy "anon_all" on public.inventory_media
  for all to anon using (true) with check (true);

grant all on public.inventory_media to anon;
grant all on all sequences in schema public to anon;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'inventory-media',
  'inventory-media',
  true,
  104857600,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "inventory_media_anon_select" on storage.objects;
drop policy if exists "inventory_media_anon_insert" on storage.objects;
drop policy if exists "inventory_media_anon_update" on storage.objects;
drop policy if exists "inventory_media_anon_delete" on storage.objects;

create policy "inventory_media_anon_select"
on storage.objects for select to anon
using (bucket_id = 'inventory-media');

create policy "inventory_media_anon_insert"
on storage.objects for insert to anon
with check (bucket_id = 'inventory-media');

create policy "inventory_media_anon_update"
on storage.objects for update to anon
using (bucket_id = 'inventory-media')
with check (bucket_id = 'inventory-media');

create policy "inventory_media_anon_delete"
on storage.objects for delete to anon
using (bucket_id = 'inventory-media');
