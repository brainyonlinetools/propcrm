-- Anand Prime CRM — Initial Schema
-- Apply via Supabase SQL Editor or: supabase db push

-- Updated_at trigger function
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Field definitions (drives dynamic forms)
create table if not exists public.field_definitions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('lead', 'inventory')),
  field_key text not null,
  label text not null,
  field_type text not null check (field_type in ('text', 'number', 'select', 'multiselect', 'date', 'phone', 'url', 'textarea', 'boolean')),
  options jsonb,
  is_required boolean default false,
  show_in_card boolean default true,
  sort_order int default 0,
  created_at timestamptz default now(),
  unique (entity_type, field_key)
);

-- Pipeline stages
create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  color text not null,
  sort_order int default 0
);

-- Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  created_at timestamptz default now()
);

-- Inventory (created before leads due to linked_unit_id FK)
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  unit_number text not null,
  unit_type text,
  area_sqft numeric,
  price numeric,
  status text default 'available' check (status in ('available', 'blocked', 'booked', 'sold')),
  custom_data jsonb default '{}',
  acquired_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Leads
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  stage_id uuid references public.pipeline_stages(id) on delete set null,
  source text,
  project_interest text,
  linked_unit_id uuid references public.inventory(id) on delete set null,
  custom_data jsonb default '{}',
  acquired_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Notes / Activity log
create table if not exists public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  content text not null,
  note_type text default 'note' check (note_type in ('note', 'call', 'visit', 'whatsapp')),
  created_at timestamptz default now()
);

-- Tasks
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  title text not null,
  due_date date,
  is_done boolean default false,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_field_definitions_entity on public.field_definitions(entity_type, sort_order);
create index if not exists idx_pipeline_stages_sort on public.pipeline_stages(sort_order);
create index if not exists idx_leads_stage_id on public.leads(stage_id);
create index if not exists idx_leads_project_interest on public.leads(project_interest);
create index if not exists idx_leads_acquired_date on public.leads(acquired_date);
create index if not exists idx_inventory_acquired_date on public.inventory(acquired_date);
create index if not exists idx_leads_linked_unit_id on public.leads(linked_unit_id);
create index if not exists idx_leads_updated_at on public.leads(updated_at desc);
create index if not exists idx_inventory_project_id on public.inventory(project_id);
create index if not exists idx_inventory_status on public.inventory(status);
create index if not exists idx_lead_notes_lead_id on public.lead_notes(lead_id);
create index if not exists idx_tasks_lead_id on public.tasks(lead_id);
create index if not exists idx_tasks_due_date on public.tasks(due_date);

-- Updated_at triggers
drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

drop trigger if exists inventory_updated_at on public.inventory;
create trigger inventory_updated_at
  before update on public.inventory
  for each row execute function public.set_updated_at();

-- RLS
alter table public.field_definitions enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.projects enable row level security;
alter table public.leads enable row level security;
alter table public.inventory enable row level security;
alter table public.lead_notes enable row level security;
alter table public.tasks enable row level security;

-- Open policies for single-user no-auth v1
create policy "anon_all" on public.field_definitions for all to anon using (true) with check (true);
create policy "anon_all" on public.pipeline_stages for all to anon using (true) with check (true);
create policy "anon_all" on public.projects for all to anon using (true) with check (true);
create policy "anon_all" on public.leads for all to anon using (true) with check (true);
create policy "anon_all" on public.inventory for all to anon using (true) with check (true);
create policy "anon_all" on public.lead_notes for all to anon using (true) with check (true);
create policy "anon_all" on public.tasks for all to anon using (true) with check (true);

-- Grants
grant usage on schema public to anon;
grant all on all tables in schema public to anon;
grant all on all sequences in schema public to anon;
alter default privileges in schema public grant all on tables to anon;

-- Seed: Pipeline stages
insert into public.pipeline_stages (label, color, sort_order) values
  ('New', '#888888', 0),
  ('Contacted', '#0070f3', 1),
  ('Site Visit', '#7928ca', 2),
  ('Negotiation', '#f5a623', 3),
  ('Closed (Won)', '#50e3c2', 4),
  ('Lost', '#ee0000', 5)
on conflict do nothing;

-- Seed: Projects
insert into public.projects (name, location) values
  ('Anand Prime Residences', 'Sector 62, Golf Course Extension Road, Gurugram'),
  ('Anand Prime Heights', 'Sector 150, Noida Expressway'),
  ('Anand Prime Vista', 'DLF Phase 5, Gurugram')
on conflict do nothing;

-- Seed: Field definitions — leads
insert into public.field_definitions (entity_type, field_key, label, field_type, options, is_required, show_in_card, sort_order) values
  ('lead', 'budget', 'Budget (₹ Cr)', 'number', null, false, true, 0),
  ('lead', 'configuration', 'Configuration', 'select', '["2BHK", "3BHK", "4BHK", "Penthouse"]', false, true, 1),
  ('lead', 'possession_preference', 'Possession Preference', 'select', '["Ready to Move", "Under Construction", "2025", "2026", "2027+"]', false, false, 2),
  ('lead', 'remarks', 'Remarks', 'textarea', null, false, false, 3)
on conflict (entity_type, field_key) do nothing;

-- Seed: Field definitions — inventory
insert into public.field_definitions (entity_type, field_key, label, field_type, options, is_required, show_in_card, sort_order) values
  ('inventory', 'floor', 'Floor', 'number', null, false, true, 0),
  ('inventory', 'facing', 'Facing', 'select', '["East", "West", "North", "South", "Corner"]', false, true, 1),
  ('inventory', 'car_parking', 'Car Parking Slots', 'number', null, false, false, 2),
  ('inventory', 'remarks', 'Remarks', 'textarea', null, false, false, 3)
on conflict (entity_type, field_key) do nothing;

-- Seed: Demo inventory units
insert into public.inventory (project_id, unit_number, unit_type, area_sqft, price, status, custom_data)
select
  p.id,
  v.unit_number,
  v.unit_type,
  v.area_sqft,
  v.price,
  v.status,
  v.custom_data::jsonb
from public.projects p
cross join (values
  ('Anand Prime Residences', 'A-1204', '3BHK', 1850, 28500000, 'available', '{"floor": 12, "facing": "East", "car_parking": 2}'),
  ('Anand Prime Residences', 'B-0802', '4BHK', 2400, 42000000, 'blocked', '{"floor": 8, "facing": "Corner", "car_parking": 3}'),
  ('Anand Prime Heights', 'T1-1501', '3BHK', 1650, 19500000, 'available', '{"floor": 15, "facing": "North", "car_parking": 2}'),
  ('Anand Prime Heights', 'T2-0503', '2BHK', 1250, 12500000, 'booked', '{"floor": 5, "facing": "West", "car_parking": 1}'),
  ('Anand Prime Vista', 'V-2201', 'Penthouse', 4200, 95000000, 'available', '{"floor": 22, "facing": "Corner", "car_parking": 4}'),
  ('Anand Prime Vista', 'V-1106', '4BHK', 2800, 55000000, 'sold', '{"floor": 11, "facing": "South", "car_parking": 3}')
) as v(project_name, unit_number, unit_type, area_sqft, price, status, custom_data)
where p.name = v.project_name
and not exists (
  select 1 from public.inventory i
  join public.projects pr on pr.id = i.project_id
  where pr.name = v.project_name and i.unit_number = v.unit_number
);

-- Seed: Demo leads
insert into public.leads (name, phone, email, stage_id, source, project_interest, custom_data)
select
  v.name,
  v.phone,
  v.email,
  ps.id,
  v.source,
  v.project_name,
  v.custom_data::jsonb
from (values
  ('Rajesh Malhotra', '9876543210', 'rajesh.m@email.com', 'Contacted', 'Meta', 'Anand Prime Residences', '{"budget": 2.8, "configuration": "3BHK", "possession_preference": "Ready to Move"}'),
  ('Priya Sharma', '9812345678', 'priya.sharma@email.com', 'Site Visit', 'Reference', 'Anand Prime Vista', '{"budget": 5.5, "configuration": "4BHK", "possession_preference": "2026"}'),
  ('Amit Khanna', '9988776655', null, 'New', 'Walk-in', 'Anand Prime Heights', '{"budget": 1.5, "configuration": "2BHK", "possession_preference": "Under Construction"}'),
  ('Neha Gupta', '9123456789', 'neha.g@email.com', 'Negotiation', 'Google', 'Anand Prime Residences', '{"budget": 4.2, "configuration": "4BHK", "possession_preference": "Ready to Move"}'),
  ('Vikram Singh', '9090909090', null, 'Closed (Won)', '99acres', 'Anand Prime Vista', '{"budget": 9.5, "configuration": "Penthouse", "possession_preference": "Ready to Move"}')
) as v(name, phone, email, stage_label, source, project_name, custom_data)
join public.pipeline_stages ps on ps.label = v.stage_label
where not exists (
  select 1 from public.leads l where l.phone = v.phone
);

-- Seed: Demo tasks
insert into public.tasks (lead_id, title, due_date, is_done)
select l.id, v.title, v.due_date::date, v.is_done
from (values
  ('9876543210', 'Follow up on site visit scheduling', (current_date + interval '1 day')::text, false),
  ('9812345678', 'Send brochure for Vista project', (current_date - interval '2 days')::text, false),
  ('9123456789', 'Discuss payment plan options', (current_date + interval '3 days')::text, false),
  ('9876543210', 'Initial enquiry call', (current_date - interval '5 days')::text, true)
) as v(phone, title, due_date, is_done)
join public.leads l on l.phone = v.phone
where not exists (
  select 1 from public.tasks t
  join public.leads ld on ld.id = t.lead_id
  where ld.phone = v.phone and t.title = v.title
);

-- Seed: Demo notes
insert into public.lead_notes (lead_id, content, note_type)
select l.id, v.content, v.note_type
from (values
  ('9876543210', 'Interested in 3BHK on higher floor with east facing.', 'note'),
  ('9876543210', 'Called — will visit this weekend.', 'call'),
  ('9812345678', 'Site visit completed. Liked the penthouse view.', 'visit'),
  ('9123456789', 'Sent payment plan via WhatsApp.', 'whatsapp')
) as v(phone, content, note_type)
join public.leads l on l.phone = v.phone
where not exists (
  select 1 from public.lead_notes n
  join public.leads ld on ld.id = n.lead_id
  where ld.phone = v.phone and n.content = v.content
);
