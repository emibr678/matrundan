# Matrundan – arkitektur och säkerhetsbeslut

Det här dokumentet är Matrundans kanoniska källa för varaktiga arkitektur-,
data- och säkerhetsbeslut. Det beskriver avsiktliga gränser och invariants, inte
ett fullständigt schemadump.

För praktiskt utvecklingsarbete kompletteras det av:

- `AGENTS.md` för bindande repo- och arbetsregler;
- `docs/development-workflow.md` för planering, implementation, verifiering och
  leverans;
- `docs/product-roadmap.md` för produktpaket och prioritering;
- `supabase/production-preflight.sql` för den konkreta driftkontrollen efter
  migration.

## Grundprinciper

Matrundan är en privat, gruppcentrerad app. Arkitekturen ska därför i första
hand skydda gruppens gemensamma data, verkliga platsidentitet och historik.

Följande invariants är permanenta:

- gruppen är den primära produkt- och integritetsgränsen;
- verkliga matställen är kanoniska objekt och ska återanvändas, inte dupliceras
  när identiteten kan verifieras säkert;
- gruppspecifik metadata hör till gruppens relation till platsen, inte till den
  globala platsidentiteten;
- besök är verkliga grupphändelser och progression följer faktiska deltagare;
- privata gruppuppgifter får aldrig bli offentlig eller cross-group data genom
  en bekväm klientgenväg;
- servern, inte klienten, avgör medlemskap, behörighet och känsliga
  identitetsövergångar;
- exempel/demo får simulera samma huvudflöden men får inte bli en genväg runt
  live-lägets säkerhetsmodell.

## Runtime och driftsmiljö

Frontend är en Vite/React-applikation. Live-data ligger i Supabase/Postgres och
skrivningar går i huvudsak genom explicita RPC:er.

Produktionskedjan är:

1. kod och migrationer landar i GitHub;
2. relevanta CI-kontroller ska vara gröna;
3. migrationer driftsätts separat när de är godkända;
4. `supabase/production-preflight.sql` körs skrivskyddat efter migration;
5. PostgREST schema-cache laddas om när RPC-yta eller schema ändrats;
6. en autentiserad smoke test mot verklig gruppdata görs;
7. Lovable-preview och publik app behandlas som separata leveranssteg.

En merge är alltså inte samma sak som databasdriftsättning eller publicering.

## Trust boundaries

### Klienten

Klienten får:

- välja och presentera data som servern redan har godkänt;
- skicka användarens avsikt och valda indata;
- hålla temporär UI-state för sökning, preview och demo.

Klienten får inte vara enda säkerhetskontrollen för:

- gruppmedlemskap eller adminroll;
- cross-group-läsning;
- kanonisk platsidentitet;
- source-linking;
- deltagarprogression;
- privat delning;
- OSM-publiceringsstatus;
- databasens unika invariants.

### Databasen

Postgres/Supabase är den auktoritativa gränsen för:

- medlemskap och roller;
- gruppisolering;
- kanoniska `places`;
- grupprelationer i `group_places`;
- besök, deltagare, reviews och progression;
- externa källidentiteter;
- känsliga cross-group-förslag;
- privata förbättrings- och rapporteringsflöden.

`SECURITY DEFINER` används bara när en serverfunktion uttryckligen behöver läsa
eller skriva utanför vanlig RLS-synlighet. Sådana funktioner ska alltid ha låst
`search_path`, explicita behörighetskontroller och minimerad output.

## Gruppisolering

Gruppdata ska inte kunna läsas bara för att en användare känner till ett UUID.
Varje live-RPC som arbetar med gruppdata måste verifiera minst:

1. att användaren är autentiserad;
2. att gruppen är aktiv när skrivning kräver det;
3. att användaren har aktivt medlemskap;
4. admin/owner-roll när funktionen gör administrativ ändring.

Klienten får inte läsa skyddade bas-tabeller direkt när en minimerad RPC är den
avsedda kontraktsytan.

Det gäller särskilt tabeller eller vyer som kan innehålla:

- andra gruppers metadata;
- rå providerdata;
- privata rapporter;
- förbättringsunderlag;
- historiska administrativa händelser.

## Kontoradering och kontoägarskap

Kontoradering använder `prepare_own_account_deletion(jsonb, boolean)` som
serverstyrd förberedelse före själva auth-raderingen.

Funktionen ska scrubba eller koppla loss personidentifierande fält som annars
skulle blockera eller onödigt behålla användaridentitet i historiska systemdata.

Historiska grupphändelser får bevaras när produktens integritet och referenser
kräver det, men direkta användarreferenser ska nullas eller ersättas när det är
säkert och semantiskt korrekt.

Nya tabeller som innehåller `created_by`, `updated_by`, submitter-ID eller annan
användarreferens ska därför granskas mot kontoraderingsflödet innan de räknas som
färdiga.

## Kanonisk datamodell

### Matställen

`places` representerar ett verkligt kanoniskt matställe.

`group_places` representerar att en viss grupp har lagt till eller arkiverat den
platsen och bär gruppspecifik metadata.

Det betyder:

- samma verkliga plats kan användas av flera grupper via samma `places.id`;
- en grupps anteckningar, Passar för, praktiska overrides eller status ska inte
  skrivas till det globala `places`-objektet bara för att de råkar vara
  tillgängliga i klienten;
- borttagning från en grupp är normalt arkivering av `group_places`, inte
  radering av den kanoniska platsen.

### Externa källor

`place_sources` kopplar en kanonisk plats till en extern identitet, i dag främst
Geoapify/OSM.

En aktiv provideridentitet ska vara unik och får inte tyst flyttas mellan två
kanoniska `places`-rader.

Rå providerpayload hålls server-side. Klienten får bara den normaliserade
information som krävs för produktflödet.

När en tidigare manuell plats senare får en säker provideridentitet ska källan
länkas till samma `places.id`; historiken ska inte flyttas till ett nytt objekt.

## Bilder och lagring

Besöksfoton ligger i privat Storage-bucket och ska inte kunna listas eller läsas
utan gruppkontext.

Produktionsvakten för `visit-photos` är:

- privat bucket;
- JPEG;
- max 1,5 MB;
- server-/policykontroller för rätt grupp och användare.

Klienten får komprimera och validera för UX, men Storage-reglerna är den
säkerhetsmässiga sanningen.

## RLS och RPC-mönster

### Direkt RLS

Direkt tabellåtkomst används bara när raden i sig är en lämplig säkerhetsgräns
och policyn kan uttrycka hela regeln enkelt.

### Minimerad RPC

Använd en minimerad RPC när:

- data måste läsas över flera skyddade tabeller;
- cross-group-information måste aggregeras eller neutraliseras;
- klienten bara ska få en delmängd av intern data;
- flera skrivningar måste ske atomärt;
- servern måste revalidera en kandidat precis före commit.

En cross-group-RPC får aldrig returnera mer data bara för att den internt hade
behörighet att läsa den.

## Gruppstate

`get_group_app_state_v5h(uuid)` är nuvarande primära read-RPC för gruppens
applikationsstate. Äldre kompatibla läs-RPC:er får finnas som fallback så länge
de behövs för säkra rullningar.

Read-RPC:n ska:

- verifiera medlemskap;
- bara returnera data för vald grupp;
- bevara integritetsregler för delade besök och gäster;
- undvika att exponera interna tabellfält som klienten inte behöver.

## Besök och deltagare

Ett besök är gruppens verkliga händelse, inte registrerarens individuella logg.

`create_visit_with_review_v2` är den serverstyrda mutationsytan för nytt besök
med omdöme.

Regler:

- registreraren kan vara förvald i UI men får ingen automatisk progression om
  hen avmarkeras;
- endast valda aktiva gruppmedlemmar får medlemsspecifik progression;
- gäster lagras som besöksbundna gäster, inte som gruppmedlemmar;
- återbesök är nya verkliga besök och räknas;
- en delad besöksrepresentation får inte duplicera progression eller skapa ett
  nytt verkligt besök.

## Sökning och sökområden

Gruppens sparade sökområden är förval för en ny söksession, inte permanent
behörighets- eller innehållsgräns.

Alla sparade områden är valda när sökningen öppnas och inget område är primärt.
Temporära ändringar i en söksession får inte tyst skriva om gruppens sparade
områden.

Dagens produktionsmodell är punkt + radie. Bred administrativ geografi som inte
kan representeras säkert som punkt blockeras därför av servern i
`replace_group_search_settings`.

När boundary-stöd införs måste gamla punktområden behålla sin tidigare betydelse
tills en säker provideridentifierad gräns uttryckligen kan verifieras. Ingen
migration får tyst omtolka historisk geografi.

## Provider och Geoapify

Geoapify används genom serverfunktioner; API-nyckeln ska aldrig ligga i
klientbundle eller klientlagring.

Provideranrop kan kortlivat cacheas server-side för att minska onödiga anrop,
men cache-nycklar ska inte innehålla gruppmedlemskap eller privat gruppdata.

Providerresultat normaliseras till produktdomänen. Rå payload används som
server-side bevis eller underlag när det behövs, men ska inte spridas genom
klienten.

Autocomplete för geografi och matställen ska hålla isär:

- geografiskt scope;
- generell mattyp/kök;
- specifikt verkligt matställe.

Ett specifikt matställe får inte implicit flytta användarens sökområde.

## Praktisk platsinformation

Adress/kartposition, webbplats och öppettider kan komma från extern källa men
kan behöva privata gruppoverrides.

`group_places` bär därför gruppens praktiska override-värden medan global
providerinformation ligger på eller härleds från den kanoniska platsen och dess
källor.

Serverfunktioner för praktisk information ska:

- verifiera aktivt medlemskap;
- hålla historik för gruppens egna ändringar;
- aldrig göra en annan grupps privata källa, anteckning eller adminidentitet
  synlig;
- kunna presentera ett neutralt cross-group-förslag utan att avslöja
  ursprungsgruppen;
- revalidera förslaget server-side vid tillämpning.

Cross-group-förslag får vara en kvalitetssignal, inte ett sätt att bläddra i
andra gruppers data.

## Privat platsrapportering och OSM

`place_data_reports` är gruppens privata rapporteringsyta för konkreta
platsdatafel. Den är inte en offentlig OSM-kö.

Rapporter kan avse:

- ett redan tillagt kanoniskt ställe; eller
- en providerträff som ännu inte lagts till.

Klienten använder minimerade RPC:er. Direkt tabellåtkomst är inte den avsedda
produktionsytan.

OSM-publicering är ett separat explicit flöde:

1. rapporten granskas av gruppadmin/owner;
2. servern verifierar fortfarande att rätt kategori och platskontext gäller;
3. ett förberett publiceringsförsök loggas och kvoteras;
4. service-side skrivning gör själva OSM-anropet;
5. servern kompletterar rapporten med offentlig referens/status;
6. efterföljande refresh hämtar endast den offentliga OSM-status som behövs.

En användares privata beskrivning eller gruppnamn får inte automatiskt bli OSM-
text. Publicering ska använda neutral, granskad information.

Om en plats senare får en aktiv OSM-/providerkälla kan en öppen
`missing_in_osm`-rapport lösas automatiskt, men en pågående publicering får inte
tyst försvinna mitt i ett submission-state.

## Manuell plats, kanonisk återanvändning och senare källkoppling

Ett manuellt ställe kan skapas utan extern provideridentitet. Verifierad
kartposition krävs däremot när flödet ska använda cross-group-matchning eller
skapa ett neutralt förbättringsunderlag. Fri text får aldrig gissas om till
verifierad geografi.

### Återanvändning före ny kanonisk plats

När användaren uttryckligen går vidare från sökningen med **Lägg till ett ställe
som saknas** får servern göra en begränsad kontroll om ett relevant kanoniskt
Matrundan-ställe redan finns utan aktiv extern källa.

Kontrollen är inte en publik eller generell platskatalog. Den får bara ske i den
konkreta tilläggskontexten och kräver namn samt verifierad kartposition.
Kandidatpoolen begränsas geografiskt och matchningen är konservativ över minst
namn, avstånd och när tillgängligt adress/ort.

Liknande namn är aldrig ensamt tillräckligt för automatisk sammanslagning. En
kandidat är ett förslag till användaren, inte en merge-order. Om flera rimliga
kandidater finns ska användaren kunna välja eller uttryckligen avstå från dem.
Två närliggande verksamheter måste kunna förbli separata.

Cross-group-läsningen sker i en minimerad `SECURITY DEFINER`-RPC med låst
`search_path`, aktiv grupp- och medlemskontroll. Klienten får endast neutral
platsidentitet som behövs för valet:

- kanoniskt plats-ID;
- namn och kategori;
- säker adress/ort/område när det finns;
- kartposition och avstånd;
- neutral matchtyp;
- om samma platsrelation redan är aktiv/arkiverad i målgruppen.

Följande får aldrig lämna servergränsen genom kandidatflödet:

- ursprungsgrupp eller gruppnamn;
- vem som skapade eller använder platsen;
- medlemskap eller antal grupper;
- privata anteckningar, Passar för, rapporter eller praktiska overrides;
- interna grupp- eller användar-ID:n.

När användaren väljer en kandidat återanvänds samma `places.id`. Servern skapar
eller återaktiverar endast målgruppens `group_places`-relation och får inte
kopiera metadata från någon annan grupp.

När användaren väljer **Inget av dessa stämmer** får ett nytt kanoniskt ställe
skapas, men servern gör kandidatkontrollen igen precis före skapandet. För
verifierade fallbackskapanden serialiseras den korta kontroll-/skapandefasen med
ett transaktionslås så att två samtidiga grupper inte båda kan passera kontrollen
och skapa samma rimliga kandidat samtidigt. Kandidater som användaren redan
uttryckligen avböjt får passera; nya eller förändrade kandidater måste visas på
nytt.

### Neutralt förbättringsunderlag

Ett verifierat manuellt ställe utan aktiv extern källa kan skapa en intern
`place_improvement_candidates`-rad med betydelsen ungefär **behöver matchas mot
extern källa**.

Detta underlag är medvetet separat från `place_data_reports`:

- det betyder inte **saknas i OpenStreetMap**;
- det är inte en användarrapport;
- det kan aldrig bli `ready_for_osm` eller publiceras externt genom OSM-flödet;
- `anon` och `authenticated` saknar direkt tabellåtkomst;
- granskningsytan använder en uttrycklig, minimerad serverkontrakt-yta.

När samma kanoniska plats senare får en aktiv `place_sources`-koppling löses
öppna eller OSM-markerade förbättringskandidater automatiskt. Därmed följer
förbättringsunderlaget platsidentiteten i stället för en specifik grupps privata
historik.

### Globalt Platsunderhåll

`Platsunderhåll` är en global intern administrationsyta för det neutrala
förbättringsunderlaget. I första versionen omfattar den endast
`place_improvement_candidates`. Gruppens **Rapporterade fel** och dess OSM
Note-flöde förblir separat gruppadministration och ska inte blandas in i den
globala kön.

Behörighet styrs av den privata rollen `place_maintainers` och är uttryckligen
separerad från grupproller. Att vara owner/admin i en eller flera grupper ger
aldrig global maintainerbehörighet. Klienten får bara fråga en boolesk
access-RPC och får inte läsa rolltabellen direkt.

Maintenance-RPC:er är `SECURITY DEFINER` med låst `search_path` och får bara
returnera neutral platsidentitet som behövs för granskningen: kandidat- och
plats-ID, namn, kategori, säker kanonisk adress/ort/position, kanonisk webbplats,
status samt relevant aktiv extern identitet. De får inte returnera ursprungsgrupp,
medlemskap, användare, privata kommentarer, `group_places`-overrides eller annan
gruppspecifik metadata.

Kandidatens livscykel är:

- `open`: ska kontrolleras;
- `needs_osm`: kräver manuellt arbete i OpenStreetMap;
- `resolved`: en aktiv extern källa har verifierats/länkats;
- `dismissed`: avfärdad med en kontrollerad orsakskod.

Statusövergångar och källkopplingar auditeras i den privata append-only-tabellen
`place_improvement_candidate_events`. Fri privat text används inte som global
avfärdandeorsak. Maintainerrollen tas bort med profilen vid kontoradering och
auditaktörens användarreferens nullas, så historiken kan bevaras utan att blockera
kontoägarskapets livscykel.

Providerkontroll sker server-side. Klienten skickar kandidat-ID; servern laddar
den neutrala kandidatpositionen genom maintenance-RPC:n och gör Geoapify-sökning
från den. API-nyckel och begränsad rå providerdata stannar på servern. Vid
länkning skickar klienten bara vald provideridentitet och servern gör en färsk
providersökning före mutation.

En central maintainer-länkning får bara koppla en verifierad provideridentitet
till samma befintliga `places.id`. Den kräver att platsen saknar aktiv källa,
att provider-/OSM-identiteten inte är aktiv på ett annat kanoniskt ställe och
att namn/adress/position klarar konservativ servervalidering. Tvetydighet eller
identitetskonflikt innebär ingen merge och ska hanteras som separat konflikt,
inte med fuzzy auto-sammanslagning.

`needs_osm` är endast intern arbetsstatus. Ytan får öppna OSM och kopiera neutral
platsinformation för manuellt arbete, men den skriver inte till OSM och använder
inte gruppens OSM Note-publiceringsflöde.

Demo/test använder deterministisk lokal fixture på samma route och ska vara
tydligt märkt som fiktiv utvecklingsdata. Den får inte göra provider-, databas-
eller OSM-skrivningar.

### Senare extern källkoppling

I gruppens befintliga detaljflöde får ägare/admin länka en senare providerträff
till ett manuellt ställe endast om:

- målplatsen är aktiv i gruppen;
- målplatsen saknar aktiv extern källa;
- exakt en konservativ match finns;
- den externa identiteten inte redan används av en annan aktiv plats;
- namn, adress och kartposition uppfyller servervaliderade kontrakt.

Det globala Platsunderhållets maintainer-länkning följer motsvarande kanoniska
identitetsvakter men är inte beroende av en viss grupprelation.

Tvetydighet innebär alltid ingen åtgärd. Fuzzy auto-merge ingår inte.

Källkopplingen bevarar samma `places.id`, `group_places`, besök, omdömen och
privata gruppuppgifter. Den får inte skriva över eller exponera gruppmetadata.

## Delning mellan grupper

Delning får aldrig bli cross-group-läsning av privat källdata.

När ett matställe delas mellan två av användarens grupper ska målgruppen kunna
återanvända samma kanoniska platsidentitet, men följande ska inte följa med:

- besök;
- omdömen;
- favoriter;
- privata anteckningar;
- Passar för;
- adminhistorik;
- gruppmedlemskap.

Dagens specifika delningsfunktioner och framtida återanvändning ska alltså skapa
eller återaktivera målgruppens relation, inte kopiera hela `group_places` eller
historik.

## Delade besök

Ett verkligt besök kan visas i mer än en grupp utan att dupliceras som två
verkliga händelser.

Delningslänken ska därför peka på samma besöksidentitet och bara exponera den
minsta information som målgruppen behöver.

Ursprungsgrupp, privata kommentarer, medlemskap och interna ID:n får aldrig
exponeras i delningspayloaden.

Progression och statistik ska dedupliceras på det verkliga besöket så att en
delad representation inte räknas två gånger.

## Exempelgrupp och demo

Exempelgruppen är ett permanent scenariokontrakt, inte bara statisk mockcopy.
Den ska kunna visa viktiga produkttillstånd med samma huvudkomponenter som live
utan att göra externa provider-/OSM-skrivningar.

Demo/exempel får därför använda deterministiska lokala fixtures för:

- providerresultat;
- geografiska val;
- privata signaler;
- kanonisk återanvändning;
- källa- och kvalitetskontroll.

Fixtures får aldrig antyda att en extern skrivning faktiskt gjorts.

När en större feature ändrar huvudflödet ska PR:n uttryckligen bedöma om
exempelgruppens scenariokontrakt behöver uppdateras.

## Notiser

Notifieringar köas server-side tillsammans med den händelse som skapar dem.
Klienten får trigga en snabb flush efter en lyckad mutation, men en misslyckad
notisleverans får inte få själva produktmutationen att misslyckas.

Ett schemalagt jobb är säkerhetsnät för kvarvarande outbox-rader.

Notiser får bara innehålla minsta nödvändiga gruppkontext och ska inte bli en
ny delningskanal för privat data.

## Release och databasdrift

Version, in-app-historik och `CHANGELOG.md` ska hållas synkroniserade för en
releasekandidat.

En migration i GitHub betyder inte att produktionsdatabasen är migrerad.
Databasdriftsättning kräver separat uttryckligt godkännande.

Efter migration ska minst följande verifieras innan publicering:

- nya tabeller, kolumner, index, constraints, triggers och RPC-signaturer;
- positiva grants;
- negativa grants och RLS-isolering;
- PostgREST schema-cache;
- autentiserad läsning av en verklig grupp;
- eventuell backfill eller datakvalitet som migrationen lovar.

`supabase/production-preflight.sql` är den kanoniska driftkontrollen och ska
uppdateras när en release inför nya obligatoriska databasobjekt eller
behörighetsinvariants.

## Migrationer

Migrationer är append-only efter att de har driftsatts i produktion.

Redigera eller spela inte om en redan applicerad migrationsfil för att få lokala
miljöer att se rena ut. Lägg i stället en ny framåtriktad migration.

Migrationer ska vara konservativa med befintlig data:

- inga destruktiva omskrivningar utan uttryckligt beslut;
- gamla punktbaserade sökområden får inte tyst bli polygoner;
- gamla platsrelationer får inte automatiskt fuzzy-mergas;
- historiska privata fält får inte bli globala bara för att en ny kanonisk modell
  tillkommer.

## Miljö och secrets

Följande får aldrig ligga i klientbundle, klientpersistens eller publika
repositoryfiler:

- service-role-nyckel;
- providerhemligheter;
- webhook-/pushhemligheter;
- användartokens;
- rå privat providerpayload som endast behövs server-side.

Publika klientnycklar som Supabase anon-key får användas enligt leverantörens
modell men de ersätter aldrig RLS och servervalidering.

## Arkitekturchecklista för större ändringar

Innan implementation av ändringar i datamodell, integritet, delning,
autentisering, Geoapify, notiser eller gamification ska planen besvara:

1. Vilket objekt är kanoniskt?
2. Vilken grupp äger vilken metadata?
3. Vilken data får klienten faktiskt se?
4. Vilken kontroll måste ligga server-side?
5. Kan ändringen skapa eller sammanblanda cross-group-data?
6. Hur hanteras demo/exempel utan att försvaga live-modellen?
7. Krävs migration eller backfill, och är den icke-destruktiv?
8. Vilka positiva och negativa behörigheter måste verifieras?
9. Behöver `production-preflight.sql` uppdateras?
10. Behöver kontoraderingsflödet scrubba en ny användarreferens?

Om någon av dessa frågor saknar ett verifierbart svar är arkitekturplanen inte
klar.
