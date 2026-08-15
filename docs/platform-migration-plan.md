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

Matrundan ska kunna leva länge som en liten privat produkt utan att en låg eller
sporadisk användning tvingar fram en permanent fast driftkostnad. Samtidigt ska
kostnadsoptimering inte ske genom att säkerhet, återställningsbarhet eller
framtida utvecklingsfrihet försämras.

Migrationen har därför fyra huvudmål:

1. **Låg och förutsägbar driftkostnad.** Free tiers får gärna användas vid liten
   skala, men produkten ska ha tydliga uppgraderings- och exitvägar.
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

Baselinen är endast ett migrationsunderlag. Kapacitets- och prisgränser för
externa tjänster ska alltid verifieras på nytt när en fas ska genomföras; de ska
inte kodas in som varaktiga arkitekturantaganden.

## Målbild

Den primära målbilden är:

```text
GitHub + Codex
      |
      v
Cloudflare
  - webbhosting/static assets
  - TanStack SSR/server runtime
  - PR/branch preview
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

Produktdata ska kunna exporteras i dokumenterat format. Backup får inte vara
liktydigt med att leverantören säger att data är säker.

För varje stateful tjänst ska det vara känt:

- vad som är kanonisk data;
- hur den exporteras;
- hur den återställs;
- vilka metadata/secrets som inte ingår i backup;
- hur restore verifieras.

### 5. Ingen onödig abstraktion i förväg

Portabilitet är inte samma sak som att bygga ett eget ramverk runt varje
bibliotek. En adapter introduceras när tjänsten är känslig, stateful, dyr att
byta eller redan har mer än en sannolik implementation.

Vi inför därför inte `packages/`, monorepo eller generiska repositorylager enbart
för en hypotetisk native-app. Kod flyttas när faktisk delning eller ett konkret
byte motiverar det.

## Klient- och native-readiness

### Deep links

Inbjudningar och andra delbara objekt ska ha kanoniska HTTPS-länkar som fungerar
i webben. En framtida native-app ska kunna registrera samma domäner som Universal
Links/App Links och öppna motsvarande interna vy utan att länkkontraktet behöver
bytas.

### Auth

Klienter ska använda användarsession/JWT och servervaliderade kontrakt. Ingen
webb- eller native-klient får innehålla service-role-credentials.

OAuth-redirects ska modelleras så att webben fungerar nu och att native callback
kan läggas till senare utan att användaridentiteten behöver omdefinieras.

### Media

Klienten ska inte behöva känna till långlivade storagecredentials. Om media
flyttas till R2 ska uppladdning/läsning ske via kortlivade serverstyrda länkar
eller motsvarande auktoriserat kontrakt.

Mediarättigheten är en Matrundanregel; bucketens ACL är ett verktyg för att
upprätthålla den.

### Notifications

Produkten ska skilja mellan:

1. **notisavsikt** – vem ska få vilken privat händelse och varför;
2. **deliverykanal** – Web Push i dag, eventuellt APNs/FCM senare.

En framtida native-klient ska inte kräva att notislogiken byggs om från grunden.

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

### Fas 0 – fullständig inventering

Innan implementation:

- inventera `@lovable.dev/*` och andra Lovable-antaganden;
- inventera alla `VITE_*` och server-only environmentvariabler;
- inventera serverfunktioner och deras runtimekrav;
- inventera OAuth providers, redirect-URL:er och authflöden;
- inventera Supabase schema, migrationer, extensions, RPC:er, grants och RLS;
- inventera authdata och identitetskopplingar;
- inventera Storage bucket, policies och privata mediaobjekt;
- inventera Geoapify, browserkartnyckel, servernyckel och originrestriktioner;
- inventera VAPID/Web Push;
- inventera publika URL:er, PWA-manifest, service worker och callback-URL:er;
- ta ny baseline på tabellcounts, DB-storlek, authanvändare och media.

Resultatet ska bli en checkbar migrationsmanifest, inte bara en lista av paket.

### Fas 1 – portabel build och Cloudflare preview

Målet är att bevisa att samma kod kan byggas och köras utanför Lovable innan
någon produktionsdata flyttas.

- ersätt Lovable-specifik Vite/TanStack-config med officiell eller så
  standardnära TanStack/Vite/Nitro-konfiguration som möjligt;
- välj Cloudflare-adapter endast i deploymentlagret;
- behåll befintliga lokala verifieringskommandon;
- etablera preview per branch/PR;
- dokumentera exakt head-SHA för preview;
- testa SSR/serverfunktioner under Workers runtimebegränsningar;
- kontrollera caching så att privat gruppdata aldrig cachas cross-user;
- kontrollera headers, CSP, cookies och authredirects.

**Exitkriterium:** demo/exempel och icke-destruktiva live-läsningar fungerar i en
Cloudflare preview utan att produktionen ändras.

### Fas 2 – frikoppla auth från Lovable

Nuvarande `@lovable.dev/cloud-auth-js` ersätts med direkt Supabase Auth eller ett
minimalt Matrundan-authkontrakt ovanpå Supabase.

Krav:

- befintlig RLS/JWT-modell bevaras;
- användar-ID:n får inte bytas implicit om de används i historisk data;
- strategi för befintliga fyra testidentiteter beslutas explicit;
- lösenordsreset/OAuth/inbjudningsflöden testas;
- kanoniska HTTPS-callbacks används där det är möjligt;
- framtida native callback kan läggas till utan att webbflödet ersätts.

**Exitkriterium:** användaren kan autentisera sig utan Lovable Cloud Auth och får
samma servervaliderade gruppåtkomst som tidigare.

### Fas 3 – separat Supabase-målmiljö

Skapa en ny Supabase-miljö utan att koppla bort nuvarande produktion.

- återskapa schema från repots migrationer;
- verifiera att migrationer är deterministiska från tom databas;
- kontrollera extensions och providerberoenden;
- migrera produktdata med tabellcounts och invariants före/efter;
- migrera eller återetablera auth enligt beslutad strategi;
- kontrollera `SECURITY DEFINER`, låst `search_path` och grants;
- kontrollera konto-radering;
- kontrollera cross-group-isolering;
- kör `supabase/production-preflight.sql`;
- gör autentiserad smoke test med verklig gruppkontext.

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
- grupp-/besökskoppling;
- delete/retention;
- delade besöksregler;
- backup;
- ingen publik bucket-listning;
- inga credentials i klienten.

**Exitkriterium:** ett privat foto kan skapas, läsas och raderas med samma eller
starkare integritetsgarantier som i dag.

### Fas 5 – backup och disaster recovery

Supabase Free får endast bli produktionskälla om Matrundan samtidigt har en
verifierad extern recoveryväg.

Backuplösningen ska minst täcka:

- schema och migrationsversion;
- applikationsdata;
- authidentiteter eller dokumenterad återetableringsstrategi;
- privat media;
- nödvändig icke-hemlig konfigurationsmetadata.

Secrets ska inte ligga i backupfilen. De ska kunna återskapas från separat
secret store/process.

Ett schemalagt jobb får använda GitHub Actions eller Cloudflare beroende på vad
som vid implementationstillfället är säkrast och mest kostnadseffektivt. Själva
backupobjekten ska inte lagras som kortlivade GitHub Actions-artifacts.

Rekommenderat mål är off-site objektlagring, exempelvis R2, med retention för
flera generationer.

#### Restore-test

Minst en gång före cutover ska en backup återställas till en separat tom
miljö. Testet ska dokumentera:

1. skapa tom backend;
2. applicera schema/migrationer;
3. återställ data;
4. återetablera auth;
5. återkoppla media;
6. konfigurera secrets/callbacks;
7. kör preflight;
8. kör autentiserad smoke test.

**Exitkriterium:** frågan "hur återställer vi Matrundan om hela Supabase-projektet
försvinner?" har ett genomfört, inte bara teoretiskt, svar.

### Fas 6 – driftvakter, observability och kostnad

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

Loggar får inte innehålla privata gruppfält, rå providerpayload eller secrets.

Efter migration ska en faktisk kostnads-/quota-baseline dokumenteras. Geoapify
ska följas separat eftersom karttiles, autocomplete och placesökning kan bli en
tidigare kapacitetsgräns än hosting eller auth.

### Fas 7 – parallell verifiering och cutover

Före cutover:

- ny Cloudflare deployment pekar på mål-Supabase;
- exakt release/head-SHA dokumenteras;
- demo/exempel fungerar;
- autentiserat live-läge fungerar;
- inloggning/reset testas;
- grupper och medlemskap testas;
- sökning, boundaries och karta testas;
- platsdetalj och praktisk information testas;
- besök, deltagare och omdömen testas;
- privat media testas;
- delning testas;
- push testas där möjligt;
- konto-radering testas;
- mobil 360 px och desktop verifieras.

#### Datafrysning

Om data måste kopieras en sista gång ska ett kort och explicit fönster användas.
Vi ska hellre ha en kontrollerad read-only/cutoverprocedur än att införa
komplicerad dual-write bara för att undvika några minuters planerad övergång.

#### Rollback

Rollback ska beskriva:

- vilken miljö som är source of truth vid varje steg;
- när skrivningar måste stoppas;
- hur gamla Lovable-produktionen återaktiveras om cutover misslyckas;
- hur nya skrivningar efter cutover hanteras om rollback ändå krävs.

Ingen DNS/publiceringsändring görs utan uttryckligt publiceringsgodkännande.

### Fas 8 – avveckla Lovable som runtimekrav

Först när den nya miljön varit verifierad stabil:

- ta bort överflödiga `@lovable.dev/*` runtime/buildberoenden;
- ta bort Lovable-specifik auth;
- uppdatera `.env.example` till faktisk deploymentmodell;
- uppdatera `docs/architecture.md` till faktisk produktionskedja;
- uppdatera `docs/development-workflow.md` så Cloudflare branch preview ersätter
  Lovable-previewgrinden där den är relevant;
- uppdatera `AGENTS.md` och `README.md`;
- bedöm om Lovable-projektet ska behållas för frivillig UX-konsultation.

Lovable kan fortsatt vara ett designverktyg. Det ska bara inte vara ett krav för
att Matrundan ska gå att bygga, testa, driftsätta eller använda.

## Säkerhetsgrindar

Migrationen får inte försämra följande:

- aktivt gruppmedlemskap kontrolleras server-side;
- känsliga cross-group-läsningar förblir minimerade;
- service-role finns endast server-side;
- raw providerpayload förblir server-side;
- privata foton kan inte listas eller läsas utan auktoriserad kontext;
- kontoradering fortsätter scrubba användarreferenser enligt arkitekturreglerna;
- backup innehåller inte secrets;
- backupmål ger inte bredare åtkomst än produktionskällan;
- caching får inte blanda privat data mellan användare eller grupper.

## Leverantörsexit

Efter migration ska följande exitvägar vara rimliga:

### Cloudflare

Appens domänkod och TanStack-build ska inte kräva Cloudflarebindings utanför
små deployment/runtimeadapters. Ett framtida byte till annan JS-runtime får
kräva deployarbete men inte omskrivning av grupp- eller datamodellen.

### Supabase

Supabase används för att det passar dagens Postgres/RLS/RPC/Auth-modell, inte för
att Matrundan ska bli proprietärt Supabase-format. Schema och affärslogik ska
fortsatt finnas i versionerade migrationer i repo. Om ett framtida byte från
Supabase blir motiverat ska vanlig PostgreSQL vara en realistisk migrationsväg,
med auth/storage som separata delprojekt.

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

- exakt Cloudflare deploymentadapter för aktuell TanStack/Nitro-version;
- om media ska ligga i Supabase Storage eller R2 efter cutover;
- exakt backupmotor och retention;
- exakt authmigrationsmetod för befintliga identiteter;
- om keep-alive behövs och tillåts enligt då aktuella Supabase-villkor;
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