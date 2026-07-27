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

## Kanoniska kommandon

Kontrollera miljön:

```bash
bun run doctor
```

Formatera endast ändrade filer:

```bash
bun run format:changed
```

Verifiera ändrade filer, enhetstester, TypeScript och produktionsbygge:

```bash
bun run verify:changed
```

Kör den relevanta agentverifieringen, inklusive mobil Chromium när UI har ändrats:

```bash
bun run verify:agent
```

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

## Hur ändrade filer bestäms

`scripts/repo-tools.mjs` använder i denna ordning:

1. `MATRUNDAN_BASE_SHA` när det är satt;
2. merge-base mot `origin/main`;
3. föregående commit som reserv.

Dessutom inkluderas staged, unstaged och otrackade filer. Samma klassificering används av lokala kommandon och CI för formattering, lint och val av browsertester.

## CI

Draft-PR kör:

- miljökontroll;
- lockfils- och verktygsskydd;
- Prettier och ESLint på ändrade filer;
- alla enhetstester under `src`;
- TypeScript;
- produktionsbygge.

När PR:n markeras redo körs dessutom mobil Chromium för UI-ändringar samt WebKit och desktop Chromium för kartrelaterade ändringar.

Vid formatteringsfel skapar CI en `prettier-patch`-artefakt med den exakta formatteringsdiffen. Det gör felet reproducerbart utan tillfälliga workflows eller commits som endast triggar CI.

## Skyddsräcken

- `bun.lock` får inte ändras utan `package.json`.
- Ändrade beroenden i `package.json` kräver motsvarande `bun.lock`.
- Alternativa lockfiler är fel.
- Workflowändringar ska granskas uttryckligen.
- CI får inte patcha, committa eller pusha produktkod.
- Skapa inte commits endast för att trigga CI.
- Använd en branch och en draft-PR per godkänt sammanhängande paket.
