## Fas

- [ ] Godkänd implementation
- [ ] Verifiering
- [ ] Redo för merge
- [ ] Publicering ingår uttryckligen

## Scope

Beskriv den godkända, avgränsade ändringen.

## Grundorsak eller motivering

Beskriv observerade data, diagnostik och varför ändringen behövs.

## Ändringar

- 

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
- Publicering: ingår inte om inget annat uttryckligen godkänts
