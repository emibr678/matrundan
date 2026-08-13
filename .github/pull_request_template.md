## Relaterat issue

- Closes #
- Backlogstatus före implementation: `status:ready` / inte relevant

## Fas

- [ ] Godkänd implementation
- [ ] Verifiering
- [ ] Redo för merge
- [ ] Databasdriftsättning ingår uttryckligen
- [ ] Publicering ingår uttryckligen

## Scope

Beskriv den godkända, avgränsade ändringen och eventuella uttryckliga icke-mål.

## Grundorsak eller motivering

Beskriv observerade data, diagnostik och varför ändringen behövs. För en ny
funktion: sammanfatta användarbehovet och hänvisa till besluten i relaterat
issue.

## Ändringar

-

## Backlog och roadmap

- [ ] PR:n använder `Closes #...` för det issue som slutförs.
- [ ] Issuens scope och öppna beslut speglar den slutliga implementationen.
- [ ] `docs/product-roadmap.md` är uppdaterad om funktionen färdigställs,
      paketstatus ändras eller nästa prioritet påverkas.
- [ ] Om detta är paketets sista issue har nästa paket och dess prioritet
      bedömts.
- [ ] Inte relevant, med motivering nedan.

Motivering:

## Exempelgruppen

Välj ett alternativ och motivera vid behov:

- [ ] Exempelgruppen eller scenariokontraktet har uppdaterats.
- [ ] Befintliga exempeldata täcker ändringen; inget nytt scenario behövs.
- [ ] Inte relevant eftersom ändringen inte påverkar ett produktflöde.

Motivering eller berört scenario:

## Lovable och visuell granskning

Markera när ändringen påverkar layout, hierarki, responsivitet eller ett
huvudflöde. Workflowen **Visual review artifacts** körs när den särskilda rutan
nedan är markerad på en icke-draft PR. Under draft används lokal
`bun run test:visual-review` vid behov.

### Lovable-användning

- [ ] Användaren bad uttryckligen om Lovable-konsultation och den genomfördes i
      Plan mode.
- [ ] Användaren bad uttryckligen om Lovable-implementation och den genomfördes
      på PR-branchen.
- [ ] Lovable kunde inte användas; begränsningen är dokumenterad.
- [ ] Lovable var inte relevant.

### Previewgrind för större visuella ändringar

- [ ] Visuell granskning krävs.
- [ ] Exakt PR-branch och aktuell head-SHA är dokumenterade.
- [ ] Samma PR-branch är vald i Lovable.
- [ ] Lovable-synken är verifierad mot aktuell PR-head.
- [ ] En aktuell previewlänk har lämnats till användaren i chatten.
- [ ] 360 px mobil är manuellt granskad.
- [ ] Desktop är manuellt granskad.
- [ ] Demo/exempelgrupp och live-läge är jämförda när relevant.
- [ ] Användaren har granskat previewn och uttryckligen godkänt merge.
- [ ] Skapa visuella granskningsbilder
- [ ] Visuell granskning är inte relevant, med motivering nedan.

PR-branch:
PR-head:
Vald Lovable-branch:
Verifierad Lovable-commit:
Previewlänk:
Preview lämnad i chatten:
Användarens gransknings-/mergebesked:
Granskade vyer:
Ej visuellt verifierat:
Motivering om inte relevant:

## Produkt- och arkitekturdokumentation

- [ ] Relaterat issue innehåller aktuellt scope, icke-mål och öppna beslut.
- [ ] `docs/product-roadmap.md` är uppdaterad om paket, prioritet eller varaktigt
      produktbeslut har ändrats.
- [ ] `docs/architecture.md` är uppdaterad om ett varaktigt arkitektur- eller
      säkerhetsbeslut har ändrats.
- [ ] Dokumentation: inte relevant, med motivering nedan.

Motivering:

## Changelog och version

Dokumentations-, test- eller verktygsändringar utan versionshöjning måste
markera **Version: inte relevant** för att klara releasekontrollen.

- [ ] `CHANGELOG.md` har en daterad release som matchar apphistoriken
- [ ] Patch
- [ ] Minor
- [ ] Major
- [ ] Version: inte relevant

Motivering om version inte är relevant:

## Databas

- Databasändring: ja/nej
- Migration:
- Bakåtkompatibel med nuvarande liveapp: ja/nej/inte relevant
- Applicerad i produktion: ja/nej/inte relevant
- `supabase/production-preflight.sql`: godkänd/inte körd/inte relevant
- PostgREST schema-cache omladdad: ja/nej/inte relevant
- Autentiserad RPC-smoke mot verklig grupp: godkänd/inte körd/inte relevant

## Verifiering

Draft-iteration ska verifieras lokalt/Codex. GitHub CI förväntas först på en
redo-kandidat och kan köras på hosted eller self-hosted runner.

- [ ] `bun run check:release`
- [ ] `bun run check:database`
- [ ] Prettier på ändrade filer
- [ ] ESLint på ändrade kodfiler
- [ ] `bun run typecheck`
- [ ] `bun run build`
- [ ] Fokuserade tester
- [ ] Mobil Chromium när UI har ändrats
- [ ] WebKit/iPhone och desktop Chromium när kartan har ändrats
- [ ] **Roadmapgrind:** bedöm om merge färdigställer en roadmapfunktion, ändrar
      paketstatus eller påverkar nästa prioritet. Uppdatera i så fall
      `docs/product-roadmap.md`; annars dokumentera uttryckligen att roadmapen
      inte påverkas.

Roadmapbedömning: uppdaterad / inte relevant

Motivering:

Utförda kommandon och resultat:

```text

```

## Leverans

- Branch:
- Commit:
- PR:
- CI:
- CI-runner: `ubuntu-24.04` / `self-hosted` / ej körd
- Lovable-konsultation:
- Vald Lovable-branch:
- Lovable-synk:
- Previewlänk:
- Preview granskad av användaren:
- Manuella teststeg:
- Ej verifierat:
- Databas:
- Publicering: ingår inte om inget annat uttryckligen godkänts

## Efter merge

- [ ] Bekräfta att rätt issue stängdes av `Closes #...`.
- [ ] Ta bort `status:ready` om etiketten ligger kvar på ett stängt issue.
- [ ] Kontrollera att roadmapen fortfarande visar aktivt och kommande arbete
      korrekt.
- [ ] Om paketets sista issue stängdes: flytta paketet till genomfört och bedöm
      nästa `priority:now`.
