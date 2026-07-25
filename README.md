# Matrundan

Matrundan är en privat webbapp för vänner och familj som vill hålla ordning
på ställen de vill prova, välja nästa stopp tillsammans, registrera besök och
spara gruppens egna betyg. Den ersätter tråden i chatten där restaurangtips
försvinner och alla glömmer vem som tyckte vad.

Just nu är appen tänkt för en enskild privat grupp. Ingen offentlig
restaurangdatabas, ingen social feed och inga rekommendationer från externa
tjänster. Fokus är på gänget och det ni provar tillsammans.

## Huvudflöde

1. **Utforska eller lägg till** ett matställe – via platssökning eller manuellt.
2. **Välj nästa stopp** manuellt eller genom att slumpa.
3. **Registrera ett besök** med datum, tillfälle och deltagare.
4. **Betygsätt** helheten och, om ni vill, smak, prisvärdhet och service.

## Funktioner

- Tre huvudvyer: Hem, Matställen och Gruppen.
- Sökning och filtrering av matställeslistan med tydlig topplista baserad på
  gruppens medelbetyg.
- Registrering av besök med valfria detaljbetyg och kommentarer.
- Personliga favoriter, delade favoriter i gänget och status per matställe
  (”Nytt för mig”, ”Nytt för gruppen”, ”Alla har provat”).
- Klickbara medlemsprofiler med besök, favoriter och smakprofil.
- Navigerbart aktivitetsflöde med djuplänkar till besök, matställen och
  medlemmar.
- Google Maps som enda externa länk för vägbeskrivning.
- ”Om Matrundan” med aktuell version och versionshistorik.

## Status

Appen är i tidig produktfas och drivs helt lokalt i webbläsaren.

- All data sparas i `localStorage`. Ingen backend, ingen inloggning och inga
  externa restaurang-, karta-, bild- eller betygstjänster är anslutna.
- Platssökningen använder en lokal demo-provider bakom ett provider-
  gränssnitt som är förberett för framtida integrationer (t.ex. Geoapify).
- En framtida version är tänkt att kopplas till Lovable Cloud för
  autentisering, gruppdata och roller.

Se [CHANGELOG.md](./CHANGELOG.md) för versionshistorik.

## Teknik

- [TanStack Start](https://tanstack.com/start) v1 (React 19 + Vite 7)
- TypeScript
- Tailwind CSS v4 + shadcn/ui
- Bun som pakethanterare och runtime

### Kom igång

```sh
bun install
bun run dev
```

Andra användbara kommandon:

```sh
bun run build        # produktionsbygge
bun run lint         # ESLint
bunx tsgo --noEmit   # typkontroll
```

## Arkitektur

```
src/
  routes/                  Filbaserade rutter (TanStack Router)
    __root.tsx             App-shell och global head
    index.tsx              Hem
    matstallen.tsx         Lista, sök och filter
    matstallen.$placeId.tsx  Matställets detaljvy
    gruppen.tsx            Gänget, aktivitet, inställningar
  components/matrundan/    Feature-komponenter (dialogs, sheets, kort)
  lib/matrundan/
    types.ts               Domänmodell
    store.tsx              Lokalt tillståndslager (localStorage)
    demo-data.ts           Svensk demodata för preview
    places-provider.ts     Provider-gränssnitt för platssökning
    location.ts            Enkel plats-tolkning för utforskning
    version.ts             Version och strukturerad changelog
```

Domänmodell, datalager och vyer är avsiktligt separerade så att en framtida
Supabase-integration kan byta ut store och places-provider utan att röra
komponenterna.

## Lovable

Projektet skapas och underhålls via [Lovable](https://lovable.dev). Prompta i
Lovable-editorn för att göra förändringar; ändringar synkas mot repot när det
är kopplat till GitHub.
