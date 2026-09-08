# Public repository readiness

Matrundan ska kunna förberedas för offentlig repository-visibility utan att ett
sådant beslut blandas ihop med produktrelease, databasdriftsättning eller
publicering av appen.

Det här dokumentet är en säkerhets- och underhållschecklista. Att checklistan är
uppfylld gör **inte** repot publikt.

## Grundprinciper

- Produktens privata gruppdata, användardata och serverhemligheter får aldrig
  ligga i Git-repot.
- Browser-exponerade nycklar behandlas som publika och begränsas hos leverantören
  med origin/referrer-regler där det stöds.
- Serverhemligheter ligger i deployment-/runtime-miljön och aldrig i `VITE_*`-
  variabler eller versionshanterade filer.
- Demo- och exempeldata i repot ska vara uttryckligen fiktiva och får inte
  härledas från riktiga privata grupper.
- Ett visibility-byte är en separat administrativ åtgärd som kräver uttryckligt
  godkännande.

## Miljöfiler och leverantörskonfiguration

Production körs via Cloudflare Workers och Supabase **Matrundan Production**.
Staging och branch-preview använder Cloudflare staging och Supabase **Matrundan
Staging**. Lovable är ett valfritt UX-/editor-/previewverktyg och får vid användning
bara arbeta mot staging, aldrig Production eller den historiska Lovable Cloud-
runtimeytan.

Ingen `.env` ska versionshanteras. Den kanoniska exempelkonfigurationen är
`.env.example`, medan lokala privata overrides använder `.env.local` eller
motsvarande ignorerad fil.

Browserkonfiguration som Supabase publishable key och andra public-safe `VITE_*`-
värden är inte hemligheter, men ska ändå peka på rätt miljö. Serverhemligheter
som Supabase secret/service-role, databaslösenord, privata providernycklar, VAPID
private key och access tokens får aldrig checkas in.

## Före varje framtida visibility-byte

### 1. Aktuellt träd

- Kör `bun run verify:full` i en fullständig checkout.
- Kör `bun scripts/public-readiness-check.mjs` efter att alla relevanta refs har
  hämtats.
- Verifiera att ingen `.env` eller annan privat secret-fil är versionshanterad.
- Verifiera att `.env.example` tydligt skiljer browser-exponerade värden från
  serverhemligheter och endast använder placeholders för privata värden.
- Verifiera att staging- och produktionskonfiguration inte kan blandas ihop genom
  tracked defaults.

### 2. Hela Git-historiken och refs

`scripts/public-readiness-check.mjs` söker efter ett litet antal starka
hemlighetsmönster i lokalt nåbara Git-refs utan att skriva ut misstänkta värden.
Den är ett skyddsräcke, inte en fullständig secretscanner.

Före faktisk offentlig visibility ska dessutom:

- alla remote branches och tags hämtas;
- gamla feature-, backup-, ops- och Lovable-brancher granskas;
- workflowen **Public readiness** med Gitleaks köras history-aware mot hela den
  hämtade historiken;
- tidigare exponerad riktig hemlighet roteras även om den senare har tagits bort
  från historiken.

Skriv inte om Git-historiken enbart för kosmetik. Om en riktig hemlighet hittas
ska rotation komma först; eventuell historikrensning är en separat riskbedömd
operation.

Vid lokal slutkontroll kan samma history-aware kontroll köras med:

```text
gitleaks git --redact=100 --log-opts="--all" .
```

Gitleaks-undantag ska vara exakta, immutabla fingerprints. Hela filer, `.env`
generellt eller nyckelnamn ska inte allowlistas. Skanningsrapporter med
misstänkta värden får inte laddas upp som publika artifacts.

Historiska public-readiness-kontroller är bara evidens för den revision som då
granskades och ersätter aldrig en ny körning före visibility-byte.

### 3. GitHub-innehåll utanför kodträdet

Granska manuellt sådant som också blir offentligt:

- öppna och stängda Issues;
- PR-beskrivningar, kommentarer och reviewtrådar;
- Actions-loggar och artifacts;
- screenshots och uppladdade bilagor;
- releases och release-assets;
- projekt-/roadmaptext som inte är avsedd för extern insyn.

Privata foton, riktiga gruppnamn, e-postadresser, interna användar-/grupp-ID:n,
privata kommentarer eller autentiseringsmaterial får inte finnas där.

### 4. Leverantörsnycklar

- Supabase publishable key är browserkonfiguration och ska fortfarande skyddas
  av RLS och serverkontroller.
- Supabase secret/service-role får aldrig finnas i klienten eller Git.
- Browserexponerade provider-/kartnycklar ska ha så snäv origin/referrer-
  begränsning som praktiskt möjligt.
- Servernycklar och VAPID private key ska ligga enbart i servermiljön.

### 5. Rättigheter och licens

**Beslut 8 september 2026:** Matrundan ska inte få en open-source-licens. Den
projektägda källkoden är proprietär och **alla rättigheter förbehållna** enligt
`COPYRIGHT.md`.

Ett publikt repository innebär alltså synlig källkod, inte ett generellt tillstånd
att kopiera, modifiera, distribuera, driftsätta eller kommersialisera Matrundan.
Tredjepartsberoenden och assets fortsätter samtidigt att omfattas av sina egna
licenser och villkor.

Matrundan-namn, logotyp och eventuell framtida varumärkesstrategi är en separat
fråga från källkodens rättigheter.

### 6. `main`-skydd

Färsk kontroll 8 september 2026 visar att det privata repositoryts `main` inte
har aktiv branch protection. GitHubs repository-rulesets är samtidigt inte
tillgängliga för denna privata repo-/plankombination; API:t kräver uppgradering
till GitHub Pro eller publik repository-visibility.

Den minsta rekommenderade nivån när GitHub-kontot/visibilityn medger det är:

- ändringar till `main` via PR;
- relevanta gröna CI-kontroller före merge;
- blockera force-push och radering av `main`;
- ingen obligatorisk extern reviewer enbart för processens skull när projektet
  har en ensam maintainer.

Aktivering av repository-/branchskydd är en administrativ ändring och kräver
separat uttryckligt godkännande. Gör inte repot publikt enbart för att låsa upp
ruleset-funktionen.

### 7. Slutligt beslut

Före visibility-byte ska leveranskvittot minst ange:

- verifierad `main`-SHA;
- resultat från `bun run verify:full`;
- resultat från `bun scripts/public-readiness-check.mjs`;
- resultat från history-aware secretscan;
- vilka branches/tags som ingick;
- manuell granskning av Issues/PR/Actions/artifacts/releases;
- verifierade providerrestriktioner;
- det explicita proprietära/no-open-source-licensbeslutet;
- status för `main`-skydd;
- eventuella roterade nycklar;
- uttryckligt godkännande att ändra repository visibility.

Lovable-synk eller Lovable-preview är inte en generell public-repository-grind.
Den verifieras endast när det aktuella arbetet faktiskt använder Lovable.

Att appen redan är publik på webben ändrar inte dessa krav. En publik webbapp gör
produktidé och klientbeteende observerbart, medan ett publikt repo även exponerar
implementation, historik, interna dokument och utvecklingsspår.
