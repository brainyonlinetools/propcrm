-- Secondary contact number for leads (multi-number imports).

alter table public.leads
  add column if not exists alt_phone text;

create index if not exists idx_leads_alt_phone on public.leads(alt_phone);
