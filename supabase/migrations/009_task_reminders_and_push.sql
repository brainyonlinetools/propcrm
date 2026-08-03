-- Task follow-up time + reminder tracking
alter table public.tasks
  add column if not exists due_time text,
  add column if not exists reminder_sent_at timestamptz;

-- Push notification subscriptions (single-user app)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

create index if not exists idx_tasks_reminder_pending
  on public.tasks (due_date, reminder_sent_at)
  where is_done = false and due_date is not null and reminder_sent_at is null;

alter table public.push_subscriptions enable row level security;
create policy "anon_all" on public.push_subscriptions for all using (true) with check (true);
