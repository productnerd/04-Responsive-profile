-- ============================================================================
-- Through Their Eyes — Supabase Schema
-- All tables prefixed with tte_ to namespace them in the shared project.
--
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/knftyqkhampkqchoncel/sql/new
-- ============================================================================

drop table if exists public.tte_responses cascade;
drop table if exists public.tte_sessions cascade;
drop function if exists public.tte_increment_response_count cascade;

-- ─────────────────────────────────────────────
-- tte_sessions: one per person collecting feedback
-- ─────────────────────────────────────────────
create table public.tte_sessions (
  id uuid primary key default gen_random_uuid(),
  creator_name text not null check (char_length(creator_name) between 1 and 50),
  slug text unique not null check (char_length(slug) between 4 and 20),
  created_at timestamptz not null default now(),
  response_count int not null default 0
);

create index tte_sessions_slug_idx on public.tte_sessions(slug);

-- ─────────────────────────────────────────────
-- tte_responses: one per friend who fills the form
-- ─────────────────────────────────────────────
create table public.tte_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.tte_sessions(id) on delete cascade,
  answers jsonb not null,
  completed_at timestamptz not null default now()
);

create index tte_responses_session_id_idx on public.tte_responses(session_id);

-- ─────────────────────────────────────────────
-- Trigger: auto-increment response_count
-- Keeps the counter trustworthy (client can't fake it)
-- ─────────────────────────────────────────────
create or replace function public.tte_increment_response_count()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.tte_sessions
  set response_count = response_count + 1
  where id = new.session_id;
  return new;
end;
$$;

create trigger tte_on_response_insert
  after insert on public.tte_responses
  for each row
  execute function public.tte_increment_response_count();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.tte_sessions enable row level security;
alter table public.tte_responses enable row level security;

-- Anyone can create a session
create policy "tte_sessions_insert_anyone"
  on public.tte_sessions
  for insert
  to anon, authenticated
  with check (true);

-- Anyone can read sessions (needed to look up by slug)
create policy "tte_sessions_select_anyone"
  on public.tte_sessions
  for select
  to anon, authenticated
  using (true);

-- Anyone can submit a response
create policy "tte_responses_insert_anyone"
  on public.tte_responses
  for insert
  to anon, authenticated
  with check (true);

-- Responses only readable once 5+ collected (enforces anonymity threshold).
-- Must stay in sync with REQUIRED_RESPONSES in src/pages/Results.tsx.
drop policy if exists "tte_responses_select_after_six" on public.tte_responses;
drop policy if exists "tte_responses_select_after_threshold" on public.tte_responses;
create policy "tte_responses_select_after_threshold"
  on public.tte_responses
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.tte_sessions s
      where s.id = tte_responses.session_id
      and s.response_count >= 5
    )
  );
