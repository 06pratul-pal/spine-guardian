-- Run this in Supabase SQL Editor

create table if not exists analytics_events (
  id           bigserial primary key,
  user_id      uuid references auth.users(id) on delete set null,
  event        text not null,          -- e.g. 'session_started', 'alert_fired'
  properties   jsonb default '{}',     -- extra data: personality, score, duration etc.
  created_at   timestamptz default now()
);

-- Index for fast queries by user and event type
create index if not exists idx_analytics_user    on analytics_events(user_id);
create index if not exists idx_analytics_event   on analytics_events(event);
create index if not exists idx_analytics_created on analytics_events(created_at);

-- Row level security — users can only insert their own events
alter table analytics_events enable row level security;

create policy "Users insert own events"
  on analytics_events for insert
  with check (auth.uid() = user_id or user_id is null);

-- Admins (you) can read all events
-- To query as admin use the service_role key in Supabase dashboard
