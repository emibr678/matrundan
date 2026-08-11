# Public repository readiness

Matrundan ska kunna förberedas för offentlig repository-visibility utan att ett sådant beslut blandas ihop med produktrelease, databasdriftsättning eller publicering av appen.

Det här dokumentet är en säkerhets- och underhållschecklista. Att checklistan är uppfylld gör **inte** repot publikt och är inte ett beslut om open-source-licens.

## Grundprinciper

- Produktens privata gruppdata, användardata och serverhemligheter får aldrig ligga i Git-repot.
- Browser-exponerade nycklar ska behandlas som publika och begränsas hos leverantören med origin/referrer-regler där det stöds.
- Serverhemligheter ska ligga i deployment-/runtime-miljön och aldrig i `VITE_*`-variabler eller versionshanterade filer.
- Demo- och exempeldata i repot ska vara uttryckligen fiktiva och får inte härledas från riktiga privata grupper.
- Ett framtida visibility-byte är en separat administrativ åtgärd som kräver uttryckligt godkännande.

## Lovable och den versionshanterade `.env`

Matrundan använder Lovable Cloud. Lovables nuvarande projektkontrakt använder en versionshanterad `.env` för projektets public-safe Supabase-/browserkonfiguration. Den filen ska därför **inte** tas bort eller generellt ignoreras som en vanlig lokal secret-fil.

Den versionshanterade `.env` får endast innehålla följande granskade public-safe konfiguration:

- `SUPABASE_PROJECT_ID`;
- `SUPABASE_PUBLISHABLE_KEY`;
- `SUPABASE_URL`;
- `VITE_SUPABASE_PROJECT_ID`;
- `VITE_SUPABASE_PUBLISHABLE_KEY`;
- `VITE_SUPABASE_URL`;
- `VITE_GEOAPIFY_MAPS_KEY`.

Supabase publishable key och `VITE_*`-värden ska behandlas som publika. Geoapify-kartnyckeln skickas till browsern och ska begränsas hos leverantören med tillåtna origins/referrers.

Följande får aldrig läggas i den versionshanterade `.env`:

- Supabase service-role/secret key;
- Geoapify servernyckel;
- VAPID private key;
- databaslösenord eller `DATABASE_URL`;
- access tokens, GitHub tokens eller andra privata credentials.

Lokala privata overrides ska använda `.env.local` eller motsvarande ignorerad fil. Serverhemligheter ska i normal drift konfigureras i Lovable/deploymentens secret store.

## Före varje framtida visibility-byte

### 1. Aktuellt träd

- Kör `bun run verify:full` i en fullständig checkout.
- Kör `bun scripts/public-readiness-check.mjs` efter att alla relevanta refs har hämtats.
- Verifiera att den tracked `.env` endast innehåller den uttryckliga public-safe whitelist som kontrollscriptet tillåter.
- Verifiera att inga andra `.env.*`, privatnyckel-, credentials- eller motsvarande secret-filer är versionshanterade.
- Verifiera att `.env.example` tydligt skiljer browser-exponerade värden från serverhemligheter och endast använder placeholders för privata värden.

### 2. Hela Git-historiken och refs

`scripts/public-readiness-check.mjs` söker efter ett litet antal starka hemlighetsmönster i alla lokalt nåbara Git-refs utan att skriva ut de misstänkta värdena. Den är ett skyddsräcke, inte en fullständig secretscanner.

Före faktisk offentlig visibility ska dessutom:

- alla remote branches och tags hämtas;
- gamla feature-, backup- och Lovable-brancher granskas;
- en etablerad history-aware secretscanner, exempelvis GitHubs egen secret scanning eller motsvarande lokalt verktyg, användas när den är tillgänglig;
- tidigare exponerad riktig hemlighet roteras även om den senare har tagits bort från historiken.

Skriv inte om Git-historiken enbart för kosmetik. Om en riktig hemlighet hittas ska rotation komma först; eventuell historikrensning är en separat riskbedömd operation.

### Reproducerbar Gitleaks-kontroll

Workflowen `Public readiness` kan startas manuellt och använder samma `MATRUNDAN_CI_RUNNER`-variabel som ordinarie CI. Den fungerar därför både med GitHub-hosted och self-hosted runner. Workflowen kör både repots egen grundkontroll och Gitleaks 8.30.1 mot hela den hämtade historiken.

Gitleaks-undantag ligger i `.gitleaksignore` som exakta, immutabla fingerprints. Hela filer, `.env` generellt eller nyckelnamn allowlistas inte. En ny eller flyttad träff måste därför granskas på nytt.

Vid lokal slutkontroll:

```text
gitleaks git --redact=100 --log-opts="--all" .
```

Skanningsrapporter med misstänkta värden får inte laddas upp som publika artifacts. Den manuella workflowen har därför kommentarer, summary och rapport-artifact avstängda.

#### Verifierad basrevision 2026-08-11

- Kandidat: `2db98fbc888118059dbdbfcd4f408c5977e7def4`.
- Scanner: Gitleaks 8.30.1, officiell Windows x64-release med verifierad SHA-256-checksumma.
- Omfattning: 1 362 commits, alla sex dåvarande GitHub-brancher, inga tags samt lokalt tillgängliga merge-refs för PR #170 och PR #172.
- Resultat före exakt allowlist: åtta `generic-api-key`-träffar.
- Klassificering: två Supabase publishable-konfigurationer i historiska versioner av `.env`, browsernyckeln `VITE_GEOAPIFY_MAPS_KEY` samt två lokala lagringsnycklar i klientkod.
- Inga Supabase secret/service-role-nycklar, privata nyckelblock, GitHub PAT, AWS access keys eller server-secret-tilldelningar hittades.
- Issues/PR-sökning på starka secret-mönster gav endast dokumenterade variabelnamn i #171/PR #172 och äldre Geoapify-härdning i PR #1; en separat innehållskontroll hittade inga värdetilldelningar eller starka tokenmönster där.

Revisionen är ett kvitto för den angivna SHA:n, inte ett evigt godkännande. Kör om workflowen och granska GitHub-innehåll utanför Git före ett faktiskt visibility-byte.

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
- Supabase service-role/secret key får aldrig finnas i klienten eller Git.
- Geoapify-kartnyckel som används i browsern ska ha så snäv origin/referrer-begränsning som möjligt.
- Servernycklar för Geoapify och VAPID private key ska ligga enbart i servermiljön.

### 5. Licens och varumärke

Repository-visibility och licens är separata beslut.

Innan repot görs publikt ska ägaren uttryckligen välja licensstrategi. Tills dess ska ingen open-source-licens läggas till av bekvämlighet. Ett publikt repo utan uttrycklig open-source-licens ska inte beskrivas som open source.

Matrundan-namn, logotyp och eventuell framtida varumärkesstrategi bedöms separat från källkodslicensen.

### 6. Slutligt beslut

Före visibility-byte ska leveranskvittot minst ange:

- verifierad `main`-SHA;
- resultat från `bun run verify:full`;
- resultat från `bun scripts/public-readiness-check.mjs`;
- resultat från history-aware secretscan;
- vilka branches/tags som ingick;
- manuell granskning av issues/PR/Actions/artifacts;
- verifiering att Lovable fortfarande bygger/previewar från exakt kandidat;
- licensbeslut;
- eventuella roterade nycklar;
- uttryckligt godkännande att ändra repository visibility.

Att appen redan är publik på webben ändrar inte dessa krav. En publik webbapp gör produktidé och klientbeteende observerbart, men ett publikt repo exponerar även implementation, historik, interna dokument och utvecklingsspår.
