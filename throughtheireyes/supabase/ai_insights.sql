-- ============================================================================
-- Through Their Eyes — AI insights cache
-- Run in: https://supabase.com/dashboard/project/knftyqkhampkqchoncel/sql/new
-- ============================================================================

create table if not exists public.tte_ai_insights (
  session_id uuid primary key references public.tte_sessions(id) on delete cascade,
  insights jsonb not null,
  response_count_at_generation int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tte_ai_insights enable row level security;

-- Anyone can read an insight once the session has 5+ responses (same gate as results)
drop policy if exists "tte_ai_insights_select_after_six" on public.tte_ai_insights;
drop policy if exists "tte_ai_insights_select_after_threshold" on public.tte_ai_insights;
create policy "tte_ai_insights_select_after_threshold"
  on public.tte_ai_insights
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.tte_sessions s
      where s.id = tte_ai_insights.session_id
      and s.response_count >= 5
    )
  );

-- Only the edge function (service_role) writes. No anon insert/update policy on purpose.
