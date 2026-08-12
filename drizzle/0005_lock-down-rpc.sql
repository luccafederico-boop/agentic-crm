-- Hardening: the queue-claim function is only ever called by the runtime
-- (which connects as the table owner via DATABASE_URL). PostgREST grants
-- EXECUTE on public functions to anon/authenticated by default, exposing it
-- over the public REST API. It is SECURITY INVOKER so RLS already denies it
-- any rows for those roles, but there is no reason to leave it callable —
-- revoke it to remove the surface entirely.
--
-- The anon/authenticated roles only exist on Supabase; CI runs plain Postgres,
-- so guard each revoke on the role existing. `public` always exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE EXECUTE ON FUNCTION claim_agent_task(text, int) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE EXECUTE ON FUNCTION claim_agent_task(text, int) FROM authenticated;
  END IF;
  REVOKE EXECUTE ON FUNCTION claim_agent_task(text, int) FROM public;
END $$;
