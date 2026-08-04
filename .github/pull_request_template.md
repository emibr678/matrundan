## Relaterat issue

- Closes #
- Backlogstatus före implementation: `status:ready` / inte relevant

## Fas

- [ ] Godkänd implementation
- [ ] Verifiering
- [ ] Redo för merge
- [ ] Publicering ingår uttryckligen

## Scope

Beskriv den godkända, avgränsade ändringen och eventuella uttryckliga icke-mål.

## Grundorsak eller motivering

Beskriv observerade data, diagnostik och varför ändringen behövs. För en ny
funktion: sammanfatta användarbehovet och hänvisa till besluten i relaterat
issue.

## Ändringar

- 

## Exempelgruppen

Välj ett alternativ och motivera vid behov:

- [ ] Exempelgruppen eller scenariokontraktet har uppdaterats.
- [ ] Befintliga exempeldata täcker ändringen; inget nytt scenario behövs.
- [ ] Inte relevant eftersom ändringen inte påverkar ett produktflöde.

Motivering eller berört scenario:

## Produkt- och arkitekturdokumentation

- [ ] Relaterat issue innehåller aktuellt scope, icke-mål och öppna beslut.
- [ ] `docs/product-roadmap.md` är uppdaterad om paket, prioritet eller varaktigt
      produktbeslut har ändrats.
- [ ] `docs/architecture.md` är uppdaterad om ett varaktigt arkitektur- eller
      säkerhetsbeslut har ändrats.
- [ ] Dokumentation: inte relevant, med motivering nedan.

Motivering:

## Changelog och version

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
- Preview: https://id-preview--d389634e-227c-4689-85ed-8714fdc602f7.lovable.app
- Manuella teststeg:
- Ej verifierat:
- Databas:
- Publicering: ingår inte om inget annat uttryckligen godkänts
