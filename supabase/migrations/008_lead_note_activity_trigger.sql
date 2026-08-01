-- Bump lead updated_at when activity is logged so qualified leads sort by recent activity
create or replace function public.bump_lead_updated_at_on_note()
returns trigger
language plpgsql
as $$
begin
  update public.leads
  set updated_at = now()
  where id = new.lead_id;
  return new;
end;
$$;

drop trigger if exists lead_notes_bump_lead_updated_at on public.lead_notes;
create trigger lead_notes_bump_lead_updated_at
  after insert on public.lead_notes
  for each row execute function public.bump_lead_updated_at_on_note();
