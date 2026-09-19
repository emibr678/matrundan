# Matrundan – reproducerbar utvecklingsmiljö

Det här dokumentet är den kanoniska startpunkten för lokal utveckling, Codex och andra beständiga agentmiljöer.

## Runtime

`package.json` anger den exakta Bun-versionen i fältet `packageManager`. Samma version används av GitHub Actions och bootstrap-scriptet. Byt inte package manager och skapa inte en alternativ lockfil.

## Första start

Linux och macOS:

```bash
bash scripts/bootstrap-agent.sh
```

För en miljö som även ska köra mobila Playwright-kontroller:

```bash
bash scripts/bootstrap-agent.sh --with-chromium
```

I ChatGPT Work kan systempaket och Playwrights browser-CDN vara blockerade trots
att checkout, Bun och appserver fungerar. Använd då den opt-in portabla
Work-browsern för en riktad visuell loop:

```bash
bun run test:visual-smoke:work -- /?demo=1
```

Kommandot hämtar Chromium från en versions- och SHA-256-låst GitHub-release till
användarens cache, startar Vite och Playwright i samma exekveringssession och
skriver screenshots till den git-ignorerade katalogen `visual-review/`. Lägg
till `--desktop` efter routen när layouten även behöver granskas vid 1280 px.
Nedladdningen sker endast första gången versionen används och påverkar inte
projektets vanliga dependencies eller GitHub Actions. Den portabla browsern kör
utan browser-sandbox i den isolerade Work-containern och ska endast användas mot
den lokala Matrundan-appen, aldrig för godtyckliga externa webbplatser. Flera
routes körs sekventiellt eftersom Work-browserns enkelprocessläge inte kan
återanvändas säkert mellan parallella testkontexter.

Scriptet är idempotent och gör endast följande:

1. läser den låsta Bun-versionen från `package.json`;
2. installerar eller aktiverar exakt den versionen vid behov;
3. kör `bun install --frozen-lockfile`;
4. installerar Chromium endast när `--with-chromium` används;
5. kör miljökontrollen.

Det ändrar inte `package.json`, `bun.lock`, produktkod eller Git-historik.

## Codex Cloud

Skapa eller redigera Codex-miljön för repot `emibr678/matrundan` och använd följande inställningar.

Setup script:

```bash
bash scripts/codex-cloud-setup.sh
```

Maintenance script:

```bash
bash scripts/codex-cloud-maintenance.sh
```

Rekommenderade miljöinställningar:

- agent internet access: **Off**;
- extra environment variables: inga krävs för demo, tester eller build;
- secrets: inga krävs för normal implementation och verifiering;
- package manager: använd endast den Bun-version som `package.json` anger;
- cache: återställ efter första aktiveringen av DX1B eller när verktygskedjan ändras inkompatibelt.

Setup-scriptet körs när en ny container förbereds. Det installerar den låsta Bun-versionen, projektets beroenden och Chromium. Det sparar även Bun-sökvägen i `~/.bashrc`, eftersom Codex kör setup och agentarbete i separata shellsessioner.

Maintenance-scriptet körs när en cachad container återanvänds. Det säkerställer aktuell Bun-version, låsta beroenden och en Chromium-version som matchar installerad Playwright.

Lägg inte produktionshemligheter i repot. Codex environment variables är tillgängliga även under agentfasen, medan Codex secrets endast ska användas för setupbehov och inte kan förutsättas finnas när agenten kör appen. Live-testhemligheter införs endast genom ett separat godkänt säkerhetspaket.

Första rökprovet i en ny Codex-miljö ska vara en läs- och verifieringsuppgift utan filändringar:

```text
Kör bun run doctor och bun run verify:changed. Ändra inga filer. Redovisa exakta kommandon och resultat.
```

## Exekveringslägen

Repot ska fungera i två agentlägen:

- **Checkout-läge** — lokal utveckling eller Codex med verifierad checkout. Här
  kan de kanoniska kommandona nedan köras före push.
- **Connector-läge** — exempelvis ChatGPT via GitHub-appen utan lokal checkout.
  Här sker läsning och skrivning genom GitHub API och lokala kommandon får inte
  påstås vara körda.

I connector-läge ska relaterade flerfilsändringar normalt batchas genom Git Data
API i en enda checkpoint:

```text
blobs → tree → commit → fast-forward ref
```

Utgå från verifierad aktuell branch/head och dess tree. Skapa inte en commit per
fil när ändringarna hör ihop, och skapa aldrig en no-op-commit enbart för att
starta CI. Håll PR:n draft under API-iteration. Om connectorn saknar en nödvändig
Git Data-operation används minsta möjliga antal filvisa commits och begränsningen
redovisas i PR:n.

Connector-läge ger inte en implicit shellmiljö. GitHub-baserad verifiering används
när repot exponerar en sådan väg; annars ska full CI sparas till en sammanhängande
kandidat i stället för att användas efter varje API-skrivning.

## Kanoniska kommandon

Kontrollera miljön:

```bash
bun run doctor
```

Kontrollera alla shellscript:

```bash
bun run check:shell
```

Kontrollera att shadcn/UI-primitiver faktiskt nås från appens entrypoints:

```bash
bun run check:dead-code
```

Kontrollen är avsiktligt smal och snabb. Den fångar oanvända filer under `src/components/ui` utan nätverksåtkomst eller en tung generell analyspipeline.

Formatera endast ändrade filer:

```bash
bun run format:changed
```

Prettier och ESLint är separata kontroller. ESLint analyserar kodregler och arkitekturgränser; Prettier verifierar format utan att köras en andra gång genom ESLint.

Typkontrollera Bun-enhetstesterna och deras importerade produktkod:

```bash
bun run typecheck:unit
```

Typkontrollera Playwright-konfigurationen och browsertesterna:

```bash
bun run typecheck:e2e
```

Verifiera ändrade filer, shellscript, dödkodsskydd, enhetstester, app-, enhetstest- och browsertypning samt produktionsbygge:

```bash
bun run verify:changed
```

Kör den relevanta agentverifieringen, inklusive mobil Chromium när UI har ändrats:

```bash
bun run verify:agent
```

Kör en snabb preliminär mobilkontroll av Playwright-filer som har ändrats eller importerar ändrad kod:

```bash
bun run test:mobile:changed -- --only-changed=origin/main
```

`--only-changed` använder Playwrights beroendegraf och är en snabb heuristik. Den kan missa indirekt berörda E2E-flöden där testet endast navigerar till appen. En färdig UI-kandidat måste därför fortfarande köra hela relevanta mobilsviten.

Kartans WebKit- och desktopmatris körs alltid i redo-CI. Den kan även köras lokalt:

```bash
MATRUNDAN_VERIFY_WEBKIT=1 bun run verify:agent
```

Fulla repoövergripande kontroller finns kvar för releasekandidater:

```bash
bun run verify:full
```

Global skrivande formattering är avsiktligt explicit:

```bash
bun run format:all
```

Cloudflare-artefakten byggs och valideras med:

```bash
bun run cloudflare:build
```

## Serverfunktioner och CSRF

Projektets egen `src/start.ts` ska behålla TanStack Starts CSRF-middleware för alla serverfunktioner. Bearer-token, medlemskap och rollkontroller är separata behörighetsskydd och ersätter inte origin-skyddet.

Det normerande beslutet och verifieringskraven finns i [`docs/security/server-functions-and-csrf.md`](docs/security/server-functions-and-csrf.md).

## Hur ändrade filer bestäms

`scripts/repo-tools.mjs` använder i denna ordning:

1. `MATRUNDAN_BASE_SHA` när det är satt;
2. merge-base mot `origin/main`;
3. föregående commit som reserv.

Dessutom inkluderas staged, unstaged och otrackade filer. Samma klassificering används av lokala kommandon och CI för formattering, lint och val av browsertester.

## CI

De statiska kontrollerna och browserverifieringen körs i separata jobb. Ett browsertestfel kan därför läsas och återköras utan att döljas längst ned i samma jobb som format, typning och bygge.

Draft-PR startar inga runnerjobb i GitHub Actions. I checkout-läge körs under implementation och diagnostik de kanoniska lokala/Codex-kontrollerna, normalt:

```bash
bun run verify:changed
```

och för UI:

```bash
bun run verify:agent
```

I connector-läge hålls PR:n också draft under iteration, men agenten får inte
låtsas att lokala kontroller har körts. Använd en särskild GitHub-baserad riktad
verifiering när en sådan finns. Om den saknas ska branchdiffen och relevant
impact granskas först och PR:n flyttas till ready först när kandidaten är stabil
nog att motivera full CI.

Det gör att en serie draft-pushar inte förbrukar GitHub-hostade minuter. När PR:n markeras redo, när en redan redo PR uppdateras, när `main` uppdateras eller vid manuell workflow-körning körs full CI. För UI ingår hela mobil Chromium-sviten; kartrelaterade ändringar kör även WebKit/iPhone och desktop Chromium.

Ordinarie **CI** kör explicit på GitHub-hostad `ubuntu-24.04`. Andra workflows kan ha egna dokumenterade runnerkontrakt; läs deras faktiska `runs-on` i stället för att anta att `MATRUNDAN_CI_RUNNER` styr hela repot. På GitHub-hostade Linux-runners installerar Playwright både browser och systemberoenden i jobbet.

### Agent Operations i connector-läge

När GitHub-connectorn inte kan starta `workflow_dispatch` direkt används den
owner-only **Agent Operations**-bryggan via en vanlig Issue-kommentar. Bryggan
accepterar endast en explicit allowlist och tolkar aldrig fri shell- eller
workflowtext.

Tillåtna utvecklings-/verifieringskommandon är:

```text
/agent fast-verify <branch> <40-character-sha> [visual-path]
/agent public-readiness <40-character-main-sha>
/agent staging-db <branch> <40-character-sha> <pr-number> APPLY_STAGING_DB
```

`fast-verify` kräver att angiven branch fortfarande pekar exakt på SHA:n. Den
checkar ut just den kandidaten på GitHub-hostad `ubuntu-24.04`, kör
`verify:changed` och, när UI påverkas, changed mobile Playwright. Om en
`visual-path` anges körs dessutom en riktad 360 px visual smoke för den routen.
Denna väg använder inga produktionshemligheter och har endast `contents: read`.
Full redo-CI krävs fortfarande som mergekvitto för färdig kandidat.

`public-readiness` kräver att SHA:n fortfarande är exakt aktuell `main` och
startar endast repots read-only public-readiness/secret-scan. Den innebär inte
merge-, databas- eller publiceringsgodkännande.

`staging-db` får endast användas efter separat uttryckligt
stagingdatabasgodkännande. Kommandot kräver en öppen PR till `main`, exakt
branch/head-SHA, PR-nummer och den bokstavliga bekräftelsen
`APPLY_STAGING_DB`. Det separata workflowet kräver dessutom grön ordinarie CI
för samma PR/SHA, applicerar endast saknade repomigrationer mot Supabase
**Matrundan Staging** och verifierar migrationshistorik samt den exakta
Cloudflare-previewens `/api/health`. Productiondatabas och production-Worker
är inte åtkomliga från den vägen.

GitHub-environmenten `staging` använder samma
`STAGING_SUPABASE_ACCESS_TOKEN` för normal stagingkontroll och den separat
godkända stagingdatabasvägen. Tokenen ska vara projektbegränsad till Matrundan
Staging med **Migrations → Read-write**. Den normala Worker-deployen använder
dock endast tokenen för läsning av migrationshistoriken; skrivning sker endast
i `staging-db`-workflowet efter dess explicita DB-godkännande samt PR-/SHA-/CI-grindar.

Agent Operations-dispatchern själv har `actions: write` enbart för att starta de
tre allowlistade workflowen. Kommandon accepteras endast från repositoryägaren på
en vanlig Issue, aldrig från PR-kommentarer. Production- och
recoveryoperationer ingår inte i denna brygga.

### Releasekontrakt för staging-first

Feature-PR:er ska normalt inte höja `src/lib/matrundan/version.ts` eller skapa en
daterad releasepost i `CHANGELOG.md`. Användarsynlig kod eller migration kräver i
stället en kort svensk releasepunkt i PR-mallens markerade **Releaseunderlag**.
Ordinarie CI läser underlaget från PR-eventet.

När en separat releasekandidat skapas materialiseras valda mergade
releaseunderlag till riktig version, datum, `CHANGELOG.md` och in-app-historik.
Om `version.ts` ändras kräver releasekontrollen fortfarande en högre semver och
en samtidig changeloguppdatering. Redan pågående versionerade feature-PR:er
accepteras under övergången men är inte mönstret för nya features.

`Version: inte relevant` används fortsatt endast för dokumentations-, test- och
verktygsändringar utan användarsynlig kod eller migration. Push till `main`
validerar fortsatt den materialiserade releasehistorikens interna konsistens men
kräver inte PR-metadata på nytt.

## Cloudflare Workers-miljöer

Den låsta miljömodellen är:

- Wrangler-miljö `staging` → Worker `staging` → `staging.matrundan.workers.dev`;
- Wrangler-miljö `prod` → Worker `app` → `app.matrundan.workers.dev`;
- Supabase **Matrundan Staging** används av staging och PR-previews;
- Supabase **Matrundan Production** används endast av den explicit byggda `prod`-kandidaten och publicerade Worker `app`.

Repoets `wrangler.json` har medvetet Worker `staging` som säker top-level-default.
Det gör att ett oavsiktligt `wrangler deploy` utan `--env` inte kan rikta sig mot
Worker `app`. Normala Cloudflare Builds-kommandon ska ändå vara explicita:

```bash
npx wrangler deploy --env staging
npx wrangler versions upload --env staging
```

Cloudflare Worker `staging` ska ha GitHub-repot anslutet med:

- production branch: `main`;
- builds for non-production branches: på;
- build command: `bun run cloudflare:build`;
- deploy command: `npx wrangler deploy --env staging`;
- non-production branch deploy command: `npx wrangler versions upload --env staging`.

En feature-/PR-branch laddas då upp som en preview-version av staging-Workern utan
att ersätta dess aktiva deployment. En push till `main` uppdaterar den aktiva
stagingdeploymenten. Worker `app` får inte konfigureras så att merge till `main`
automatiskt promoverar produktion.

### Produktionskandidat och publicering

Produktion använder två separata manuella GitHub Actions-grindar:

1. **Cloudflare prod preflight** bygger exakt angiven `main`-SHA, validerar hela
   GitHub `production`-konfigurationen och leverantörscredentials, laddar upp
   server-secrets tillsammans med en **inert** Worker-version och exponerar den
   som den fasta preview-aliasen `https://prod-candidate-app.matrundan.workers.dev`.
   Workflowet verifierar att aktiv production-deployment är oförändrad och att
   kandidatens `/api/health` rapporterar exakt release-SHA.
2. Efter separat autentiserad smoke och separat publiceringsgodkännande får
   **Cloudflare prod publish** promovera **exakt samma Worker version-ID** till
   100 % trafik. Publiceringsworkflowet bygger eller laddar inte upp ny kod och
   vägrar en kandidat som inte kan kopplas till den angivna aktuella `main`-SHA:n.

Använd därför inte ett manuellt `wrangler deploy --env prod` som normal
publiceringsväg. Det skulle skapa en ny, ej smoke-testad version samtidigt som den
publiceras och bryta kontraktet att exakt verifierad kandidat ska promoveras.

Preflight och publish använder samma concurrency-grupp så en ny kandidat inte kan
laddas upp samtidigt som en tidigare kandidat promoveras. Publiceringsworkflowet
kräver dessutom exakt SHA, exakt Worker version-ID och bekräftelsetexten
`PUBLISH_PROD`; det är fortfarande inte ett godkännande i sig att workflowet finns
i repot.

Build-time `VITE_*`-värden hör till respektive byggmiljö. Server-only värden som
`GEOAPIFY_API_KEY`, Supabase secret/service-role och VAPID private key hör till
Worker-runtime secrets och får aldrig checkas in eller göras till `VITE_*`.
Prod-preflight läser produktionshemligheterna från GitHub-environmenten
`production` och skickar dem endast till den inerta kandidatversionen via
Wrangler `--secrets-file`; dashboardens Secret-Deploy eller `wrangler secret put`
ska inte användas som förberedande steg eftersom de kan skapa/aktivera en separat
version utanför kandidatgrinden.

`MATRUNDAN_ENVIRONMENT` är en icke-hemlig runtimevariabel med värdet `staging`
respektive `prod`. Den används som defense-in-depth för att redigera råa
Error-meddelanden/stacks innan de når centrala Workers-loggar. Den får inte
användas som behörighetsbeslut.

### Runnerkontrakt per workflow

Alla GitHub Actions-workflows kör explicit på GitHub-hostad `ubuntu-24.04`.
Repository-variabler får inte styra `runs-on`, och repository-scopade
self-hosted runners ska inte registreras för Matrundan. Det gör verifiering,
backup, recovery och produktionsjobb reproducerbara och isolerade från privata
utvecklingsmaskiner.

Workflows som använder staging- eller produktionshemligheter behåller sina
separata ref-, SHA-, environment- och bekräftelsegrindar. Alternativ lokal
körning görs som ett lokalt kommando, inte genom att registrera utvecklingsdatorn
som GitHub Actions-runner.

## Iterationsdisciplin

- Håll PR:n som draft medan implementation, visuell justering eller diagnostik pågår.
- I checkout-läge: pusha en sammanhängande kandidat efter riktad lokal kontroll, inte varje experiment.
- I connector-läge: batcha relaterade API-skrivningar till sammanhållna commits och undvik att en filändring blir en egen CI-trigger.
- Om en redo-PR behöver flera nya hypoteser eller visuella iterationer ska den flyttas tillbaka till draft innan fler pushar.
- Lovable ska användas på en avgränsad branch eller sandbox. Undvik en serie små direktpushar till `main`.
- Exakta pixelgränser i E2E-test ska endast användas när pixelmåttet är ett avsiktligt stabilt kontrakt. För normal responsiv UX föredras ordning, overflow, minsta tryckyta och robusta relativa relationer.

## Skyddsräcken

- `bun.lock` får inte ändras utan `package.json`.
- Ändrade beroenden i `package.json` kräver motsvarande `bun.lock`.
- Alternativa lockfiler är fel.
- Workflowändringar ska granskas uttryckligen.
- CI får inte patcha, committa eller pusha produktkod.
- Skapa inte commits endast för att trigga CI.
- Använd en branch och en draft-PR per godkänt sammanhängande paket.