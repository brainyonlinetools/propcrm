-- Convert project_interest from project FK to free text
-- Add acquired_date for leads and inventory (when the record was acquired, not uploaded)

alter table public.leads add column if not exists acquired_date date;
alter table public.inventory add column if not exists acquired_date date;

-- Migrate project_interest UUID values to project names, then change column type
alter table public.leads add column if not exists project_interest_text text;

update public.leads l
set project_interest_text = p.name
from public.projects p
where l.project_interest is not null
  and l.project_interest = p.id;

alter table public.leads drop constraint if exists leads_project_interest_fkey;
drop index if exists idx_leads_project_interest;

alter table public.leads drop column if exists project_interest;
alter table public.leads rename column project_interest_text to project_interest;

create index if not exists idx_leads_project_interest on public.leads(project_interest);
create index if not exists idx_leads_acquired_date on public.leads(acquired_date);
create index if not exists idx_inventory_acquired_date on public.inventory(acquired_date);
