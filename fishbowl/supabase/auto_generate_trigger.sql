-- Auto-generate AI insights the moment a session first crosses the 5-response
-- threshold. Fires EXACTLY ONCE per session: at the transition from <5 to >=5.
--
-- After that first generation, new responses do NOT trigger regeneration. The
-- frontend shows the creator a "Regenerate" button when the cached response
-- count is lower than the current count, so they can opt in to a refresh.
--
-- This fires the tte-ai-insights Edge Function asynchronously via pg_net so
-- the triggering UPDATE is never blocked by the Claude call.
--
-- Prerequisites:
--   1. The "pg_net" extension (Supabase: Database → Extensions → enable pg_net)
--   2. The tte-ai-insights edge function deployed
--   3. A Supabase secret / vault entry with the anon key (used only as a
--      valid auth header — the function itself uses its own service role
--      client for DB access).
--
-- Run this in the Supabase SQL editor AFTER deploying the edge function.

create extension if not exists pg_net;

-- Drop prior versions so this script is re-runnable
drop trigger if exists tte_sessions_ai_insights_trigger on public.tte_sessions;
drop function if exists public.tte_trigger_ai_insights();

create or replace function public.tte_trigger_ai_insights()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  function_url text := 'https://knftyqkhampkqchoncel.supabase.co/functions/v1/tte-ai-insights';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuZnR5cWtoYW1wa3FjaG9uY2VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDg4MzYsImV4cCI6MjA2NzAyNDgzNn0.fugiTRvgoD3YqAZPQMV3R6Eu0Wx_9vgE6ZK8zjqFutg';
begin
  -- Fire-and-forget: pg_net returns a request id immediately and runs
  -- the HTTP call on a background worker, so it won't block the insert.
  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'apikey', anon_key
    ),
    body := jsonb_build_object(
      'session_id', NEW.id::text,
      'force', true
    )
  );
  return NEW;
end;
$$;

-- Fires ONCE per session: only at the transition from <5 to >=5.
-- Any subsequent response bumps the count but does not re-fire the trigger.
create trigger tte_sessions_ai_insights_trigger
after update of response_count on public.tte_sessions
for each row
when (
  OLD.response_count < 5
  and NEW.response_count >= 5
)
execute function public.tte_trigger_ai_insights();

-- Back-fill: fire once for any existing session that already has >= 5
-- responses but no cached insights (e.g. frank, created before this trigger).
do $$
declare
  s record;
  function_url text := 'https://knftyqkhampkqchoncel.supabase.co/functions/v1/tte-ai-insights';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuZnR5cWtoYW1wa3FjaG9uY2VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDg4MzYsImV4cCI6MjA2NzAyNDgzNn0.fugiTRvgoD3YqAZPQMV3R6Eu0Wx_9vgE6ZK8zjqFutg';
begin
  for s in
    select ts.id
    from public.tte_sessions ts
    left join public.tte_ai_insights ai on ai.session_id = ts.id
    where ts.response_count >= 5
      and (ai.session_id is null or ai.response_count_at_generation < ts.response_count)
  loop
    perform net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key,
        'apikey', anon_key
      ),
      body := jsonb_build_object('session_id', s.id::text, 'force', true)
    );
  end loop;
end $$;
