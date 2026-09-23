# Matrundan

Matrundan är en privat, gruppcentrerad webbapp för vänner och familjer som vill
upptäcka, välja, besöka och minnas matställen tillsammans.

Kärnflödet är enkelt:

1. samla ställen gruppen är nyfiken på;
2. bestäm nästa gemensamma stopp;
3. registrera verkliga besök och faktiska deltagare;
4. bygg en privat gemensam historik;
5. använd historiken som inspiration till nästa upplevelse.

Matrundan är inte en offentlig restaurangkatalog, publik recensionsplattform,
individuell matdagbok, social feed eller global ranking.

## Vad appen stödjer

På hög nivå finns i dag bland annat:

- privata grupper, roller och inbjudningar;
- gruppens egna matställen med sökning, karta och verifierade sökområden;
- kanoniska matställen med separerade externa källor och gruppspecifika uppgifter;
- privat platsunderhåll och datakvalitetsflöden utan automatisk OSM-publicering;
- planering av nästa stopp;
- kanoniska besök med faktiska deltagare, omdömen, historik och privat foto;
- kontrollerad delning av platser och besök mellan användarens grupper;
- privata favoriter, topplistor och diskret progression som bygger på verkligt
  deltagande och återbesök;
- push/PWA-stöd, integritetssida och självbetjänad kontoradering.

Detaljerad aktuell releasehistorik finns i [CHANGELOG.md](./CHANGELOG.md).
Strategisk produktriktning och backlogmodell finns i
[docs/product-roadmap.md](./docs/product-roadmap.md); nästa konkreta arbete och
dess ordning finns i GitHub Issues och labels.

## Körlägen

Matrundan har flera avsiktligt parallella lägen:

- **Publik landning** för utloggade användare.
- **Exempelgrupp (`/exempel`)** med helt fiktiv data och utan produktionsskrivningar.
- **Intern demo (`?demo=1`)** för deterministiska utvecklings- och regressionstester.
- **Live-läge** efter autentisering, med gruppscopade läsningar och validerade
  server-/RPC-skrivningar mot Supabase.

Exempel och demo ska efterlikna produktflöden utan att bli en separat produktmodell.

## Teknik

- TanStack Start, React 19 och TypeScript
- Vite och Tailwind CSS v4
- shadcn/ui och Radix UI
- Bun som låst pakethanterare/runtime
- Supabase för auth, Postgres och privat lagring
- Cloudflare Workers för staging och produktion
- Lovable som valfritt UX-/editor- och previewverktyg, inte som runtimekrav
- Geoapify, OpenStreetMap och MapLibre för plats- och kartfunktioner
- Playwright för browser- och mobilregressioner

Plattformens aktuella driftmodell och varaktiga portabilitetskontrakt finns i
[docs/platform-migration-plan.md](./docs/platform-migration-plan.md). Kärnan i
plattformsmigrationen är genomförd; **Issue #207 — Frikoppla drift från Lovable
Cloud och etablera portabel plattform** hålls öppen för den sista verifierade
avvecklingen av den tidigare Lovable-runtimeytan.

## Kom igång

Projektet använder Bun enligt versionen i `package.json`.

```bash
bash scripts/bootstrap-agent.sh
bun run dev
```

För full miljösetup, Codex Cloud, Playwright, verifieringskommandon och runnerdetaljer:
se [DEVELOPMENT.md](./DEVELOPMENT.md).

Några vanliga kontroller är:

```bash
bun run doctor
bun run verify:changed
bun run verify:agent
bun run verify:full
```

Välj den smalaste relevanta kontrollen först. Det kanoniska leveransflödet finns
i [docs/development-workflow.md](./docs/development-workflow.md).

## Repoöversikt

```text
src/routes/                    Filbaserade vyer
src/components/matrundan/      Produktkomponenter och dialoger
src/components/ui/             Delade shadcn/Radix-primitiver
src/lib/matrundan/             Domänlogik, read-models och integrationer
supabase/migrations/           Schema, RPC, RLS och Storage
scripts/                       Setup och verifieringsverktyg
tests/                         Enhets-, kontrakts- och browsertester
docs/                          Produkt-, arkitektur- och processdokumentation
```

## Källor till sanningen

Olika dokument har olika ansvar:

| Källa | Ansvar |
| --- | --- |
| [AGENTS.md](./AGENTS.md) | Kort bindande agentkonstitution och dokumentrouter |
| [docs/product-roadmap.md](./docs/product-roadmap.md) | Strategisk produktinriktning, teman och backlogmodell |
| GitHub Issues + labels | Detaljerat scope, status, prioritet och operativ arbetsordning |
| [docs/architecture.md](./docs/architecture.md) | Varaktiga arkitektur-, integritets- och säkerhetsbeslut |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Miljösetup och kanoniska kommandon |
| [docs/development-workflow.md](./docs/development-workflow.md) | Planering, implementation, verifiering och leverans |
| [docs/visual-review.md](./docs/visual-review.md) | Renderad UX-granskning, Lovable och preview |
| [CHANGELOG.md](./CHANGELOG.md) | Släppt och ännu inte publicerad användarhistorik |

Fokuserade arkitekturdokument under `docs/` kompletterar huvudarkitekturen när ett
område kräver mer detalj. Historiskt material som faktiskt behöver bevaras ligger
under `docs/archive/`; tillfällig leveransstatus hör normalt i Issue/PR i stället
för på `main`.

## Integritet och konfiguration

Gruppen är den primära produkt- och integritetsgränsen. Kanoniska platser och
besök får återanvändas utan att ursprungsgrupp, privata kommentarer, medlemskap
eller interna identifierare exponeras.

Den versionshanterade `.env.example` dokumenterar endast public-safe
browser-/runtimekonfiguration och kan användas som referens för lokala och
valfria Lovable-previewflöden. Privilegierade nycklar, service-role,
databaslösenord och andra serverhemligheter får aldrig committas eller exponeras
via `VITE_*`. Den fulla public-readiness-grinden finns i
[docs/public-repository-readiness.md](./docs/public-repository-readiness.md).

## Rättigheter och säkerhetsrapportering

Matrundan är proprietär programvara och repositoryt har medvetet **ingen
open-source-licens**. Ett framtida byte till publik repository-visibility innebär
inte i sig rätt att kopiera, distribuera, driftsätta eller kommersialisera
projektets källkod. Se [COPYRIGHT.md](./COPYRIGHT.md) för rättighetsinformationen;
tredjepartsberoenden behåller sina egna licenser.

Säkerhetsproblem ska rapporteras privat enligt [SECURITY.md](./SECURITY.md), inte
med känsliga detaljer i en vanlig publik Issue.

## Leverans

Merge, Lovable-synk/preview, databasdriftsättning och publicering är separata
statusar. En mergad PR betyder därför inte automatiskt att migrationer är körda
eller att den publika appen har publicerats.
