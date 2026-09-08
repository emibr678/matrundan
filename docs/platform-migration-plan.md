# Plattformsmigration och portabilitet

**Status:** kärnmigrationen är tekniskt genomförd; Issue #207 är öppen för sista verifierade Lovable-avvecklingsgrind  
**Styrande issue:** #207 – Frikoppla drift från Lovable Cloud och etablera portabel plattform

Det här dokumentet beskriver Matrundans **aktuella plattformsmodell** och de
varaktiga portabilitetsprinciper som ska bevaras efter migrationen. Den tidigare
detaljerade fasplanen har fullgjort sitt syfte; operativ migrationshistorik och
kvarvarande checkpoint-evidens finns i Issue #207 och berörda PR:er.

Dokumentet godkänner inte merge, databasdriftsättning, destruktiv avveckling eller
publicering. De stegen följer fortsatt `docs/development-workflow.md` och kräver
separata godkännanden.

## Nuvarande driftmodell

Matrundans produktionsruntime är inte längre beroende av Lovable Cloud.

```text
GitHub
  |
  v
Cloudflare Workers
  - staging.matrundan.workers.dev
  - app.matrundan.workers.dev
  |
  +---------------------------+
  |                           |
  v                           v
Supabase Staging          Supabase Production
  - staging/previews       - publik production
  - Postgres/Auth           - Postgres/Auth
  - RLS/RPC/Storage         - RLS/RPC/Storage
```

Den låsta miljömodellen är:

- Wrangler-miljö `staging` → Worker `staging` →
  `https://staging.matrundan.workers.dev` → Supabase **Matrundan Staging**;
- Wrangler-miljö `prod` → Worker `app` →
  `https://app.matrundan.workers.dev` → Supabase **Matrundan Production**;
- PR-/featurepreview får använda stagingresurser eller demo/fixtures, aldrig
  produktionshemligheter eller produktionsskrivningar;
- merge till `main` är inte i sig databasdriftsättning eller productionpublish;
- productionpromotion kräver den separata preflight-/publiceringsprocess som
  repot definierar.

Geoapify/OSM, MapLibre, Web Push/VAPID och övriga externa tjänster ligger fortsatt
bakom avgränsade integrationsytor. Supabase är dagens auktoritativa data-/authlager,
men dess integrationsytor får inte bli Matrundans domänmodell.

## Lovables roll efter migrationen

Lovable är ett **valfritt UX-/editor- och previewverktyg**, inte hosting-, auth-
eller databasruntime för production.

När Lovable uttryckligen används:

- ska arbetet ske på en verifierad dedikerad branch;
- ska Lovable-preview använda Supabase **Matrundan Staging**;
- får Lovable inte kopplas till Supabase Production eller användas som en genväg
  runt PR-/CI-/publiceringsflödet;
- är preview granskning, inte publication.

Issue #207 hålls öppen tills den tidigare Lovable-publiceringen/runtime-backenden
kan avvecklas efter den dokumenterade externa grinden. Permanent borttagning av
den gamla Lovable Cloud-databasen är dessutom en separat destruktiv åtgärd och
kräver uttrycklig bekräftelse efter verifiering att inga runtime-, OAuth- eller
secretkontrakt längre pekar dit.

## Varaktiga portabilitetsprinciper

### Matrundans domän ägs inte av hostingplattformen

Grupp, medlemskap, kanoniska platser, besök, deltagare, omdömen, delning och
progression är Matrundans domän. Affärs- och integritetsregler får inte flyttas
till leverantörsspecifika callbacks, deploymentfiler eller UI-komponenter bara
för att en viss plattform gör det bekvämt.

Hosting/runtime, auth delivery, media/storage, notisleverans, schemalagda jobb,
kart-rendering, platsprovider, secrets/configuration och observability behandlas
som plattformsadapters med tydliga kontrakt.

### Webben är en klient, inte säkerhetsgränsen

Web/PWA är dagens primärklient. Server/RPC/RLS ska fortsatt avgöra känsliga
behörigheter, gruppisolering och identitetsövergångar.

Backendkontrakt, authmodell, deep links, mediaåtkomst och notisavsikt ska kunna
återanvändas av en framtida native-klient utan att Matrundans kärnmodell behöver
omdefinieras. Det motiverar inte ett monorepo eller spekulativa wrappers i förväg.

### Miljöer och secrets får inte flyta ihop

- Productionsecrets och service-role får aldrig ges till vanliga branchpreviews.
- Browserexponerad konfiguration är inte en säkerhetsgräns; RLS och
  servervalidering måste bära behörigheten.
- Auth-, invite-, session- och signed-URL-tokens får inte hamna i vanliga loggar.
- Dynamiska previewmiljöer får inte motivera breda productionwildcards när ett
  snävare kontrakt är möjligt.

### Återställningsbar data ska kunna lämna leverantören

Stateful produktdata ska ha dokumenterad backup/export och verifierbar recovery.
Off-site backup, restore-test, RPO/RTO och återställningskontroller är driftkrav,
inte något som delegeras implicit till hosting- eller databasleverantören.

### Stabil publik identitet

Publika länkar ska bygga på konfigurerad HTTPS-bas-URL, inte spridda hårdkodade
hostnamn i domänlogik. En framtida egen domän eller native Universal/App Links
ska kunna införas utan att grupp-, besöks- eller inbjudningsidentiteter byts ut.

### Media och notiser

Privata mediaobjekt ska auktoriseras genom Matrundans regler; bucket-ACL eller
signerade länkar är mekanismer, inte domänbeslut. Signerade länkar behandlas som
kortlivade bearer tokens.

Notissystemet ska fortsatt skilja mellan **notisavsikt** (vem som ska få vilken
privat händelse) och **deliverykanal** (Web Push i dag, eventuellt annan transport
senare).

### Kartor och platsprovider

Kanoniska koordinater, platsidentitet och provideridentitet är produktdata.
MapLibre är dagens renderare och Geoapify är dagens platsprovider; inget av dem
får bli en del av den kanoniska platsidentiteten på ett sätt som gör ett framtida
byte till en domänmigration.

## Leverans- och driftgränser

Följande är alltid separata statusar:

1. implementation på branch;
2. verifiering/CI;
3. merge till `main`;
4. eventuell Lovable-synk/preview när den uttryckligen efterfrågats;
5. databasdriftsättning;
6. productionpublicering.

En grön eller mergad PR innebär alltså inte automatiskt att databasen eller
production har ändrats.

## Kvar i Issue #207

Kärnmigrationen till Cloudflare + separat Supabase Production är genomförd och
production har verifierats. Det kvarvarande arbetet i #207 är därför inte en ny
plattformsmigration utan den slutliga, verifierade avvecklingen av den tidigare
Lovable-runtimeytan och relaterad destruktiv cleanup efter dess egna grindar.

Den operativa historiken — migrations-SHA:er, preflights, cutover, backup/recovery,
Lovable-checkpoints och tidigare riskundantag — hör i Issue #207 och respektive
PR. Det här dokumentet ska inte återgå till att fungera som en parallell
statuslogg.
