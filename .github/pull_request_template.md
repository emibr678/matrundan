## Relaterat arbete

- Issue: `Closes #...` / `Refs #...`
- Godkänt scope/status:

## Scope och motivering

Vad ändras, varför behövs det och vilka uttryckliga icke-mål gäller?

## Ändringar

-

## Risk och villkorade grindar

Fyll bara i det som faktiskt är relevant.

- Produkt-/roadmappåverkan: uppdaterad / inte relevant
- Exempelgrupp/demo: uppdaterad / befintligt scenario räcker / inte relevant
- Arkitektur/integritet: uppdaterad / inte relevant
- Databas/migration: nej / ja, beskriv nedan
- Releaseunderlag/version: releaseunderlag nedan / releasekandidat / inte relevant

### Releaseunderlag

För användarsynlig kod eller migration: skriv 1–3 korta svenska releasepunkter
mellan markörerna. En normal feature-PR ska inte höja appversionen eller
materialisera en daterad release; releaseunderlaget samlas i stället upp av en
separat releasekandidat.

<!-- MATRUNDAN_RELEASE_NOTE_BEGIN -->
<!-- Skriv 1–3 korta punkter här. -->
<!-- MATRUNDAN_RELEASE_NOTE_END -->

För dokumentations-, test- eller verktygsändringar utan användarsynlig kod eller
migration:

- [ ] Version: inte relevant

CI läser releaseunderlagsmarkörerna för feature-PR:er och den exakta
`Version: inte relevant`-markeringen för maintenance-PR:er. Redan pågående
versionerade feature-PR:er kan under övergången fortsatt följa det äldre
kontraktet, men nya features ska normalt använda releaseunderlag ovan.

Motivering eller särskild risk:

### Renderad UX och Lovable

- Reviewnivå: `1` / `2` / `3` / inte relevant
- Granskade routes/states:
- Viewportar:
- Konkreta UX-/persona-fynd och korrigeringar:
- Screenshots/artifact: temporära / GitHub-artifact / inga
- Full nivå 3-grind: krävs / inte relevant
- Lovable uttryckligen begärt: ja / nej
- Lovable-konsultation/implementation: genomförd / inte begärd / blockerad

Om nivå 3-grind krävs:

- PR-branch + head-SHA:
- Demo/exempel/live jämförda:
- Användarens gransknings-/mergebesked:

Om Lovable uttryckligen har begärts:

- Verifierad Lovable-branch/synk:
- Previewlänk:

Se `docs/visual-review.md` för nivåer och exakta krav. Beskriv inte hela processen
på nytt här.

### Databas

Om databasen påverkas:

- Migration/objekt:
- Bakåtkompatibilitet och databevarande:
- Preflight/kontraktskontroll:
- Applicerad i produktion: ja / nej
- Autentiserad smoke/schema-cache när relevant:

Merge är inte databasdriftsättning.

## Verifiering

Lista endast kontroller som faktiskt har körts och deras resultat.

```text

```

- CI: grön / röd / väntar / ej körd
- CI-runner: hosted / self-hosted / ej relevant
- Ej verifierat eller kvarvarande begränsning:

## Leveransstatus

- Branch:
- Commit/head:
- PR:
- Issue:
- Mergegodkännande: ja / nej
- Lovable-synk/preview: klart / inte begärt / återstår
- Databasdriftsättning: klart / inte relevant / återstår
- Publicering: klart / inte relevant / återstår

PR:n hålls draft medan implementation, diagnostik eller större visuell iteration
pågår. Merge, databasdriftsättning och publicering kräver de separata
godkännanden som beskrivs i `docs/development-workflow.md`.
