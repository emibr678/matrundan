# A0 – arkitekturgranskning

> Historiskt dokument från 2026-07-27. Det är inte längre en kanonisk
> nulägesbeskrivning. Aktuella beslut finns i
> [`docs/architecture.md`](../architecture.md).

Datum: 2026-07-27

## Syfte

Granskningen bedömer om Matrundans dåvarande kodbas var möjlig att underhålla,
skala och vidareutveckla utan att nya funktioner byggde vidare på tillfälliga
speciallösningar.

A0 ändrade inget produktbeteende. Dokumentet var beslutsunderlag för ett
begränsat A1 och senare, separat godkända refaktorer.

## Sammanfattning

Matrundan behövde inte skrivas om. Kärnarkitekturen bedömdes som sund:

- gruppen var tydlig produkt- och integritetsgräns;
- kanoniska platser och besök bevarades;
- känsliga skrivningar gick genom servervaliderade RPC:er;
- demo- och live-läge var uttryckliga;
- MapLibre, Geoapify och Supabase låg bakom namngivna integrationsmoduler;
- centrala produktflöden hade beteendefokuserade E2E-tester.

Den tekniska skulden var koncentrerad till ett fåtal stora orkestreringsfiler
och till gränsen mot Supabase.

## Bedömning per område

### Grönt – behåll riktningen

#### Datamodell och säkerhet

Den kanoniska modellen för `places`, `visits`, deltagare och recensioner var en
bra långsiktig grund. Gruppspecifik metadata låg separat och känsliga skrivningar
utfördes atomärt via `SECURITY DEFINER`-RPC:er.

#### Integrationsadaptrar

`maplibre-client.ts`, Geoapify-normalisering och matetiketterna var relativt små,
fokuserade och återanvändbara moduler.

#### Produktregler

Regler för gruppisolering, progression, återbesök, demo/live och 360 px
mobilstöd var dokumenterade och kunde användas som arkitekturkontrakt.

### Gult – borde delas upp stegvis

#### `src/lib/matrundan/store.tsx`

Filen ansvarade samtidigt för React Context, demo-persistens, demo-mutationer,
live-mutationer, normalisering, aktivitet och selectors.

Föreslagen riktning:

- ren demo-reducer;
- separata domänselectors;
- separat mutationstjänst per läge;
- tunnare React Context som komponerar delarna.

#### `src/components/matrundan/PlaceMap.tsx`

Komponenten innehöll MapLibre-livscykel, lager, GeoJSON, klustring, tema,
felsökning, ikongenerering och UI.

Föreslagen riktning:

- rena GeoJSON-byggare;
- separat lagerkonfiguration;
- separat klusterkontroller;
- separat diagnostikadapter;
- tunn React-komponent som äger livscykeln.

#### `src/components/matrundan/AddPlaceDialogImpl.tsx`

Dialogen hanterade sökning, debounce, provider, karta/lista, manuell
registrering och bekräftelsesteg i samma komponent.

Föreslagen riktning:

- reducer eller state machine för flödet;
- providerhook för sökningen;
- separata vykomponenter för sök, manuell registrering och bekräftelse.

### Orange – föreslagen åtgärd före fler större paket

#### Supabase-RPC-gränsen

De genererade Supabase-typerna låg efter migrationerna. Produktkod använde
därför versionscastar, `unknown` och lokala felkonverterare.

Identifierade risker:

- kompilatorn kunde inte verifiera RPC-namn, argument och returvärden;
- samma workaround duplicerades;
- oväntade serverpayloads kunde nå produktlogiken utan runtime-validering.

Föreslaget begränsat A1:

- central RPC-adapter;
- runtime-validering av returvärden;
- en enda dokumenterad typ-escape hatch;
- förbud mot nya direkta Supabase-importer från UI och routes.

Långsiktig riktning:

- automatisk regenerering av Supabase-typer efter migrationer;
- successiv borttagning av versionscastar;
- Zod-schema för sammansatta read-model-payloads.

#### Paketnamn i permanent kod

Namn som `live-admin-4b.ts` och RPC-versioner som `*_v4b` speglade
leveranspaket snarare än domänansvar. Applicerade migrationer skulle ligga kvar,
men aktiv produktkod borde successivt namnges efter ansvar.

## Arkitekturprinciper från A0

1. UI och routes ska inte importera Supabase- eller Lovable-klienter direkt.
2. Externa integrationer ska kapslas i adapter- eller repositorymoduler.
3. Typ-workarounds ska finnas på en dokumenterad gräns.
4. Nya funktioner ska inte läggas direkt i stora orkestreringsfiler utan att
   ansvar och alternativ bedöms.
5. Ren domänlogik ska kunna testas utan browser, React och databas.
6. Applicerade migrationer ändras inte; nya databasskiften är additiva.
7. Refaktorering ska bevara produktbeteende och verifieras separat från nya
   funktioner.

## Begränsat A1

Det föreslagna A1 omfattade:

- central RPC-adapter med konsekvent felhantering;
- runtime-validering av enkla RPC-returvärden;
- migrering av små live-mutationsmoduler till adaptern;
- enhetstester för adaptern;
- ESLint-gräns mot nya direkta UI-/route-importer från Supabase och Lovable.

Det omfattade inte databasändringar, ändrat produktbeteende, större uppdelning
av orkestreringsfiler, TanStack Query-migrering, versionshöjning eller
publicering.

## Då prioriterad fortsättning

1. Regenerera och lås Supabase-typerna.
2. Extrahera selectors och besöksaggregat från `store.tsx`.
3. Dela demo-mutationer från live-mutationer.
4. Dela kartans GeoJSON, lager och klusterlogik.
5. Dela Lägg till-flödet med reducer/state machine.
6. Ta bort eller skydda diagnostikrutter före publicering.

Punkterna ovan är historiska rekommendationer och ska omvärderas mot aktuell
kod och [`docs/architecture.md`](../architecture.md) innan de används som scope.
