# Skrivskyddad säkerhets- och konfigurationsgranskning inför eventuell publik repo-visibility

Ingen kod, secret, databas eller publicering har ändrats. Endast variabelnamn och principer redovisas nedan, aldrig värden.

## 1. Variabelnamn i den versionshanterade `.env` som faktiskt behövs

Tracked `.env` innehåller exakt sju namn, identiska med whitelisten i `scripts/public-readiness-check.mjs`:

| Namn | Vem läser det | Faktisk användning i trädet |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Frontend (browser) | `src/integrations/supabase/client.ts` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend (browser) | `src/integrations/supabase/client.ts` |
| `VITE_SUPABASE_PROJECT_ID` | Lovable Cloud-kontrakt | Ingen direkt läsning i `src/`; krävs av plattformens genererade konfiguration |
| `SUPABASE_URL` | Server/SSR-fallback | `client.ts`, `auth-middleware.ts`, `client.server.ts` |
| `SUPABASE_PUBLISHABLE_KEY` | Server/SSR-fallback | `client.ts`, `auth-middleware.ts` |
| `SUPABASE_PROJECT_ID` | Lovable Cloud-kontrakt | Ingen direkt läsning i `src/` |
| `VITE_GEOAPIFY_MAPS_KEY` | Frontend kartrendering | `PlaceMap.tsx`, `MultiAreaPlaceMap.tsx`, `routes/mapdiagnostik.tsx` |

Slutsats: alla sju behövs (fyra läses direkt i koden, `*_PROJECT_ID` ingår i Lovables projektkontrakt och kontrolleras av readiness-scriptet).

## 2. Är någon av dem en verklig serverhemlighet?

Nej. Samtliga sju är public-safe klient-/projektkonfiguration:

- Supabase URL, project id och publishable key är avsedda att skickas till browsern. Skyddet ligger i RLS, `SECURITY DEFINER`-RPC:er och medlemskapskontroller, inte i nyckelns sekretess.
- `VITE_GEOAPIFY_MAPS_KEY` är en browser-exponerad kartnyckel. Den är inte hemlig men ska begränsas hos leverantören med origin/referrer-regler — det är dess enda faktiska skydd.
- Inga namn i tracked `.env` matchar de förbjudna mönstren (`SECRET`, `SERVICE_ROLE`, `PRIVATE_KEY`, `PASSWORD`, `DATABASE_URL`, `ACCESS_TOKEN`), och inga andra `.env.*`- eller nyckel-/credentials-filer är versionshanterade.

## 3. Var serverhemligheter lagras och injiceras

Serverhemligheter finns **enbart** i Lovable Cloud Secrets (Project Settings → Secrets) och injiceras som miljövariabler vid anrop till serverkoden. De läses uteslutande inuti `createServerFn`-handlers eller `*.server.ts`-moduler via `process.env`, aldrig i klientkod och aldrig med `VITE_`-prefix.

Konfigurerade serversidiga namn och deras läsplatser:

- `GEOAPIFY_API_KEY` — `geoapify.functions.ts`, `geoapify-place-details.functions.ts`, `place-maintenance.functions.ts`
- `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` — `push-dispatch.server.ts`, `notifications.functions.ts` (publik VAPID-nyckel är per definition publik)
- `LOVABLE_API_KEY` — plattformshanterad
- `SUPABASE_SERVICE_ROLE_KEY` — refereras i `client.server.ts`, plattformsinjicerad och inte åtkomlig via repot

Projektet använder inte separata Supabase Edge Functions; serverlogiken körs som TanStack server functions med samma secret-injektion.

## 4. Synk- och statusläge

- `origin/main` står på `5761213d23ca10625fa961e91cd11ae7f5390adc` ("chore: förbered repot för säker framtida publik visibility (#172)") — den efterfrågade SHA:n är alltså synkad som aktuell main.
- Preview-checkouten står på ett Lovable-internt WIP-lager (`a672c33`) direkt ovanpå `5761213`, med ren arbetskatalog. Innehållsmässigt är detta samma produktkod som main.
- Hostad backend svarar normalt; inga fel- eller degraderingssignaler.
- Publicering och databasdrift har inte berörts av denna granskning.

## 5. Minsta säkra verifiering efter en framtida repo-hygienändring

Kör i denna ordning, innan visibility eller publicering rörs:

1. `bun scripts/public-readiness-check.mjs` — bekräftar att tracked `.env` fortfarande innehåller exakt whitelisten och att inga secret-liknande filer eller mönster finns i nåbara refs.
2. `bun run typecheck` och `bun run build` — bevisar att alla sju env-namn fortfarande finns och att bygget inte tappar `VITE_*`-inlining.
3. En autentiserad preview-smoke i två lägen: exempel/demo och live-läge. Kontrollera att gruppens data laddas (Supabase-klienten hittar URL + publishable key) och att en karta renderar (kartnyckeln finns i bygget).
4. En serverfunktionskontroll som kräver injicerad hemlighet — enklast en Geoapify-sökning i "Lägg till ställe" — vilket bekräftar att Cloud Secrets fortfarande injiceras.
5. Bekräfta att Lovable-synken pekar på exakt den kandidat-SHA som granskades, och redovisa branch, SHA, previewlänk, CI och databas/publiceringsstatus separat.

Om något av stegen 1–4 fallerar ska visibility-ändringen inte genomföras.

## Rekommendation utan kodändring

Ingen åtgärd krävs i nuvarande träd. Kvarstående arbete inför en eventuell visibility-ändring är icke-kodmässigt: history-aware secretscan över samtliga remote-brancher och tags, manuell granskning av issues/PR/Actions-loggar/artifacts, verifierad origin-begränsning på kartnyckeln hos leverantören, samt ett uttryckligt licensbeslut.
