-- Run this in Supabase SQL Editor

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  email text unique not null,
  password text not null,
  avatar_color text not null default '#3B82F6',
  is_admin boolean not null default false,
  xp integer not null default 0,
  level integer not null default 1,
  streak integer not null default 0,
  last_active text,
  created_at timestamptz not null default now()
);

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references users(id),
  is_public boolean not null default true,
  invite_code text unique,
  created_at timestamptz not null default now()
);

create table if not exists room_members (
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  content text not null,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject text not null,
  question text not null,
  answer text not null,
  ease_factor real not null default 2.5,
  interval integer not null default 1,
  next_review timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject text not null,
  topic text not null,
  score integer not null,
  total integer not null,
  created_at timestamptz not null default now()
);

create table if not exists study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject text not null,
  duration_minutes integer not null,
  created_at timestamptz not null default now()
);

create table if not exists badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  badge_key text not null,
  earned_at timestamptz not null default now()
);

create table if not exists study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  exam_date text not null,
  subject text not null,
  plan_json text not null,
  created_at timestamptz not null default now()
);

-- Disable RLS for now (server handles auth via JWT)
alter table users disable row level security;
alter table rooms disable row level security;
alter table room_members disable row level security;
alter table messages disable row level security;
alter table flashcards disable row level security;
alter table quiz_attempts disable row level security;
alter table study_sessions disable row level security;
alter table badges disable row level security;
alter table study_plans disable row level security;
