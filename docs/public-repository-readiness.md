# Public repository readiness

Matrundan ska kunna förberedas för offentlig repository-visibility utan att ett sådant beslut blandas ihop med produktrelease, databasdriftsättning eller publicering av appen.

Det här dokumentet är en säkerhets- och underhållschecklista. Att checklistan är uppfylld gör **inte** repot publikt och är inte ett beslut om open-source-licens.

## Grundprinciper

- Produktens privata gruppdata, användardata och serverhemligheter får aldrig ligga i Git-repot.
- Browser-exponerade nycklar behandlas som publika och begränsas hos leverantören med origin/referrer-regler där det stöds.
- Serverhemligheter ligger i deployment-/runtime-miljön och aldrig i `VITE_*`-variabler eller versionshanterade filer.
- Demo- och exempeldata i repot ska vara uttryckligen fiktiva och får inte härledas från riktiga privata grupper.
- Ett visibility-byte är en separat administrativ åtgärd som kräver uttryckligt godkännande.

## Miljöfiler och leverantörskonfiguration

Lovable är ett valfritt UX-/previewverktyg och inte Matrundans produktionsruntime. Produktion körs via Cloudflare Workers med separat Supabase Production; staging och branch-preview använder Matrundan Staging.

Ingen `.env` ska versionshanteras. Den kanoniska exempelkonfigurationen är `.env.example`, medan lokala privata overrides använder `.env.local` eller motsvarande ignorerad fil.

Browserkonfiguration som Supabase publishable key och `VITE_*`-värden är inte hemligheter, men ska ändå peka på rätt miljö. Serverhemligheter som Supabase secret/service-role, databaslösenord, privata Geoapify-nycklar, VAPID private key och access tokens får aldrig checkas in.

Lovable-preview får endast använda Matrundan Staging och får aldrig kopplas till Supabase Production eller det historiska Lovable Cloud-projektet.

## Före varje framtida visibility-byte

### 1. Aktuellt träd

- Kör `bun run verify:full` i en fullständig checkout.
- Kör `bun scripts/public-readiness-check.mjs` efter att alla relevanta refs har hämtats.
- Verifiera att ingen `.env` eller annan privat secret-fil är versionshanterad.
- Verifiera att `.env.example` tydligt skiljer browser-exponerade värden från serverhemligheter och endast använder placeholders för privata värden.
- Verifiera att staging- och produktionskonfiguration inte kan blandas ihop genom tracked defaults.

### 2. Hela Git-historiken och refs

`scripts/public-readiness-check.mjs` söker efter ett litet antal starka hemlighetsmönster i alla lokalt nåbara Git-refs utan att skriva ut de misstänkta värdena. Den är ett skyddsräcke, inte en fullständig secretscanner.

Före faktisk offentlig visibility ska dessutom:

- alla remote branches och tags hämtas;
- gamla feature-, backup-, ops- och Lovable-brancher granskas;
- en history-aware secretscanner, i dag workflowen **Public readiness** med Gitleaks, köras mot hela den hämtade historiken;
- tidigare exponerad riktig hemlighet roteras även om den senare har tagits bort från historiken.

Skriv inte om Git-historiken enbart för kosmetik. Om en riktig hemlighet hittas ska rotation komma först; eventuell historikrensning är en separat riskbedömd operation.

### Reproducerbar Gitleaks-kontroll

Workflowen **Public readiness** kan startas manuellt. Den kör både repots egen grundkontroll och Gitleaks mot hela den hämtade historiken. Runner-valet följer workflowens faktiska `runs-on`-kontrakt; det ska inte antas vara samma som ordinarie CI.

Gitleaks-undantag ligger i `.gitleaksignore` som exakta, immutabla fingerprints. Hela filer, `.env` generellt eller nyckelnamn allowlistas inte. En ny eller flyttad träff måste därför granskas på nytt.

Vid lokal slutkontroll:

```text
gitleaks git --redact=100 --log-opts="--all" .
```

Skanningsrapporter med misstänkta värden får inte laddas upp som publika artifacts.

Den historiska kontrollen från 2026-08-11 är endast evidens för den då granskade revisionen och ersätter inte en ny körning före ett framtida visibility-byte.

### 3. GitHub-innehåll utanför kodträdet

Granska manuellt sådant som också kan bli offentligt:

- öppna och stängda issues;
- PR-beskrivningar, kommentarer och reviewtrådar;
- Actions-loggar och artifacts;
- screenshots och uppladdade bilagor;
- releases och release-assets;
- projekt-/roadmaptext som inte är avsedd för extern insyn.

Privata foton, riktiga gruppnamn, e-postadresser, interna användar-/grupp-ID:n, privata kommentarer eller autentiseringsmaterial får inte finnas där.

### 4. Leverantörsnycklar

- Supabase publishable key är browserkonfiguration och ska fortfarande skyddas av RLS och serverkontroller.
- Supabase secret/service-role får aldrig finnas i klienten eller Git.
- Geoapify-kartnyckel som används i browsern ska ha så snäv origin/referrer-begränsning som möjligt.
- Servernycklar för Geoapify och VAPID private key ska ligga enbart i servermiljön.

### 5. Licens och varumärke

Repository-visibility och licens är separata beslut. Innan repot görs publikt ska ägaren uttryckligen välja licensstrategi. Tills dess ska ingen open-source-licens läggas till av bekvämlighet.

Matrundan-namn, logotyp och eventuell framtida varumärkesstrategi bedöms separat från källkodslicensen.

### 6. Slutligt beslut

Före visibility-byte ska leveranskvittot minst ange:

- verifierad `main`-SHA;
- resultat från `bun run verify:full`;
- resultat från `bun scripts/public-readiness-check.mjs`;
- resultat från history-aware secretscan;
- vilka branches/tags som ingick;
- manuell granskning av issues/PR/Actions/artifacts;
- licensbeslut;
- eventuella roterade nycklar;
- uttryckligt godkännande att ändra repository visibility.

Lovable-synk eller Lovable-preview är inte en generell public-repository-grind. Den verifieras endast när det aktuella arbetet faktiskt använder Lovable.

Att appen redan är publik på webben ändrar inte dessa krav. En publik webbapp gör produktidé och klientbeteende observerbart, men ett publikt repo exponerar även implementation, historik, interna dokument och utvecklingsspår.
