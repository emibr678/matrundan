BEGIN;

-- Paket 5C hotfix: återställ den avsedda Storage-konfigurationen efter att
-- Lovable skapade den privata bucketen utan filstorleks- och MIME-gränser.
-- Migrationen är idempotent och fungerar både för befintliga och nya miljöer.

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'visit-photos',
  'visit-photos',
  false,
  1500000,
  ARRAY['image/jpeg']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'visit-photos'
      AND name = 'visit-photos'
      AND public = false
      AND file_size_limit = 1500000
      AND allowed_mime_types = ARRAY['image/jpeg']::text[]
  ) THEN
    RAISE EXCEPTION 'visit-photos bucket configuration could not be verified';
  END IF;
END;
$$;

COMMIT;
