-- Matrundans samlade production-preflight-körgrind.
--
-- Kör den här filen med psql när hela aktuella databaskontraktet ska verifieras.
-- De fokuserade production-preflight-*.sql-filerna finns kvar som smala
-- verifieringsytor för respektive migrationspaket. Den äldre basfilen behåller
-- historiska kompatibilitets-/integritetskontroller, medan aktuell current/fallback
-- för gruppstate ägs av production-preflight-read-model.sql.
\set ON_ERROR_STOP on

\ir production-preflight-read-model.sql
\ir production-preflight-historical-reviews.sql
\ir production-preflight.sql
\ir production-preflight-invitations.sql
\ir production-preflight-place-location.sql
\ir production-preflight-review-reactions.sql
\ir production-preflight-search-boundaries.sql
\ir production-preflight-visit-participation.sql
\ir production-preflight-visit-photo.sql
