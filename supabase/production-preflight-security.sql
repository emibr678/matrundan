-- Säkerhetsgrind för den faktiska databasmiljön.
-- Funktionen returnerar enbart kontrollnamn, aldrig användar- eller gruppdata.
DO $$
DECLARE
  result jsonb;
BEGIN
  SELECT public.run_release_security_gate_v1()
  INTO result;

  IF COALESCE((result->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION
      'Production security baseline failed: %',
      COALESCE(result->'failedChecks', '[]'::jsonb);
  END IF;
END;
$$;
