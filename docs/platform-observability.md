# Observability och felsökning

**Status:** arkitektur- och driftkontrakt för #207 – Frikoppla drift från Lovable Cloud och etablera portabel plattform  
**Scope:** observability, felsökning och driftlarm

Matrundan ska gå att felsöka när verkliga användare stöter på problem utan att
observability blir en parallell lagringsyta för privat gruppdata. Strategin ska
vara liten, kostnadsmedveten och utbytbar.

## Mål

Ett oväntat produktionsfel ska normalt kunna kopplas till:

- ett ofarligt `request_id`/fel-ID;
- exakt release/head-SHA;
- environment;
- operation eller route-template;
- beroende som Supabase, Geoapify, storage eller push;
- säker felklass/felkod;
- duration och resultatstatus.

Felsökning ska inte kräva att kommentarer, omdömen, gruppnamn, e-postadresser,
exakta koordinater, foton eller andra privata payloads skrivs till centrala loggar.

## Releaseidentitet

Observability ska skilja mellan användarsynlig appversion och exakt deployad kod.
`APP_VERSION` är relevant för support och releasehistorik, medan en oföränderlig
Git-commit/head-SHA är den tekniska sanningen för vilken kod som körde.

Production och preview ska därför exponera eller injicera en säker releaseidentitet
vid build/deploy så att server- och klientfel kan kopplas till exakt commit utan
att runtime behöver fråga GitHub. Preview ska även bära environment/branch-kontekst
utan att den informationen används som behörighetsbeslut.

## Implementerad baslinje i migrationskandidaten

Migrationsbranchen etablerar följande leverantörsneutrala kontrakt. Detta avsnitt
beskriver kodens avsedda beteende; faktisk staging-/productiondrift räknas inte som
verifierad förrän motsvarande Worker-kandidat har byggts, driftsatts och smoke-
testats.

- Varje inkommande serverrequest får ett nytt ofarligt UUIDv4 `request_id`. Det
  skickas internt i `x-matrundan-request-id` och läggs även på svaret så samma ID
  kan användas vid felsökning utan att bära användar- eller gruppidentitet.
- Centrala apphändelser loggas som strukturerad JSON med stabila, minimerade fält.
  Råa Error-meddelanden, stacks, request bodies och providerpayloads ingår inte i
  det centrala kontraktet.
- Route/operation saneras innan loggning. Query och fragment tas bort, kända
  bearer-token-routes som `/inbjudan/$token` loggas som `/inbjudan/:token`, och
  UUID:n, numeriska ID:n samt långa opaka pathsegment ersätts med platshållare.
- `release_sha` byggs in i artefakten. Cloudflare Builds använder
  `WORKERS_CI_COMMIT_SHA`; GitHub-byggen kan använda `GITHUB_SHA` och explicit
  manuell byggning kan ange `MATRUNDAN_RELEASE_SHA`. Saknad eller ogiltig SHA
  blir `unknown` i stället för att gissas.
- Den strukturerade `environment`-etiketten härleds från känd deployment-host:
  `staging.matrundan.workers.dev` och dess preview-hostar ger `staging`, medan
  `app.matrundan.workers.dev` och dess version-/alias-preview-hostar ger `prod`.
  Lokal loopback ger `local` och övriga hostar `unknown`. Etiketten är aldrig ett
  behörighetsbeslut.
- Runtimevariabeln `MATRUNDAN_ENVIRONMENT=staging|prod` kompletterar hostetiketten
  som defense-in-depth för den mycket tidiga `console.error`-interceptionen, där
  det ännu inte finns någon Request-URL att klassificera. Den används endast för
  att redigera råa Error-meddelanden/stacks innan de når centrala Workers-loggar
  och får inte användas för behörighet.
- Cloudflares automatiska invocation logs är avstängda i repoets staging- och
  prodkonfiguration. De innehåller hela request-URL:en och är därför olämpliga
  så länge Matrundan har bearer-token i URL-path. Workers Logs för egna
  `console`-event förblir aktiverade.
- Browserfel går genom ett autentiserat, CSRF-skyddat serverfunktionskontrakt och
  skickar endast sanerad operation, säker felkod, mekanism och handled-status.
  State, DOM, formulärvärden, URL-query, stack och rått felmeddelande skickas inte.
- React root error boundary samt `window.error` och `unhandledrejection` använder
  samma browserkanal. Om felrapporteringen själv misslyckas sväljs det felet för
  att undvika rapporteringsloopar.
- Supabase Logs Explorer/Reports behålls som den minsta behöriga ytan när råare
  Auth/Postgres/API/Storage-detalj faktiskt behövs; den kopieras inte automatiskt
  till Matrundans centrala apploggar.

## Lager

### Server/runtime

Cloudflare Workers native logs, metrics och tracing är förstahandsval efter
plattformsmigrationen. Applikationsloggar ska vara strukturerade, helst JSON,
med stabila fältnamn.

Ett minimalt event kan exempelvis innehålla:

- `event`;
- `severity`;
- `request_id`;
- `release_sha`;
- `environment`;
- `operation`;
- `status`;
- `duration_ms`;
- `dependency`;
- `error_code`.

Leverantörsspecifika trace-ID:n får komplettera men ska inte vara Matrundans enda
korrelationsnyckel.

### Browser/client

Worker-loggar ser inte fel som endast inträffar i användarens browser. Web/PWA
ska därför kunna rapportera oväntade klientfel genom ett sanerat kontrakt.
Sentry, Datadog eller annan extern APM är inte ett krav.

Klientrapporten ska vara minimerad och får inte automatiskt skicka hela state,
DOM, formulärvärden, URL-query eller privata payloads.

### Backend

Supabase Logs Explorer/Reports används när felet ligger i Auth, Postgres, API
eller Storage och applikationsloggen inte räcker. Matrundans egna loggar ska
fortfarande använda säkra felklasser och inte slentrianmässigt kopiera råa
leverantörsfel till central loggning.

### Långsiktig felhistorik

Om Cloudflare/Supabase Free-retention visar sig vara för kort för Matrundans
sporadiska användningsmönster får ett litet leverantörsneutralt diagnostiklager
införas för oväntade fel. Det ska lagra metadata, inte fulla accessloggar eller
privat payload, exempelvis:

- fel-ID;
- timestamp;
- release;
- environment;
- operation;
- säker felkod;
- dependency;
- status.

Retention ska vara uttrycklig och dataminimerad. Ett sådant lager är en adapter
och får senare implementeras med databas, loggtjänst eller annan lösning utan att
produktkoden byggs runt en specifik APM-leverantör.

## Integritet och säkerhet

Normala driftloggar får inte innehålla:

- authheaders, JWT/sessiontokens eller refresh tokens;
- invitationstokens;
- signerade/presigned media-URL:er;
- service-role eller andra secrets;
- privata kommentarer eller reviewtexter;
- e-postadresser;
- gruppnamn eller privat gruppmetadata när det inte är absolut nödvändigt;
- rå providerpayload;
- exakta koordinater;
- fotoinnehåll.

Route templates och operationsnamn används hellre än råa URL:er. Detta är
särskilt viktigt för routes där en bearer-token ligger i path/query, exempelvis
inbjudningslänkar.

Råa felobjekt från databas och externa providers ska saneras innan central
loggning. När en låg-nivådetalj verkligen behövs för felsökning ska den hållas i
den minsta behöriga felsökningsytan och med kort retention.

## Korrelations-ID och användarvänligt fel-ID

Varje relevant serverrequest ska kunna få ett korrelations-ID som följer anropet
genom servergränser och externa beroenden när praktiskt möjligt.

Vid ett oväntat användarsynligt fel kan appen visa samma värde, eller en kort
ofarlig representation av det, som **fel-ID**. Då kan en användare rapportera ett
fel utan att skicka privat gruppdata eller tekniska loggar.

Fel-ID får inte koda användar-ID, grupp-ID eller annan känslig identitet.

Den första migrationskandidaten exponerar request-ID som response-header och
browserrapporten får tillbaka samma typ av fel-ID. Att visa ID:t direkt i en
användarsynlig felvy är inte ett krav för cutover om supportflödet ännu inte
behöver det; korrelationen ska däremot finnas tekniskt.

## Larm

Larm ska vara få och handlingsbara. Kandidater är:

- backupjobb misslyckas eller backup blir för gammal;
- cron/health check uteblir;
- ihållande eller kraftigt förhöjd 5xx-nivå;
- tydlig authfelspik;
- provider-/Geoapify quota- eller tillgänglighetsfel;
- push-outbox fastnar eller felkvoten blir uthålligt hög.

Enstaka användarfel, 404 eller felaktiga lösenord ska inte skapa larmbrus.

## Kostnad och retention

Observability ska dimensioneras efter Matrundans skala. Sampling, retention och
extern export införs först när behov finns. Observability får inte tyst bli den
dyraste delen av infrastrukturen.

När externa logg-/APM-tjänster övervägs ska beslutet väga:

- faktisk felsökningsnytta;
- browser/native crash reporting;
- retention;
- kostnad;
- datalokalitet/integritet;
- exportmöjlighet och leverantörsportabilitet.

Cloudflare/Supabase standardretention används som första driftbaseline. Ett
separat långtidslager införs först om faktisk användning visar att felsökning
behöver längre historik. Backupretention hanteras separat av recoverykontraktet
och får inte blandas ihop med loggretention.

## Exitkriterier för #207

Plattformsmigrationen är inte observability-mässigt klar innan:

1. serverloggar är strukturerade och innehåller release, environment, operation
   och korrelations-/fel-ID;
2. känsliga tokens och privata payloads är verifierat exkluderade från app- och
   plattformsloggar;
3. browserfel har en sanerad rapporteringsväg;
4. backup-/cron-/uthålliga 5xx-fel kan upptäckas utan manuell daglig kontroll;
5. retention och eventuell långsiktig diagnostikhistorik är dokumenterad;
6. observability-leverantören kan bytas utan att Matrundans domänmodell behöver
   ändras.
