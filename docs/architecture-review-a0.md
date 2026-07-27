# A0 – arkitekturgranskning

Datum: 2026-07-27

## Syfte

Granskningen bedömer om Matrundans nuvarande kodbas är möjlig att underhålla, skala och vidareutveckla utan att nya funktioner bygger vidare på tillfälliga speciallösningar.

A0 ändrar inget produktbeteende. Dokumentet är beslutsunderlag för ett begränsat A1 och senare, separat godkända refaktorer.

## Sammanfattning

Matrundan behöver inte skrivas om. Kärnarkitekturen är sund:

- gruppen är tydlig produkt- och integritetsgräns;
- kanoniska platser och besök bevaras;
- känsliga skrivningar går genom servervaliderade RPC:er;
- demo- och live-läge är uttryckliga;
- MapLibre, Geoapify och Supabase ligger bakom namngivna integrationsmoduler;
- centrala produktflöden har beteendefokuserade E2E-tester.

Den tekniska skulden är däremot koncentrerad till ett fåtal stora orkestreringsfiler och till gränsen mot Supabase. Det är ett hanterbart läge, men nya större funktioner bör pausas tills de viktigaste gränserna har stabiliserats.

## Bedömning per område

### Grönt – behåll nuvarande riktning

#### Datamodell och säkerhet

Den kanoniska modellen för `places`, `visits`, deltagare och recensioner är en bra långsiktig grund. Gruppspecifik metadata ligger separat och känsliga skrivningar utförs atomärt via `SECURITY DEFINER`-RPC:er.

#### Integrationsadaptrar

`maplibre-client.ts`, Geoapify-normalisering och matetiketterna är relativt små, fokuserade och återanvändbara moduler.

#### Produktregler

Regler för gruppisolering, progression, återbesök, demo/live och 360 px mobilstöd är dokumenterade och kan användas som arkitekturkontrakt.

### Gult – bör delas upp stegvis

#### `src/lib/matrundan/store.tsx`

Filen ansvarar samtidigt för React Context, demo-persistens, demo-mutationer, live-mutationer, normalisering, aktivitet och selectors. Varje ny funktion riskerar därför att öka både filstorlek och koppling mellan demo- och live-läge.

Rekommenderad framtida riktning:

- ren demo-reducer;
- separata domänselectors;
- separat mutationstjänst per läge;
- tunnare React Context som endast komponerar delarna.

#### `src/components/matrundan/PlaceMap.tsx`

Komponenten innehåller MapLibre-livscykel, lager, GeoJSON, klustring, tema, felsökning, ikongenerering och UI. Funktionaliteten är motiverad men ansvaren är för tätt samlade.

Rekommenderad framtida riktning:

- rena GeoJSON-byggare;
- separat lagerkonfiguration;
- separat klusterkontroller;
- separat diagnostikadapter;
- tunn React-komponent som äger livscykeln.

#### `src/components/matrundan/AddPlaceDialogImpl.tsx`

Dialogen hanterar sökning, debounce, provider, karta/lista, manuell registrering och bekräftelsesteg i samma komponent.

Rekommenderad framtida riktning:

- reducer eller state machine för flödet;
- providerhook för sökningen;
- separata vykomponenter för sök, manuell registrering och bekräftelse.

### Orange – åtgärdas före fler större paket

#### Supabase-RPC-gränsen

De genererade Supabase-typerna ligger efter de senaste migrationerna. Produktkod använder därför versionscastar, `unknown` och lokala felkonverterare på flera ställen.

Risker:

- kompilatorn kan inte verifiera RPC-namn, argument och returvärden;
- samma workaround dupliceras;
- oväntade serverpayloads kan nå produktlogiken utan runtime-validering.

Åtgärd i begränsat A1:

- en central RPC-adapter;
- runtime-validering av returvärden;
- en enda dokumenterad typ-escape hatch;
- förbud mot nya direkta Supabase-importer från UI och routes.

Långsiktig åtgärd:

- automatisk regenerering av Supabase-typer efter migrationer;
- successiv borttagning av versionscastar;
- Zod-schema för sammansatta read-model-payloads.

#### Paketnamn i permanent kod

Namn som `live-admin-4b.ts` och RPC-versioner som `*_v4b` speglar leveranspaket snarare än ansvar. Applicerade migrationer ska ligga kvar oförändrade, men aktiv produktkod bör successivt namnges efter domänansvar.

## Arkitekturprinciper från och med A0

1. UI och routes får inte importera Supabase- eller Lovable-klienter direkt.
2. Externa integrationer ska kapslas i adapter- eller repositorymoduler.
3. Typ-workarounds ska finnas på en dokumenterad gräns, inte spridas mellan funktioner.
4. Nya funktioner får inte läggas direkt i `store.tsx`, `PlaceMap.tsx` eller `AddPlaceDialogImpl.tsx` utan att ansvar och alternativ först bedömts.
5. Ren domänlogik ska kunna testas utan browser, React och databas.
6. Applicerade migrationer ändras inte; nya databasskiften är additiva.
7. Refaktorering ska bevara produktbeteende och verifieras separat från nya funktioner.

## Begränsat A1

A1 i samma branch omfattar endast:

- central RPC-adapter med konsekvent felhantering;
- runtime-validering av enkla RPC-returvärden;
- migrering av de små live-mutationsmodulerna till adaptern;
- enhetstester för adaptern;
- ESLint-gräns som stoppar nya direkta UI-/route-importer från Supabase och Lovable.

A1 omfattar inte:

- databas- eller migrationsändringar;
- ändrat användarflöde eller copy;
- delning av `store.tsx`, `PlaceMap.tsx` eller `AddPlaceDialogImpl.tsx`;
- TanStack Query-migrering;
- versionshöjning eller publicering.

## Prioriterad fortsättning efter A1

1. Regenerera och lås Supabase-typerna.
2. Extrahera rena selectors och besöksaggregat från `store.tsx`.
3. Dela demo-mutationer från live-mutationer.
4. Dela kartans GeoJSON, lager och klusterlogik.
5. Dela Lägg till-flödet med reducer/state machine.
6. Ta bort eller skydda kvarvarande diagnostikroutes före publicering.

Varje steg ska genomföras som ett separat, beteendebevarande refaktorpaket med egen verifiering.