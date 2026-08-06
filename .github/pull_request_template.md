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

## Visuell granskning

Markera när ändringen påverkar layout, hierarki, responsivitet eller ett
huvudflöde. Workflowen **Visual review artifacts** körs när den särskilda rutan
nedan är markerad i PR-beskrivningen.

- [ ] Visuell granskning krävs.
- [ ] Lovable-variant eller featurebranch är verifierad mot rätt commit.
- [ ] Skapa visuella granskningsbilder
- [ ] 360 px mobil är manuellt granskad.
- [ ] Desktop är manuellt granskad.
- [ ] Demo/exempelgrupp och live-läge är jämförda när relevant.
- [ ] Visuell granskning är inte relevant, med motivering nedan.

Granskad preview, artifact och vyer:

Ej visuellt verifierat:

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

Motivering om version inte är relevant (endast dokumentation, tester eller verktyg utan användarsynlig ändring):

## Databas

- Databasändring: ja/nej
- Migration:
- Bakåtkompatibel med nuvarande liveapp: ja/nej/inte relevant
- Applicerad i produktion: ja/nej/inte relevant
- `supabase/production-preflight.sql`: godkänd/inte körd/inte relevant
- PostgREST schema-cache omladdad: ja/nej/inte relevant
- Autentiserad RPC-smoke mot verklig grupp: godkänd/inte körd/inte relevant

## Verifiering

- [ ] `bun run check:release`
- [ ] `bun run check:database`
- [ ] Prettier på ändrade filer
- [ ] ESLint på ändrade kodfiler
- [ ] `bun run typecheck`
- [ ] `bun run build`
- [ ] Fokuserade tester
- [ ] Mobil Chromium när UI har ändrats
- [ ] WebKit/iPhone och desktop Chromium när kartan har ändrats

Utförda kommandon och resultat:

```text

```

## Leverans

- Branch:
- Commit:
- CI:
- Lovable-synk: inte verifierad
- Preview och verifierad commit:
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
