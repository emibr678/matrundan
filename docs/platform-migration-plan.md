# Plattformsmigration och portabilitet

**Status:** planering, inte implementation  
**Styrande issue:** #207 – Frikoppla drift från Lovable Cloud och etablera portabel plattform

Det här dokumentet beskriver målarkitektur, portabilitetsprinciper, migrationsordning,
säkerhetsgrindar och rollback för att göra Matrundans drift oberoende av Lovable
Cloud. Dokumentet är avsiktligt mer tekniskt än produktroadmapen.

Detta dokument godkänner inte kodändringar, databasdriftsättning, authflytt,
DNS-byte, merge eller publicering. Varje genomförandesteg följer fortsatt
`docs/development-workflow.md` och kräver de godkännanden som anges där.

## Varför migrationen görs

Matrundan ska kunna leva länge som en liten privat produkt utan att låg eller
sporadisk användning tvingar fram en permanent fast driftkostnad. Samtidigt ska
kostnadsoptimering inte ske genom att säkerhet, återställningsbarhet eller
framtida utvecklingsfrihet försämras.

Migrationen har därför fyra huvudmål:

1. **Låg och förutsägbar driftkostnad.** Free tiers får användas vid liten skala,
   men produkten ska ha tydliga uppgraderings- och exitvägar.
2. **Mindre leverantörslåsning.** En leverantör får inte vara enda platsen där
   affärsregler, säkerhetsregler eller återställningsbar data existerar.
3. **Bibehållen säkerhetsmodell.** Gruppisolering, kanoniska platser/besök,
   RLS/RPC och servervalidering får inte försvagas i samband med flytten.
4. **Klientoberoende.** Web/PWA ska kunna vara primärklient länge, men en
   framtida native-klient ska kunna återanvända samma domän- och backendkontrakt.

## Nuvarande utgångsläge

Kodbasen är redan relativt väl separerad från Lovables editor:

- live-data ligger i Supabase/Postgres;
- gruppintegritet och centrala mutationer ligger i RLS/RPC och serverfunktioner;
- klienten använder `@supabase/supabase-js`;
- serverkod använder Supabase med separat server-secret;
- Lovable-specifika beroenden finns framför allt i OAuth/authlagret och
  Vite/TanStack-buildkonfigurationen;
- Geoapify, VAPID/push och browserkartor har separata konfigurationsytor;
- besöksfoton ligger i dag i privat Supabase Storage.

Observerad produktionsbaseline den 15 augusti 2026 var ungefär:

- 22 MB PostgreSQL-data;
- 4 authanvändare;
- 4 Storage-objekt på totalt cirka 1,1 MB.

Baselinen är endast ett migrationsunderlag. Kapacitets-, pris- och policygränser
för externa tjänster ska alltid verifieras på nytt när en fas ska genomföras; de
ska inte kodas in som varaktiga arkitekturantaganden.

## Målbild

Den primära målbilden är:

```text
GitHub + Codex
      |
      v
Leverantörsneutral publik HTTPS-domän
      |
      v
Cloudflare
  - webbhosting/static assets
  - TanStack SSR/server runtime
  - isolerade PR/branch previews
  - schemalagda driftjobb
      |
      +-------------------+
      |                   |
      v                   v
Supabase               Cloudflare R2
  - Postgres             - kandidat för privat media
  - Auth                 - off-site backupmål
  - RLS/RPC

Externa providers
  - Geoapify/OSM
  - Web Push/VAPID
```

Målbilden är inte ett krav att varje ruta måste användas för alltid. Cloudflare,
Supabase, R2 och Geoapify ska behandlas som utbytbara infrastrukturtjänster bakom
tydliga kontrakt.

Den publika identiteten ska på sikt ligga på en domän som Matrundan kontrollerar,
inte på en hostingleverantörs standarddomän. Exakt domän och tidpunkt är ett
separat beslut, men stabila användarlänkar, OAuth-callbacks och framtida Universal
Links/App Links får inte behöva byta identitet bara för att hosting byts.

## Varaktiga portabilitetsprinciper

### 1. Matrundans domän ägs inte av hostingplattformen

Grupp, medlemskap, platsidentitet, besök, deltagare, omdömen, delning och
progression är Matrundans domän. De reglerna får inte flyttas till
leverantörsspecifika deploymentfiler, edgebindings eller UI-komponenter bara för
att en viss tjänst gör det bekvämt.

Leverantörsspecifika funktioner får användas när de ger värde, men de ska ligga
vid en tydlig adaptergräns så att deras kontrakt kan ersättas.

### 2. Webben är en klient, inte domängränsen

Web/PWA är den nuvarande primärklienten. Den får inte bli enda platsen där
behörighet eller produktregler avgörs.

En framtida iOS-/Android-klient ska kunna använda samma:

- grupp- och medlemskapsmodell;
- kanoniska plats- och besöksidentiteter;
- auth- och RLS-principer;
- RPC/API-kontrakt;
- mediarättigheter;
- deep-linkidentiteter;
- notisavsikter.

Native-readiness betyder inte att ett monorepo eller en mobilapp ska byggas nu.
Det betyder att ny generell logik inte binds till DOM, `window`, TanStack Router
eller andra webbspecifika API:er om beroendet inte behövs.

Native-klienter kan ligga kvar på äldre appversioner efter en serverrelease.
Klientexponerade backendkontrakt ska därför vara versionsbara och ändras
bakåtkompatibelt när det är rimligt. Borttagning av ett kontrakt som en släppt
native-version kan använda kräver en uttrycklig deprecations-/migrationsstrategi.
Det nuvarande versionsmönstret för read-RPC:er är förenligt med denna princip.

### 3. Plattformstjänster är adapters

Följande ska behandlas som plattforms-/infrastrukturadapters:

- hosting/runtime;
- auth delivery/OAuth redirect;
- media/storage;
- notifications delivery;
- schemalagda jobb;
- kart-rendering;
- platsprovider/geocoding;
- secrets/configuration;
- observability.

Att byta en adapter får kräva migrationsarbete, men ska inte kräva att
Matrundans kärndomän modelleras om utan separat beslut.

### 4. Återställningsbar data måste kunna lämna leverantören

Produktdata ska kunna exporteras i dokumenterade, öppna eller väl etablerade
format. Backup får inte vara liktydigt med att leverantören säger att data är
säker.

För varje stateful tjänst ska det vara känt:

- vad som är kanonisk data;
- hur den exporteras;
- hur den återställs;
- vilka metadata/secrets som inte ingår i backup;
- hur backupens integritet kontrolleras;
- hur restore verifieras.

### 5. Miljöer och trust boundaries får inte flyta ihop

Kod under granskning ska inte automatiskt få samma privilegier som produktion.
PR-/branch-preview ska som huvudregel använda demo/fixtures eller en separat
stagingmiljö och får inte få produktions-service-role, produktionsdatabasens
skrivprivilegier eller andra breda produktionshemligheter.

Autentiserad smoke test mot produktion är ett separat, kontrollerat verifieringssteg
för en godkänd kandidat. Preview och produktionssmoke-test är inte samma sak.

### 6. Ingen onödig abstraktion i förväg

Portabilitet är inte samma sak som att bygga ett eget ramverk runt varje
bibliotek. En adapter introduceras när tjänsten är känslig, stateful, dyr att
byta eller redan har mer än en sannolik implementation.

Vi inför därför inte `packages/`, monorepo eller generiska repositorylager enbart
för en hypotetisk native-app. Kod flyttas när faktisk delning eller ett konkret
byte motiverar det.

## Klient- och native-readiness

### Publik URL-identitet och deep links

Inbjudningar och andra delbara objekt ska ha kanoniska HTTPS-länkar under en
leverantörsneutral domän som Matrundan kontrollerar. En framtida native-app ska
kunna registrera samma domän för iOS Universal Links och Android App Links och
öppna motsvarande interna vy utan att länkkontraktet behöver bytas.

Hostingleverantörens preview- eller standarddomän är inte en kanonisk
produktidentitet.

### Auth

Klienter ska använda användarsession/JWT och servervaliderade kontrakt. Ingen
webb- eller native-klient får innehålla service-role-credentials.

OAuth-redirects ska modelleras så att webben fungerar nu och att native callback
kan läggas till senare utan att användaridentiteten behöver omdefinieras.
Redirect-allowlists ska vara så snäva som praktiskt möjligt; dynamiska preview-
URL:er ska inte motivera breda produktionswildcards.

Vid authmigration skiljs **användaridentitet** från **aktiv session**. Att bevara
stabila användar-ID:n, identities och vid behov lösenordshashar kan vara viktigt
för historiken. Det är däremot acceptabelt, och ofta säkrare, att befintliga
sessionstokens blir ogiltiga och användarna får logga in igen. Gamla JWT-signing
secrets/keys ska inte kopieras enbart för att slippa en ny inloggning; eventuell
nyckelkontinuitet kräver separat säkerhetsmotivering.

### Media

Klienten ska inte behöva känna till långlivade storagecredentials. Om media
flyttas till R2 ska uppladdning/läsning ske via kortlivade serverstyrda länkar
eller motsvarande auktoriserat kontrakt.

Presigned/signed URLs behandlas som bearer tokens: den som har länken kan använda
den tills den går ut. Därför ska de vara objekt- och operationsspecifika, ha kort
livslängd för privat media och inte loggas eller lagras som permanenta
objektreferenser.

Mediarättigheten är en Matrundanregel; bucketens ACL eller signerade URL är ett
verktyg för att upprätthålla den.

### Notifications

Produkten ska skilja mellan:

1. **notisavsikt** – vem ska få vilken privat händelse och varför;
2. **deliverykanal** – Web Push i dag, eventuellt APNs/FCM eller annan native
   transport senare.

Device-/push-token är kanaldata och får bytas eller finnas parallellt utan att
notisavsikten modelleras om. En framtida native-klient ska inte kräva att
notislogiken byggs om från grunden.

### Kamera, plats och share sheet

Kamera, platsåtkomst, clipboard/share sheet och lokal lagring ska hållas bakom
små klientnära gränser när de börjar användas på fler plattformar. De är
plattformsegenskaper, inte domänregler.

### Kartor

Kanoniska koordinater, provideridentitet och sökresultat är produktdata.
MapLibre är dagens renderare, inte en del av den kanoniska platsmodellen. En
framtida native-renderare får kunna ersätta den utan att `places` eller
`place_sources` behöver ändras.

## Migrationsfaser

Faserna är ordnade för att minimera irreversibla steg. En fas kan delas i flera
PR:er om det ger säkrare granskning.

### Fas 0 – fullständig inventering och migrationsmanifest

Innan implementation:

- inventera `@lovable.dev/*` och andra Lovable-antaganden;
- inventera alla `VITE_*` och server-only environmentvariabler;
- inventera serverfunktioner och deras runtimekrav, inklusive Node-specifika API:n
  och Web Crypto-kompatibilitet;
- inventera OAuth providers, redirect-URL:er och authflöden;
- inventera Supabase schema, migrationer, extensions, RPC:er, grants och RLS;
- markera uttryckligen Supabase-specifika integrationsytor som `auth.uid()`,
  `auth.jwt()`, PostgREST/RPC-exponering, Storage-schema/policies och Auth-schema;
- inventera authdata och identitetskopplingar;
- inventera Storage bucket, policies och privata mediaobjekt;
- inventera Geoapify, browserkartnyckel, servernyckel och originrestriktioner;
- inventera VAPID/Web Push;
- inventera publika URL:er, PWA-manifest, service worker och callback-URL:er;
- inventera vilka URL:er som innehåller känsliga bearer tokens, exempelvis
  inbjudningar och signerade medialänkar;
- dokumentera vilka miljöer som finns och vilka secrets/data varje miljö får nå;
- bedöm dataregion/persondataflöden för databas, storage, backup och loggar;
- ta ny baseline på tabellcounts, DB-storlek, authanvändare och media.

Resultatet ska bli ett checkbart migrationsmanifest, inte bara en lista av paket.

### Fas 1 – portabel build och isolerad Cloudflare preview

Målet är att bevisa att samma kod kan byggas och köras utanför Lovable innan
någon produktionsdata flyttas.

- ersätt Lovable-specifik Vite/TanStack-config;
- föredra den vid implementationstillfället officiella TanStack Start-
integrationen för Cloudflare Workers, i dag `@cloudflare/vite-plugin`, framför en
extra runtimeabstraktion; Nitro används bara om aktuell kod eller verifierade
krav ger ett konkret skäl;
- håll Cloudflare-bindings i deployment-/servergränsen och inte i domänmoduler;
- behåll befintliga lokala verifieringskommandon;
- etablera preview per branch/PR och dokumentera exakt head-SHA;
- ge preview endast miljöspecifika secrets och data; produktions-service-role och
  generella produktionsskrivningar får inte följa med automatiskt;
- använd demo/fixtures eller separat stagingbackend som normal previewkälla;
- testa SSR/serverfunktioner under Workers runtimebegränsningar;
- läs runtime-secrets på ett sätt som fungerar med edge-runtime och undvik
  oavsiktliga module-scope-/build-time-inliningar av serverhemligheter;
- sätt explicit cachepolicy: autentiserade och privata svar ska som huvudregel
  vara `private`/`no-store` om de inte uttryckligen har bevisats säkra att cacha;
- kontrollera headers, CSP, CORS, cookies/bearer-auth och authredirects;
- säkerställ att previewdeploy inte kör migrationer eller andra produktionswrites
  som en bieffekt av deploy.

**Exitkriterium:** demo/exempel och relevanta huvudflöden fungerar i en isolerad
Cloudflare preview utan produktionshemligheter eller produktionsskrivningar.
Eventuell autentiserad produktions-smoke-test görs separat mot en uttryckligen
godkänd kandidat.

### Fas 2 – frikoppla auth från Lovable

Nuvarande `@lovable.dev/cloud-auth-js` ersätts med direkt Supabase Auth eller ett
minimalt Matrundan-authkontrakt ovanpå Supabase.

Krav:

- befintlig RLS/JWT-modell bevaras;
- användar-ID:n får inte bytas implicit när de används i historisk data;
- strategi för befintliga identiteter, lösenord/OAuth-identities och sessioner
  beslutas var för sig;
- ny inloggning efter cutover är tillåten om det ger renare nyckelrotation och
  säkrare migration;
- lösenordsreset/OAuth/inbjudningsflöden testas;
- stabil leverantörsneutral HTTPS-domän används för produktionscallbacks när den
  finns;
- framtida native callback kan läggas till utan att webbflödet ersätts;
- redirectallowlists får inte öppnas bredare än nödvändigt för branch previews.

**Exitkriterium:** användaren kan autentisera sig utan Lovable Cloud Auth och får
samma servervaliderade gruppåtkomst som tidigare. Identitetskontinuitet är
verifierad även om sessionerna medvetet har roterats.

### Fas 3 – separat Supabase-målmiljö

Skapa en ny Supabase-miljö utan att koppla bort nuvarande produktion.

- återskapa schema från repots migrationer;
- verifiera att migrationer är deterministiska från tom databas;
- kontrollera extensions och providerberoenden;
- migrera produktdata med tabellcounts och invariants före/efter;
- migrera eller återetablera auth enligt beslutad strategi;
- verifiera Supabase-specifika auth-/RLS-/PostgREST-seams separat från den
  PostgreSQL-portabla kärndatan;
- kontrollera `SECURITY DEFINER`, låst `search_path` och grants;
- kontrollera konto-radering;
- kontrollera cross-group-isolering;
- kör `supabase/production-preflight.sql`;
- gör autentiserad smoke test med verklig gruppkontext som ett kontrollerat
  verifieringssteg, inte som standardbehörighet för varje preview.

Ingen dual-write introduceras automatiskt. Om båda miljöerna måste vara skrivbara
samtidigt krävs en separat säker design.

**Exitkriterium:** mål-Supabase kan ensam bära en verifierad kopia av live-läget
utan att någon publik trafik ännu pekats om.

### Fas 4 – media och storage

Två giltiga alternativ ska jämföras utifrån säkerhet och underhåll:

1. behåll privat media i mål-Supabase Storage;
2. flytta privat media till R2 bakom ett serverstyrt mediakontrakt.

R2 väljs inte enbart för större gratiskvot. Följande måste först vara löst:

- auktoriserad uppladdning;
- auktoriserad läsning;
- kortlivade och minimerade signed/presigned URLs där de används;
- servervaliderat objekt-ID/path så klienten inte väljer godtycklig bucketnyckel;
- filtyp, storlek och vid behov checksumma/integritetskontroll;
- grupp-/besökskoppling;
- delete/retention;
- delade besöksregler;
- backup;
- ingen publik bucket-listning;
- inga credentials i klienten;
- CORS begränsad till avsedda browserorigins för direktuppladdning.

**Exitkriterium:** ett privat foto kan skapas, läsas och raderas med samma eller
starkare integritetsgarantier som i dag.

### Fas 5 – backup och disaster recovery

Supabase Free får endast bli produktionskälla om Matrundan samtidigt har en
verifierad extern recoveryväg.

Innan backupfrekvens bestäms ska en rimlig **RPO** (hur mycket data som maximalt
får gå förlorad) och **RTO** (hur lång återställning som accepteras) dokumenteras
för aktuell skala. Free-tier-valet får inte tyst bestämma dessa mål åt produkten.

Backuplösningen ska minst täcka:

- schema och migrationsversion;
- applikationsdata;
- Supabase-managed data som normal `db dump` kan exkludera, särskilt Auth och
  Storage-metadata, eller en dokumenterad återetableringsstrategi;
- privat media;
- nödvändig icke-hemlig konfigurationsmetadata.

Backupkrav:

- använd standardiserade/logiska format där det är praktiskt, exempelvis
  PostgreSQL/Supabase CLI-dumpar och objektfiler, så restore inte kräver Lovable;
- backupfiler ska vara krypterade i vila hos backupmålet och överföras över TLS;
- backupcredentials ska vara minst privilegierade och separerade från klienten;
- backupobjekt ska få generations-/tidsbaserade nycklar så flera återställnings-
  punkter kan bevaras utan att senaste körningen skriver över den enda kopian;
- backup ska ha checksumma eller annan verifierbar integritetskontroll;
- retention/lifecycle och radering ska dokumenteras så persondata inte sparas
  för alltid av misstag;
- backupjobb ska larma/faila synligt om export, upload eller integritetskontroll
  misslyckas;
- secrets ska inte ligga i backupfilen utan återetableras från separat secret
  store/process.

Ett schemalagt jobb får använda GitHub Actions, Cloudflare eller annan lämplig
runner beroende på vad som vid implementationstillfället är säkrast och mest
kostnadseffektivt. Själva backupobjekten ska inte lagras som kortlivade GitHub
Actions-artifacts.

Rekommenderat mål är off-site objektlagring, exempelvis R2, med flera generationer.
"Off-site" betyder minst utanför den kanoniska databasleverantörens fel- och
administrationsdomän; backupformatet ska samtidigt vara flyttbart till annan
objektlagring.

#### Restore-test

Minst en gång före cutover ska en backup återställas till en separat tom miljö.
Testet ska dokumentera:

1. skapa tom backend;
2. applicera schema/migrationer;
3. återställ data;
4. återetablera auth;
5. återkoppla media;
6. konfigurera secrets/callbacks;
7. kör preflight;
8. kör autentiserad smoke test;
9. jämför counts och centrala invariants med backupmanifestet.

Efter cutover ska restore inte betraktas som ett engångstest. Frekvensen för
återkommande restore-drill bestäms efter användning och förändringstakt, och ska
åtminstone upprepas när backupformat, auth/storage-modell eller större
migrationsmekanik ändras.

**Exitkriterium:** frågan "hur återställer vi Matrundan om hela Supabase-projektet
försvinner?" har ett genomfört, inte bara teoretiskt, svar som uppfyller beslutad
RPO/RTO.

### Fas 6 – driftvakter, observability, abuse controls och kostnad

Om Supabase Free fortfarande har inaktivitetspaus när migrationen genomförs ska
vi verifiera den aktuella policyn och vid behov använda en liten schemalagd
health check.

Health check ska:

- vara dokumenterad;
- göra minsta möjliga legitima databasaktivitet;
- inte läsa privat gruppdata;
- inte innehålla service-role-credentials i klienten;
- ha felrapportering så att en utebliven körning kan upptäckas.

Observability ska minst skilja på:

- app/runtimefel;
- databasfel;
- authfel;
- backupfel;
- Geoapify/providerfel;
- pushfel.

Loggning ska vara dataminimerad. Loggar får inte innehålla privata gruppfält, rå
providerpayload, authheaders, sessionstokens, signerade medialänkar eller andra
secrets. Känsliga tokens som ligger i URL-path/query, exempelvis nuvarande
`/inbjudan/$token`, ska uttryckligen hanteras så att plattformens automatiska
request-/invocationloggar inte blir en ny tokenlagring.

Dyra eller missbruksbara serverendpoints, exempelvis providerproxy, authrelaterade
operationer och issuance av signed media URLs, ska ha lämplig autentisering,
validering och vid behov rate-/quota-begränsning. Kostnadskontroll ska inte bygga
på att klienten beter sig väl.

Efter migration ska en faktisk kostnads-/quota-baseline dokumenteras. Geoapify
ska följas separat eftersom karttiles, autocomplete och placesökning kan bli en
tidigare kapacitetsgräns än hosting eller auth.

### Fas 7 – parallell verifiering och cutover

Före cutover:

- ny Cloudflare production-kandidat pekar på mål-Supabase;
- exakt release/head-SHA dokumenteras;
- stabil publik domän, TLS och redirect/callbackkonfiguration är verifierade när
  domänbytet ingår;
- demo/exempel fungerar;
- autentiserat live-läge fungerar;
- inloggning/reset testas;
- grupper och medlemskap testas;
- sökning, boundaries och karta testas;
- platsdetalj och praktisk information testas;
- besök, deltagare och omdömen testas;
- privat media testas;
- delning och inbjudningslänkar testas;
- push testas där möjligt;
- konto-radering testas;
- mobil 360 px och desktop verifieras;
- preview/staging och production har verifierat separata secrets/bindings.

#### Datafrysning

Om data måste kopieras en sista gång ska ett kort och explicit fönster användas.
Vi ska hellre ha en kontrollerad read-only/cutoverprocedur än att införa
komplicerad dual-write bara för att undvika några minuters planerad övergång.

#### Rollback

Rollback ska beskriva:

- vilken miljö som är source of truth vid varje steg;
- när skrivningar måste stoppas;
- hur gamla Lovable-produktionen återaktiveras om cutover misslyckas;
- hur nya skrivningar efter cutover hanteras om rollback ändå krävs;
- hur DNS/custom-domain pekas tillbaka utan att skapa två samtidiga skrivkällor;
- vilka authsessioner som kan behöva logga in igen efter rollback eller
  nyckelrotation.

Ingen DNS/publiceringsändring görs utan uttryckligt publiceringsgodkännande.

### Fas 8 – avveckla Lovable som runtimekrav

Först när den nya miljön varit verifierad stabil:

- ta bort överflödiga `@lovable.dev/*` runtime/buildberoenden;
- ta bort Lovable-specifik auth;
- uppdatera `.env.example` till faktisk deploymentmodell;
- uppdatera `docs/architecture.md` till faktisk produktionskedja;
- uppdatera `docs/development-workflow.md` så den nya branch-previewprocessen
  ersätter Lovable-previewgrinden där den är relevant;
- uppdatera `AGENTS.md` och `README.md`;
- bedöm om Lovable-projektet ska behållas för frivillig UX-konsultation.

Lovable kan fortsatt vara ett designverktyg. Det ska bara inte vara ett krav för
att Matrundan ska gå att bygga, testa, driftsätta eller använda.

## Säkerhetsgrindar

Migrationen får inte försämra följande:

- aktivt gruppmedlemskap kontrolleras server-side;
- känsliga cross-group-läsningar förblir minimerade;
- service-role finns endast server-side och aldrig automatiskt i PR-previews;
- raw providerpayload förblir server-side;
- privata foton kan inte listas eller läsas utan auktoriserad kontext;
- signed/presigned media URLs är kortlivade bearer tokens och behandlas därefter;
- kontoradering fortsätter scrubba användarreferenser enligt arkitekturreglerna;
- backup innehåller inte secrets och har verifierbar integritet;
- backupmål ger inte bredare åtkomst än vad backupens syfte kräver;
- caching får inte blanda privat data mellan användare eller grupper;
- auth-/invite-/signed-URL-tokens får inte hamna i applikations- eller
  plattformsloggar;
- preview/staging och production har separata secrets och behörigheter;
- kostnadsdrivande externa anrop kan inte missbrukas genom en oautentiserad
  klientgenväg.

## Leverantörsexit

Efter migration ska följande exitvägar vara rimliga:

### Cloudflare

Appens domänkod och TanStack-authoringmodell ska inte kräva Cloudflarebindings
utanför små deployment/runtimeadapters. Ett framtida byte till annan JS-runtime
får kräva deployarbete men inte omskrivning av grupp- eller datamodellen.

Den kanoniska publika domänen ska kontrolleras av Matrundan så hosting kan bytas
utan att användarlänkar, OAuth-identitet eller framtida Universal/App Links
behöver byta domän.

### Supabase

Supabase används för att det passar dagens Postgres/RLS/RPC/Auth-modell. Det är
samtidigt viktigt att beskriva portabiliteten korrekt:

- tabeller, relationer, constraints, index och stora delar av PL/pgSQL-logiken är
  vanlig PostgreSQL och ska fortsätta finnas i versionerade migrationer i repo;
- RLS-policies som använder `auth.uid()`/`auth.jwt()`, Supabase Auth-schema,
  Storage-schema/policies och PostgREST/RPC-wirekontrakt är Supabase-specifika
  integrationsytor;
- ett framtida byte till vanlig PostgreSQL är därför en realistisk väg för den
  relationella kärndatan, men authkontext, API-exponering och storage måste då
  adapteras eller ersättas uttryckligen.

Vi ska alltså undvika onödig Supabase-låsning utan att låtsas att hela dagens
backend kan flyttas till valfri PostgreSQL-server utan integrationsarbete.

### R2

Objektreferenser i domändata ska inte behöva innehålla en irreversibel offentlig
R2-URL. Media ska kunna kopieras till annan S3-liknande eller motsvarande
objektlagring och serveradressen bytas bakom kontraktet.

### Geoapify

Kanoniska Matrundan-platser får inte reduceras till Geoapifyobjekt. Externa
identiteter fortsätter höra hemma i `place_sources`, så en framtida provider kan
läggas till eller ersätta Geoapify utan att besökshistorik skrivs om.

## Beslut som ska tas under implementation, inte nu

Följande är öppna tills respektive fas har aktuell teknisk verifiering:

- exakt Cloudflare deploymentkonfiguration för aktuell TanStack Start-version;
- exakt leverantörsneutral publik domän och när cutover till den sker;
- om media ska ligga i Supabase Storage eller R2 efter cutover;
- exakt backupmotor, RPO/RTO, frekvens och retention;
- exakt authmigrationsmetod för identities/lösenord och om befintliga sessioner
  medvetet ska ogiltigförklaras;
- om keep-alive behövs och är förenlig med då aktuella Supabase-villkor;
- om karttiles ska ligga kvar hos Geoapify eller separeras senare;
- om Lovable ska behållas på någon plan efter runtimefrikoppling.

Dessa beslut ska tas utifrån aktuell dokumentation, kod och mätdata. De ska inte
låsa migrationen i förväg.

## Ej i scope

- ingen native-app;
- ingen Capacitor-/Expo-migration;
- ingen produktredesign;
- ingen ny social/offentlig modell;
- ingen omskrivning från Postgres;
- ingen automatisk OSM-publicering;
- ingen förändring av Matrundans grupp- eller integritetsprinciper;
- ingen deployment eller cutover genom denna plan.

## Dokumentation som ändras efter genomförd migration

När faktisk runtime ändras ska källorna till sanningen uppdateras i samma
leverans eller omedelbart efter verifierad cutover:

- `AGENTS.md` – bindande verktygs-/runtimeinstruktioner;
- `docs/architecture.md` – faktisk runtime, storage och backupgränser;
- `docs/development-workflow.md` – branch preview och leveransfaser;
- `README.md` – aktuell driftförmåga och begränsningar;
- `.env.example` – publika och server-only variabler;
- `DEVELOPMENT.md` – lokal setup/deploykommandon.

Produktroadmapen behöver inte bära den detaljerade migrationen. #207 är den
konkreta backlogposten och detta dokument är dess tekniska plan.
