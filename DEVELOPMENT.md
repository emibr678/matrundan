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

Draft-PR kör:

- miljökontroll;
- lockfils- och verktygsskydd;
- syntaxkontroll av shellscript;
- release-, databas- och dödkodskontrakt;
- Prettier och ESLint på ändrade filer;
- alla enhetstester under `src`;
- TypeScript för appkod, Bun-enhetstester och Playwright-svit;
- produktionsbygge;
- en preliminär mobil Chromium-körning med `--only-changed` när UI har ändrats.

Den preliminära browserkörningen har ingen automatisk retry och stoppar vid första fel. Syftet är snabb diagnostik, inte att ersätta full regressionsverifiering.

När PR:n markeras redo, när `main` uppdateras eller vid manuell körning körs i stället hela mobil Chromium-sviten för UI-ändringar samt WebKit och desktop Chromium för kartrelaterade ändringar.

Playwrights browserfiler cachelagras per runner, lockfil och kartbehov. Systemberoenden verifieras fortfarande av Playwright vid varje browserjobb.

## Iterationsdisciplin

- Håll PR:n som draft medan implementation, visuell justering eller diagnostik pågår.
- Pusha en sammanhängande kandidat efter riktad lokal kontroll, inte varje experiment.
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
