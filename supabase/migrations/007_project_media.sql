-- Project pages with fixed brochure fields and media uploads

alter table public.projects
  add column if not exists region text,
  add column if not exists status text,
  add column if not exists land_area text,
  add column if not exists total_towers text,
  add column if not exists sizes text,
  add column if not exists usps text,
  add column if not exists updated_at timestamptz default now();

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.field_definitions
  drop constraint if exists field_definitions_entity_type_check;

alter table public.field_definitions
  add constraint field_definitions_entity_type_check
  check (entity_type in ('lead', 'inventory', 'project'));

create table if not exists public.project_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null check (media_type in ('image', 'video')),
  mime_type text not null,
  file_size bigint,
  caption text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_project_media_project_id on public.project_media(project_id, sort_order);

drop trigger if exists project_media_updated_at on public.project_media;
create trigger project_media_updated_at
  before update on public.project_media
  for each row execute function public.set_updated_at();

alter table public.project_media enable row level security;

drop policy if exists "anon_all" on public.project_media;
create policy "anon_all" on public.project_media for all to anon using (true) with check (true);

grant all on public.project_media to anon;
grant all on all sequences in schema public to anon;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'project-media',
  'project-media',
  true,
  104857600,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "project_media_anon_select" on storage.objects;
drop policy if exists "project_media_anon_insert" on storage.objects;
drop policy if exists "project_media_anon_update" on storage.objects;
drop policy if exists "project_media_anon_delete" on storage.objects;

create policy "project_media_anon_select"
on storage.objects for select to anon
using (bucket_id = 'project-media');

create policy "project_media_anon_insert"
on storage.objects for insert to anon
with check (bucket_id = 'project-media');

create policy "project_media_anon_update"
on storage.objects for update to anon
using (bucket_id = 'project-media')
with check (bucket_id = 'project-media');

create policy "project_media_anon_delete"
on storage.objects for delete to anon
using (bucket_id = 'project-media');
