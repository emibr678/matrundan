# Sökområden: punkt och verifierad gräns

Detta dokument beskriver arkitekturbeslutet för Issue #149 – **Stöd geografiska boundaries och visualisera sökområden på kartan**. Det kompletterar den kanoniska arkitekturen i `docs/architecture.md` och ska hållas förenligt med dess permanenta principer för sökområden och providerdata.

## Produktinvariant

Gruppens sparade sökområden är fortfarande bara förval för en ny söksession. De är aldrig behörighetsgränser, alla är valda när sökningen öppnas och inget område är primärt.

En söksession får kombinera upp till fem områden av två uttryckliga slag:

- `point`: ett verifierat punktcentrum som använder gruppens/den aktuella sökningens avstånd;
- `boundary`: ett provideridentifierat område som söks inom den verifierade providergränsen.

Avståndet påverkar bara `point`. Ett `boundary`-område får aldrig reduceras till en godtycklig cirkel för att förenkla implementationen.

## Beständig modell

`group_search_areas` bär:

- provideridentiteten (`provider`, `provider_place_id`);
- presentationsetikett och verifierat centrum (`label`, `lat`, `lng`);
- `search_mode` (`point` eller `boundary`);
- normaliserad `result_type` när den finns.

Själva Polygon/MultiPolygon-geometrin lagras inte som gruppdata. Den är providerhärledd sessions-/cachedata för kartpresentation och kan hämtas på nytt från provideridentiteten.

Befintliga rader migreras inte geografiskt. `search_mode` har default `point`, vilket gör att alla historiska punktområden behåller exakt sin tidigare betydelse. Ett äldre område blir `boundary` först efter ett nytt uttryckligt användarval där providern verifierar en gräns.

## Server- och providergräns

Geoapify-anrop sker server-side med serverhemligheten. Klienten skickar användarens val och den redan verifierade provideridentiteten men avgör inte själv vilken matplats som ligger inom en kommun eller annan boundary.

För `point` används providerfiltrering med cirkel runt centrum och vald radie.

För `boundary` används provideridentiteten som sökfilter. Providerresultatet är sanningen för vilka matställen som matchar området; kartpolygonen är en presentation och får inte bli en separat säkerhets- eller filtreringsmekanism i live-läget.

Vid val av en boundary-kandidat skiljer resolverflödet på bred administrativ geografi och övriga boundary-kandidater. Kommuner, län, regioner och andra tydligt breda administrativa val går direkt till Boundaries API `part-of` med administrativ boundary och `geometry_1000`, eftersom Geoapifys autocomplete kan representera sådana namn med en punkt/node även när en separat administrativ boundary finns. Det undviker onödiga Place Details-anrop för exempelvis `Nacka kommun`. Om den direkta Boundaries-vägen inte ger en namnmatchad polygon får Place Details fortfarande fungera som robust fallback. För övriga boundary-kandidater verifieras kandidatens eget Geoapify-`place_id` först via Place Details; `details` är förstahandsval och `details.full_geometry` används bara som tillägg när standarddetaljerna saknar polygon, varefter Boundaries API är fallback. Boundaries-svar får endast accepteras när en Polygon/MultiPolygon har ett namn som motsvarar användarens valda områdesetikett; orten `Nacka` får exempelvis inte automatiskt bli `Nacka kommun`.

När Boundaries API identifierar en separat boundary används boundaryns eget returnerade `place_id` som den kanoniska provideridentiteten för sökområdet. Samma identitet används senare i `filter=place:<place_id>` och för att hämta kartgeometrin igen. Autocomplete-punktens `place_id` får alltså inte sparas som boundaryidentitet när providern har löst den till en annan administrativ boundary. Bred administrativ geografi får inte sparas eller användas som ny punkt om ingen namnmatchad boundary kan verifieras. Mindre lokal geografi kan behålla punktbeteende när ingen gräns finns, eftersom den redan är säker i punkt + radie-modellen.

Geoapifys proximity-bias får användas för stabil intern rangordning även när `filter=place:<place_id>` avgränsar en boundary. Ett sådant bias-avstånd är däremot avståndet till områdets representativa punkt, inte avståndet till kommunen eller dess gräns, och får därför aldrig presenteras som `km från <boundary>`. Användarsynligt avstånd hör bara till en faktisk `point`-match. Om samma matställe matchar både boundary och punkt ska punktmatchningens riktiga avstånd vinna för avståndspresentationen; en boundary-only-träff får i stället bära neutral områdeskontext.

## Blandade områden och deduplicering

En och samma sökning får innehålla exempelvis:

- `Värmdö kommun` som `boundary`;
- `Skärgårdsvägen 8` som `point`.

Varje område söks enligt sitt eget läge. Svaren sammanförs och dedupliceras på provider + provideridentitet så att samma verkliga matställe bara visas en gång även om det matchar både kommunen och adressradien. Matchande områdesetiketter får följa med som presentationsmetadata, men de ändrar inte platsens kanoniska identitet.

## Karta

MapLibre har separata lager för:

- Polygon/MultiPolygon för verifierade boundaries;
- cirklar och centrum för punktområden;
- matställespins och klustring ovanpå båda.

Kartans viewport inkluderar boundarygeometrins koordinater. Om en redan sparad boundary kan användas för providersökning men dess kartgeometri tillfälligt inte kan hämtas, ska sökningen fortsatt fungera och UI:t får visa en neutral varning om att gränsen inte kunde ritas.

## Read-model och säker rullning

`get_group_app_state_v5i(uuid)` kompletterar gruppens `searchAreas` med `searchMode` och `resultType`. Klienten får falla tillbaka till `get_group_app_state_v5h(uuid)` endast när v5i uttryckligen saknas; äldre payloads normaliseras till `point`.

`replace_group_search_settings(uuid,jsonb,integer)` behåller sin publika signatur och servervaliderar medlemskap, owner/admin-roll, aktiv grupp, max fem områden, provideridentitet, koordinater, `searchMode` och tillåtna resulttyper.

## Demo och exempelgrupp

Demo använder lokal deterministisk Polygon/MultiPolygon och point-in-polygon endast för att efterlikna samma produktflöde utan externa anrop. Detta är test-/presentationslogik och får inte flyttas till live-klienten som auktoritativ geografifiltrering.

Exempelgruppen ska innehålla både ett kommunboundary och en adresspunkt så 360 px, desktop, mixed-mode-resultat, deduplicering och kartlager kan granskas utan live-provider eller databasändring.

## Drift

Migrationen är separat från merge och publicering. Efter separat godkänd databasdriftsättning ska:

1. `supabase/production-preflight.sql` och `supabase/production-preflight-search-boundaries.sql` köras skrivskyddat;
2. PostgREST schema-cache laddas om;
3. autentiserad live-läsning verifiera v5i;
4. live-smoke täcka minst boundary, point och en blandad sökning;
5. ett befintligt historiskt sökområde verifieras fortsatt vara `point`.
