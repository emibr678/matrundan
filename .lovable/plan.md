# Diagnos: preview visar "Preview has not been built yet"

Read-only. Ingen kod, fil, integration, secret, databas eller publicering har ändrats.

## 1. Observerad evidens

Git-läge i den laddade projektcheckouten:

- Branch: `edit/edt-069ee86e-2ce0-4131-b9e9-7f9e935730eb`
- HEAD: `316baa4a6653da88a15454414d1803ea571017a0` ("Work in progress")
- Direkt förälder: `d78031dbd4893a7243b982531736d9521c0b328b` ("fix: hårdna Lovable preview-authstorage") — alltså är din rapporterade "senaste commit" **inte** HEAD, den ligger ett steg bakom.
- Arbetsträdet är rent. `d78031d` finns även på `fix/issue-207-lovable-preview-direct-supabase-oauth` och på `origin/…` samma branch.
- HEAD-commiten rör: `previewAuthStorage.ts`, `types.ts`, `routeTree.gen.ts` (de två senare är plattformsregenererade filer).

App/dev-server:

- Dev-servern lever: `vite dev --port 8080`, pid 826, lyssnar på `127.0.0.1:8080`.
- `GET http://localhost:8080/` svarar `200` med fullständigt SSR-renderad HTML (svensk `lang="sv"`, styles, TanStack Start-assets). Tre mätningar: 13 ms, 10 ms, 12 ms.
- Inga runtime-fel i felsnapshoten.
- I dev-loggen finns: `.env changed, restarting server…` + `server restarted`, `script "dev" exited with code 143` (SIGTERM vid omstart), och därefter `VITE v8.2.2 ready in 4708 ms`.
- Under och strax efter omstarten loggas upprepade `Error: aborted … (status 500)` med `error_code: JS_HTTPERROR` för `operation: "/"` och `"/__hmr_gate"`, varaktighet 1,7–2,0 s. `abortIncoming/socketOnClose` betyder att **klienten kopplade ner** innan svaret var klart — inte att SSR kastade ett applikationsfel.
- Ingen byggartefakt finns i checkouten: `.output`, `dist`, `.nitro`, `.vinxi` saknas alla. Det är förväntat för dev-läget och säger inget om plattformens egen bygg-pipeline.

Preview-URL utifrån:

- `https://id-preview--d389634e-…lovable.app/` → HTTP **401 Unauthorized** (12 byte). Preview kräver Lovable-inloggning, så jag kan inte se den HTML du ser.
- `https://project--d389634e-…-dev.lovable.app/` → HTTP **403 Forbidden**.

## Vad jag inte kan läsa (ingen gissning)

- Lovables egna preview-/publicerings-byggloggar för den här commiten. De ligger utanför sandlådan; jag har bara vite-dev-loggen (`/tmp/sandbox-state.db`, daemon `vite`) och den mirrorade `/tmp/dev-server-logs/dev-server.log`.
- Preview-proxyns/preview-containerns hälso- och deploy-status, och vilken commit preview-artefakten är byggd från.
- Innehållet bakom 401 på preview-URL:en (kräver din inloggade session).

## 2. Falsifierade hypoteser

- **"Appens kod är trasig / SSR kraschar."** Falsifierad: `/` returnerar 200 med komplett SSR-HTML och inga runtime-fel.
- **"Dev-servern är nere eller kraschloopar."** Falsifierad: en enda vite-process, stabil, lyssnar på 8080, svarar under 15 ms.
- **"`Error: aborted (status 500)` är applikationsfelet bakom meddelandet."** Falsifierad som orsak: stacken är `abortIncoming/socketOnClose`, dvs. avbrutna klientanslutningar runt en `.env`-triggad omstart, och senare anrop lyckas.
- **"Exit code 143 betyder ett kraschat bygge."** Falsifierad: 143 = SIGTERM från den avsiktliga omstarten, direkt följt av `ready`.
- **"Commit `d78031d` saknas / är inte pushad."** Falsifierad: den finns lokalt och på `origin/fix/issue-207-lovable-preview-direct-supabase-oauth`.
- **"Preview-URL:en är helt död."** Falsifierad: den svarar 401, dvs. edgen lever och gör auth-kontroll — den returnerar inte 5xx.

## 3. Sannolik rotorsak

Två observationer som skiljer app från infrastruktur:

- **Appens kod och dev-render är friska.** Inget i den lästa evidensen pekar på ett byggfel i produktkoden.
- **Preview-artefakten är inte kopplad till det läge du tittar på.** Den laddade HEAD är `316baa4a…`, inte `d78031db…`. Meddelandet "Preview has not been built yet. Either your project has an error or the preview is currently being built" är plattformens fallback när preview-routern inte hittar en färdig artefakt/container för projektets aktuella läge.

Mest sannolik rotorsak: **Lovables preview-infrastruktur har inte producerat (eller inte registrerat) en artefakt för den senaste "Work in progress"-commiten** — statusen `ready/completed` du ser gäller sandlådan/checkouten, inte preview-artefakten. En bidragande faktor är att `.env` skrevs om och tvingade en dev-omstart precis i det fönster där preview-proxyns hälsokontroll gick mot servern; de avbrutna 500-svaren i loggen ligger exakt där. Detta är en infrastruktur-/synk-orsak, inte ett kodfel. Jag kan inte bekräfta vilken av de två (ingen artefakt vs. misslyckad hälsokontroll) utan Lovables preview-byggloggar.

## 4. Minsta konkreta åtgärd

I stigande ordning, stoppa vid första som fungerar:

1. **Ladda om preview i webbläsaren** (hård omladdning) efter att sandlådan varit varm en stund. Om 401-sidan tidigare cachades av din session räcker detta.
2. **Trigga en ren preview-ombyggnad från exakt nuvarande synkade läge**, utan filändringar. Det är en enda åtgärd och kräver ingen kodändring — jag behöver ditt godkännande för att köra den eftersom den startar plattformsarbete.
3. **Om preview fortfarande är obyggd:** be Lovable-plattformen om preview-byggloggen för commit `316baa4a…`. Utan den loggen är varje ytterligare orsaksförklaring en gissning.
4. **Separat, som hygien:** bestäm om den plattformsgenererade "Work in progress"-commiten `316baa4a…` ska finnas kvar ovanpå `d78031db…` på PR-branchen. Den innehåller regenererade `types.ts`/`routeTree.gen.ts` som ligger utanför ditt godkända scope, och den gör att "senaste commit" i din rapportering och plattformens HEAD skiljer sig.

Inga ändringar utförs innan du godkänner.
