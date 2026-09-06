-- Matrundans kanoniska samlade production-preflight.
--
-- Kör den här filen med psql när hela aktuella databaskontraktet ska verifieras.
-- De fokuserade production-preflight-*.sql-filerna finns kvar som smala
-- verifieringsytor för respektive migrationspaket, men drift/recovery ska använda
-- denna aggregate så att ingen ny kontroll lämnas utanför den kanoniska grinden.
\set ON_ERROR_STOP on

\ir production-preflight.sql
\ir production-preflight-invitations.sql
\ir production-preflight-place-location.sql
\ir production-preflight-review-reactions.sql
\ir production-preflight-search-boundaries.sql
\ir production-preflight-visit-participation.sql
\ir production-preflight-visit-photo.sql
