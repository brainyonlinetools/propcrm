-- Sellers + linked inventory (012)
-- Sellers hold owner/unit data project-wise. Toggling available_for_sale
-- creates/updates a linked inventory row (inventory.seller_id).

create table if not exists public.sellers (
  id uuid primary key default gen_random_uuid(),
  owner_name text not null,
  contact_phone text,
  alt_phone text,
  email text,
  project_id uuid references public.projects(id) on delete set null,
  tower text,
  unit_number text,
  floor numeric,
  configuration text,
  area_sqft numeric,
  facing text,
  parking integer,
  asking_price numeric,
  available_for_sale boolean default false,
  remarks text,
  follow_up_date date,
  last_call_outcome text,
  last_called_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.seller_notes (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.sellers(id) on delete cascade,
  content text not null,
  note_type text default 'note' check (note_type in ('note', 'call', 'visit', 'whatsapp')),
  created_at timestamptz default now()
);

alter table public.inventory
  add column if not exists seller_id uuid references public.sellers(id) on delete set null;

-- One linked inventory unit per seller entry. Manual units have seller_id null.
create unique index if not exists idx_inventory_seller_id_unique
  on public.inventory(seller_id) where seller_id is not null;

create index if not exists idx_sellers_project_id on public.sellers(project_id);
create index if not exists idx_sellers_available on public.sellers(available_for_sale);
create index if not exists idx_sellers_follow_up_date on public.sellers(follow_up_date);
create index if not exists idx_seller_notes_seller_id on public.seller_notes(seller_id);

drop trigger if exists sellers_updated_at on public.sellers;
create trigger sellers_updated_at
  before update on public.sellers
  for each row execute function public.set_updated_at();

alter table public.sellers enable row level security;
alter table public.seller_notes enable row level security;

drop policy if exists "anon_all" on public.sellers;
drop policy if exists "anon_all" on public.seller_notes;
create policy "anon_all" on public.sellers for all to anon using (true) with check (true);
create policy "anon_all" on public.seller_notes for all to anon using (true) with check (true);

grant all on public.sellers to anon;
grant all on public.seller_notes to anon;
