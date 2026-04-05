-- ============================================================================
-- Fix: align tte_responses SELECT policy with the new 5-response minimum.
-- The old policy required response_count >= 6, so sessions with exactly 5
-- responses could pass the app-level gate but see zero rows due to RLS.
-- Run in: https://supabase.com/dashboard/project/knftyqkhampkqchoncel/sql/new
-- ============================================================================

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
