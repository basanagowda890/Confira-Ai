-- Safe, idempotent migration to add AI Assistance Detection fields to interview_answers
alter table public.interview_answers
  add column if not exists ai_assistance_score numeric check(ai_assistance_score between 0 and 100),
  add column if not exists ai_assistance_classification text check(ai_assistance_classification in ('low','medium','high')),
  add column if not exists ai_assistance_confidence text check(ai_assistance_confidence in ('low','medium','high')),
  add column if not exists ai_assistance_signals jsonb not null default '[]',
  add column if not exists ai_assistance_explanation text;
