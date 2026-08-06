-- Enforce unique lead phone numbers (normalized to last 10 digits).
-- First resolve existing duplicates by keeping the newest lead per phone key.

-- Preview duplicates (optional — run SELECT alone in SQL editor if you want to inspect first):
-- select
--   right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) as phone_key,
--   count(*) as lead_count,
--   array_agg(id order by coalesce(acquired_date, created_at::date) desc, created_at desc) as lead_ids,
--   array_agg(name order by coalesce(acquired_date, created_at::date) desc, created_at desc) as names
-- from public.leads
-- where phone is not null
--   and length(regexp_replace(phone, '\D', '', 'g')) >= 10
-- group by 1
-- having count(*) > 1;

-- Clear phone on older duplicate rows so the unique index can be created.
-- Newest lead (by acquired_date, then created_at) keeps the number.
with ranked as (
  select
    id,
    right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) as phone_key,
    row_number() over (
      partition by right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10)
      order by coalesce(acquired_date, created_at::date) desc, created_at desc, id desc
    ) as rn
  from public.leads
  where phone is not null
    and length(regexp_replace(phone, '\D', '', 'g')) >= 10
)
update public.leads l
set phone = null
from ranked r
where l.id = r.id
  and r.rn > 1;

create unique index if not exists idx_leads_phone_digits_unique
on public.leads (
  (right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10))
)
where phone is not null
  and length(regexp_replace(phone, '\D', '', 'g')) >= 10;
