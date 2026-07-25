# Matrundan

Matrundan är en privat webbapp för vänner och familj som vill hålla ordning
på ställen de vill prova, välja nästa stopp tillsammans, registrera besök och
spara gruppens egna betyg.

Fokus är gänget och det ni provar tillsammans – ingen offentlig
restaurangdatabas, ingen social feed, inga rekommendationer utifrån.

## Huvudflöde

1. **Utforska eller lägg till** ett matställe – manuellt eller via platssökning.
2. **Välj nästa stopp** manuellt eller genom att slumpa.
3. **Registrera ett besök** med datum, tillfälle och deltagare.
4. **Betygsätt** helheten och, om ni vill, smak, prisvärdhet och service.

## Funktioner

- Tre huvudvyer: Hem, Matställen och Gruppen.
- Sökning, filtrering och topplista i matställeslistan.
- Registrering av besök med valfria detaljbetyg och kommentarer.
- Personliga och delade favoriter, samt status per matställe
  (”Nytt för mig”, ”Nytt för gruppen”, ”Alla har provat”).
- Klickbara medlemsprofiler med besök, favoriter och smakprofil.
- Navigerbart aktivitetsflöde med djuplänkar till besök, matställen och
  medlemmar.
- Google Maps som enda externa länk för vägbeskrivning.
- ”Om Matrundan” med aktuell version och versionshistorik.

## Status – v0.7.0

Med Paket 3B kan samma besök finnas i flera grupper utan att data
dupliceras, och delade besök har tydlig integritetskontroll. Paket 1–3A
(inbjudningar, roller, profiler) ligger kvar oförändrat.

### Två lägen sida vid sida

- **Demo-läge (standard när man är utloggad):** all data ligger i webbläsarens
  `localStorage` med svensk demodata. Ingen inloggning behövs. En explicit
  sandlådevariant nås via `?demo=1` i URL:en.
- **Live-läge (när man är inloggad):** både läsning och skrivning går mot
  Supabase enligt RLS. Har man inga grupper visas onboardingen.

### Vad som fungerar i live-läget

- Google-inloggning via Lovable Cloud.
- Skapa och administrera grupper, bjuda in via engångstoken, byta roll,
  ta bort medlemmar, överföra ägarskap, lämna grupp, redigera profil.
- Lägga till matställen, registrera besök med deltagare + omdöme atomärt,
  favoritmarkera, sätta/byta/rensa gruppens nästa stopp.
- **Kanonisk datamodell:** ett matställe (`places`) och ett besök (`visits`)
  existerar bara en gång; varje grupp kopplas via `group_places` respektive
  `visit_group_links`. Recensionens synlighet per grupp styrs av
  `review_group_visibility`.
- **Dela besök till en annan grupp** där du är medlem och deltog – matstället
  kopplas in i målgruppen om det saknas, betygen från medlemmar som finns i
  målgruppen blir synliga, och personer utanför räknas anonymt som +N.
  Ta bort ett delat besök från en grupp utan att röra originalet.
- **Egen kommentarssynlighet** per grupp: betyget syns alltid, kommentaren
  kan du dölja i valfri grupp.
- **Gruppinställning:** räkna delade besök i progression (av/på).
- **Säker läsmodell:** all känslig läsning går via `get_group_app_state`
  (SECURITY DEFINER); kopplingstabellernas rader är inte direkt läsbara från
  klienten, och `source_group_id` lämnar aldrig servern.

### Vad som inte är med ännu

Geoapify/OSM-platssökning (providern är fortfarande demo-only) och
gamification/nivåer/badges. Se [CHANGELOG.md](./CHANGELOG.md) och
"Om Matrundan" i appen för fullständig versionshistorik.


## Teknik

- [TanStack Start](https://tanstack.com/start) v1 (React 19 + Vite 7)
- TypeScript, Tailwind CSS v4, shadcn/ui
- Bun som pakethanterare och runtime
- Lovable Cloud (Supabase) för auth och datalager

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
  routes/                     Filbaserade rutter (TanStack Router)
    __root.tsx                App-shell och global head
    index.tsx                 Hem
    matstallen.tsx            Lista, sök och filter
    matstallen.$placeId.tsx   Matställets detaljvy
    gruppen.tsx               Gänget, aktivitet, inställningar
  components/matrundan/       Feature-komponenter (dialogs, sheets, kort)
    AuthMenu.tsx              Google-inloggning och gruppväxlare
    OnboardingScreen.tsx      Skapa första gruppen i live-läge
    AppShell.tsx              Navigation + val mellan demo/live/onboarding
  lib/matrundan/
    types.ts                  Domänmodell
    store.tsx                 Vy-tillstånd, väljer demo- eller live-källa
    session.tsx               Auth-, mode- och gruppvalskontext
    live-repository.ts        Läser gruppens data från Supabase → AppState
    demo-data.ts              Svensk demodata för preview
    places-provider.ts        Provider-gränssnitt för platssökning
    location.ts               Enkel plats-tolkning för utforskning
    version.ts                Version och strukturerad changelog
  integrations/supabase/      Auto-genererad Supabase-klient och typer
    (ej att redigera manuellt)
```

Domänmodell, datalager och vyer hålls separerade så att Paket 2 kan lägga
till skrivflöden i `live-repository.ts` utan att röra vykomponenterna.

## Konfiguration

I Paket 1 behöver du **inte** göra något manuellt för att Google-login ska
fungera: den använder Lovable Clouds hanterade OAuth-broker och de
publicerbara Supabase-nycklarna som redan finns i `.env` (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`). Ingen egen
Google Cloud-klient behövs.

Ingen service-role-nyckel finns i klientkoden eller i några `VITE_`-variabler.
Klienten använder enbart publishable key + användarens JWT; all känslig
åtkomst ligger bakom RLS.

Geoapify konfigureras **inte** i Paket 1 – lägg inga API-nycklar i miljön
ännu.

## Lovable

Projektet skapas och underhålls via [Lovable](https://lovable.dev). Prompta i
Lovable-editorn för att göra förändringar; ändringar synkas mot GitHub-repot
när det är kopplat.
