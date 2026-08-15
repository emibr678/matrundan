# Observability och felsökning

**Status:** arkitekturunderlag för #207 – Frikoppla drift från Lovable Cloud och etablera portabel plattform  
**Scope:** observability, felsökning och driftlarm; ingen runtimeimplementation genom detta dokument

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
Exakt transport beslutas under implementation; Sentry, Datadog eller annan extern
APM är inte ett krav.

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
