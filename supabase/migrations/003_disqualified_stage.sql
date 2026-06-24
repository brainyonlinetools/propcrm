-- Add Disqualified pipeline stage (archived leads)
insert into public.pipeline_stages (label, color, sort_order)
select 'Disqualified', '#6b7280', 6
where not exists (
  select 1 from public.pipeline_stages where label = 'Disqualified'
);
