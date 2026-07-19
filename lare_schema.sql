-- LARE: LearnWay Adaptive Revision Engine
-- Run this in Supabase SQL Editor

create table if not exists lare_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject text not null,
  topic text not null,
  exam_date text not null,
  difficulty integer not null default 3 check (difficulty between 1 and 5),
  quiz_correct integer not null default 0,
  quiz_total integer not null default 0,
  revision_count integer not null default 0,
  last_revised_at timestamptz,
  total_study_minutes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table lare_topics disable row level security;
