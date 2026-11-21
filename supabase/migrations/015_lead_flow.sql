-- Lead flow (015): explicit stage kinds, call-attempt tracking, close reasons, stage history.

-- 1. Stage kind replaces "first stage = raw" and label matching.
alter table public.pipeline_stages
  add column if not exists kind text not null default 'active';

alter table public.pipeline_stages
  drop constraint if exists pipeline_stages_kind_check;
alter table public.pipeline_stages
  add constraint pipeline_stages_kind_check
  check (kind in ('entry', 'active', 'won', 'lost', 'disqualified'));

update public.pipeline_stages set kind = 'entry' where label = 'New';
update public.pipeline_stages set kind = 'won' where label = 'Closed (Won)';
update public.pipeline_stages set kind = 'lost' where label = 'Lost';
update public.pipeline_stages set kind = 'disqualified' where label = 'Disqualified';

-- 2. Lead contact tracking + close reason.
alter table public.leads
  add column if not exists call_attempts integer not null default 0,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists close_reason text;

update public.leads l
set call_attempts = c.attempts,
    last_contacted_at = c.last_at
from (
  select lead_id, count(*)::int as attempts, max(created_at) as last_at
  from public.lead_notes
  where note_type = 'call'
  group by lead_id
) c
where c.lead_id = l.id;

create or replace function public.track_lead_call()
returns trigger
language plpgsql
as $$
begin
  if new.note_type = 'call' then
    update public.leads
    set call_attempts = call_attempts + 1,
        last_contacted_at = new.created_at
    where id = new.lead_id;
  end if;
  return new;
end;
$$;

drop trigger if exists lead_notes_track_call on public.lead_notes;
create trigger lead_notes_track_call
  after insert on public.lead_notes
  for each row execute function public.track_lead_call();

-- 3. Stage history as activity notes.
alter table public.lead_notes
  drop constraint if exists lead_notes_note_type_check;
alter table public.lead_notes
  add constraint lead_notes_note_type_check
  check (note_type in ('note', 'call', 'visit', 'whatsapp', 'stage'));

-- A reason only makes sense while the lead sits in a lost / disqualified stage.
create or replace function public.clear_close_reason_on_reopen()
returns trigger
language plpgsql
as $$
declare
  new_kind text;
begin
  if new.stage_id is distinct from old.stage_id then
    select kind into new_kind from public.pipeline_stages where id = new.stage_id;
    if new_kind is null or new_kind not in ('lost', 'disqualified') then
      new.close_reason := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists leads_clear_close_reason on public.leads;
create trigger leads_clear_close_reason
  before update on public.leads
  for each row execute function public.clear_close_reason_on_reopen();

create or replace function public.log_lead_stage_change()
returns trigger
language plpgsql
as $$
declare
  old_label text;
  new_label text;
  message text;
begin
  if new.stage_id is distinct from old.stage_id then
    select label into old_label from public.pipeline_stages where id = old.stage_id;
    select label into new_label from public.pipeline_stages where id = new.stage_id;
    message := 'Stage: ' || coalesce(old_label, 'None') || ' → ' || coalesce(new_label, 'None');
    if new.close_reason is not null then
      message := message || ' (' || new.close_reason || ')';
    end if;
    insert into public.lead_notes (lead_id, content, note_type)
    values (new.id, message, 'stage');
  end if;
  return new;
end;
$$;

drop trigger if exists leads_log_stage_change on public.leads;
create trigger leads_log_stage_change
  after update on public.leads
  for each row execute function public.log_lead_stage_change();
