-- Exam grades tracking for LearnWay
-- Run in Supabase SQL Editor

create table if not exists exam_grades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject text not null,
  label text not null,        -- e.g. "Term 1 Test", "Mid-year Exam"
  score numeric not null,     -- percentage 0-100
  date text not null,         -- YYYY-MM-DD
  created_at timestamptz not null default now()
);

alter table exam_grades disable row level security;
