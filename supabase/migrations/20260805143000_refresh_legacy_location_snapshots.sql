BEGIN;

-- Snapshotrader som skapades före v1.26.0 saknar alltid de nya platsfälten.
-- Gör bara deras cachetid inaktuell så nästa gruppverifierade läsning hämtar
-- aktuell kartdata. Kanoniska places-rader och gruppöverstyrningar ändras inte.
UPDATE public.place_external_info_snapshots
SET fetched_at = LEAST(fetched_at, now() - interval '25 hours'),
    updated_at = now()
WHERE address IS NULL
  AND area IS NULL
  AND city IS NULL
  AND lat IS NULL
  AND lng IS NULL
  AND osm_type IS NULL
  AND osm_id IS NULL;

COMMIT;
