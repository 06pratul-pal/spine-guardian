-- Run this in Supabase SQL Editor to add cloud sync columns

alter table profiles
  add column if not exists total_xp              integer default 0,
  add column if not exists streak_days           integer default 0,
  add column if not exists last_active_date      text    default '',
  add column if not exists settings_json         text    default '{}',
  add column if not exists unlocked_achievements text    default '[]',
  add column if not exists updated_at            timestamptz default now();
