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
- Version/changelog: uppdaterad / **Version: inte relevant**

Motivering eller särskild risk:

### Renderad UX och Lovable

- Reviewnivå: `1` / `2` / `3` / inte relevant
- Granskade routes/states:
- Viewportar:
- Konkreta UX-/persona-fynd och korrigeringar:
- Screenshots/artifact: temporära / GitHub-artifact / inga
- Lovable-konsultation/implementation: genomförd / inte begärd / blockerad
- Full previewgrind: krävs / inte relevant

Om full previewgrind krävs:

- PR-branch + head-SHA:
- Verifierad Lovable-branch/synk:
- Previewlänk:
- Demo/exempel/live jämförda:
- Användarens preview-/mergebesked:

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
- Lovable-synk/preview: klart / inte relevant / återstår
- Databasdriftsättning: klart / inte relevant / återstår
- Publicering: klart / inte relevant / återstår

PR:n hålls draft medan implementation, diagnostik eller större visuell iteration
pågår. Merge, databasdriftsättning och publicering kräver de separata
godkännanden som beskrivs i `docs/development-workflow.md`.
