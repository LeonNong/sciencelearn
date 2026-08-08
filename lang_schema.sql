-- Language Learning vocab table
-- Run in Supabase SQL Editor

create table if not exists lang_vocab (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  word text not null,
  language text not null default 'English',
  part_of_speech text,
  definition text,
  example text,
  translation text,
  ease_factor real not null default 2.5,
  interval integer not null default 1,
  next_review timestamptz not null default now(),
  correct integer not null default 0,
  incorrect integer not null default 0,
  created_at timestamptz not null default now()
);

alter table lang_vocab disable row level security;
