-- Inventory notes / Activity log
create table if not exists public.inventory_notes (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid references public.inventory(id) on delete cascade,
  content text not null,
  note_type text default 'note' check (note_type in ('note', 'call', 'visit', 'whatsapp')),
  created_at timestamptz default now()
);

-- Enable RLS (default closed)
alter table public.inventory_notes enable row level security;

-- Allow all authenticated operations (matching existing pattern)
create policy "Enable all for authenticated users" on public.inventory_notes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');