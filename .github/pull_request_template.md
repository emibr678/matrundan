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

## Lovable och visuell/UX-granskning

Alla ändringar som påverkar renderat GUI ska minst genomföra nivå 1 enligt
`docs/visual-review.md`. Interaktionsändringar använder minst nivå 2 och större
huvudflöden nivå 3. Temporära screenshots är förstahandsval under iteration;
workflowen **Visual review artifacts** är opt-in för färdigare kandidater.

### Renderad review

- Reviewnivå: `1` / `2` / `3` / inte relevant
- [ ] Berörd GUI-state har renderats och granskats.
- [ ] 360 px har granskats när GUI påverkas.
- [ ] Desktop har granskats när layout/hierarki påverkas där.
- [ ] Interaktionsflödet har klickats igenom när nivå 2 eller 3 används.
- [ ] Persona-/perspektivreview har genomförts när nivå 3 används.
- [ ] Skapa visuella granskningsbilder
- [ ] Renderad review är inte relevant, med motivering nedan.

Granskade routes/states:
Viewportar:
Screenshots: temporära / GitHub-artifact / inga
Konkreta visuella/UX-fynd och korrigeringar:
Persona-resultat vid nivå 3:
Ej visuellt verifierat:
Motivering om inte relevant:

### Lovable-användning

- [ ] Användaren bad uttryckligen om Lovable-konsultation och den genomfördes i
      Plan mode.
- [ ] Användaren bad uttryckligen om Lovable-implementation och den genomfördes
      på PR-branchen.
- [ ] Lovable kunde inte användas; begränsningen är dokumenterad.
- [ ] Lovable var inte relevant.

### Previewgrind för nivå 3 / större visuella ändringar

- [ ] Full previewgrind krävs.
- [ ] Exakt PR-branch och aktuell head-SHA är dokumenterade.
- [ ] Samma PR-branch är vald i Lovable.
- [ ] Lovable-synken är verifierad mot aktuell PR-head.
- [ ] En aktuell previewlänk har lämnats till användaren i chatten.
- [ ] Demo/exempelgrupp och live-läge är jämförda när relevant.
- [ ] Användaren har granskat previewn och uttryckligen godkänt merge.
- [ ] Full previewgrind är inte relevant, med motivering nedan.

PR-branch:
PR-head:
Vald Lovable-branch:
Verifierad Lovable-commit:
Previewlänk:
Preview lämnad i chatten:
Användarens gransknings-/mergebesked:
Motivering om full previewgrind inte är relevant:

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
- [ ] Visuell smoke check när GUI har ändrats
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
- Reviewnivå och granskade states:
- Screenshots/artifact:
- UX-/persona-resultat:
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
