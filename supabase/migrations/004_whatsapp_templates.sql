-- WhatsApp message templates for batch and single-lead messaging

create table if not exists public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger whatsapp_templates_updated_at
  before update on public.whatsapp_templates
  for each row execute function public.set_updated_at();

alter table public.whatsapp_templates enable row level security;

create policy "anon_all" on public.whatsapp_templates
  for all to anon using (true) with check (true);

insert into public.whatsapp_templates (name, body, sort_order)
select v.name, v.body, v.sort_order
from (values
  (
    'Follow-up',
    'Hi {{name}}, this is {{agent}} from Anand Prime. Following up regarding your enquiry about {{project}}.',
    0
  ),
  (
    'Site visit invite',
    'Hi {{name}}, this is {{agent}} from Anand Prime. We would love to schedule a site visit for {{project}}. Please let me know a convenient time.',
    1
  ),
  (
    'Brochure share',
    'Hi {{name}}, thank you for your interest in {{project}}. This is {{agent}} from Anand Prime. I am sharing the project brochure and payment plan details with you.',
    2
  )
) as v(name, body, sort_order)
where not exists (select 1 from public.whatsapp_templates limit 1);
