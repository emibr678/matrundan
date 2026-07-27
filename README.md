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
- Sökning, filtrering, karta och topplista i matställeslistan.
- Registrering av besök med valfria detaljbetyg och kommentarer.
- Personliga och delade favoriter, samt status per matställe
  (”Nytt för mig”, ”Nytt för gruppen”, ”Alla har provat”).
- Klickbara medlemsprofiler med besök, favoriter och smakprofil.
- Navigerbart aktivitetsflöde med djuplänkar till besök, matställen och
  medlemmar.
- Google Maps som extern länk för vägbeskrivning.
- ”Om Matrundan” med aktuell version och versionshistorik.

## Status – v0.11.0

Paket 4C gör platsadministrationen naturligare för gruppen. Ägare och admin
kan ta bort ett matställe från gruppens aktiva lista utan att tidigare besök,
omdömen eller gruppens egna platsuppgifter försvinner. Stället kan senare läggas
till igen genom det vanliga Lägg till-flödet; den befintliga gruppkopplingen
återaktiveras i stället för att en dubblett skapas.

Kök och inriktning väljs från en gemensam sökbar lista som normaliserar
Geoapify-data och gruppens egna val. På mobil öppnas väljaren som en drawer som
anpassar sig till den synliga skärmhöjden när tangentbordet visas.

Grupparkivering och redigering av egna omdömen från Paket 4B är kvar. Paket
3D:s privata nivåer, badges, topplistor och milstolpar räknas fortsatt
deterministiskt från faktiska deltagna besök.

### Två lägen sida vid sida

- **Demo-läge (standard när man är utloggad):** all data ligger i webbläsarens
  `localStorage` med svensk demodata. Ingen inloggning behövs. En explicit
  sandlådevariant nås via `?demo=1` i URL:en.
- **Live-läge (när man är inloggad):** både läsning och skrivning går mot
  Supabase enligt RLS. Har man inga grupper visas onboardingen.

### Vad som fungerar i live-läget

- Google-inloggning via Lovable Cloud.
- Skapa och administrera grupper, bjuda in via engångstoken, byta roll,
  ta bort medlemmar, överföra ägarskap, lämna grupp och redigera profil.
- Lägga till matställen, ta bort dem från gruppens aktiva lista och lägga
  tillbaka dem utan att förlora historik eller gruppspecifik metadata.
- Korrigera gruppens kategori, kök och inriktning, Passar för och anteckning.
- Registrera besök med deltagare + omdöme atomärt, redigera eget omdöme,
  favoritmarkera och sätta/byta/rensa gruppens nästa stopp.
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
- **Gruppinställning:** räkna delade besök i progression (av/på) – påverkar
  både nivåer, badges och topplistor.
- **Privat gamification:** nivåer, fem badges, tre topplistor och gemensamma
  milstolpar per grupp. Ingen offentlig ranking eller profil.
- **Geoapify-platssökning:** autocomplete för ort/område, matställessökning
  med radier 1/3/5/10/25/50 km, list- och kartresultat, tydlig attribution
  och server-skyddad API-nyckel.
- **Säker läsmodell:** all känslig läsning går via `get_group_app_state`
  (SECURITY DEFINER); kopplingstabellernas rader är inte direkt läsbara från
  klienten, och `source_group_id` lämnar aldrig servern.

Se [CHANGELOG.md](./CHANGELOG.md) och ”Om Matrundan” i appen för fullständig
versionshistorik.

## Teknik

- [TanStack Start](https://tanstack.com/start) v1 (React 19 + Vite 8)
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
bun run typecheck    # typkontroll
bun run verify:full  # format, lint, typkontroll och bygge
```

## Arkitektur

```
src/
  routes/                     Filbaserade rutter (TanStack Router)
    __root.tsx                App-shell och global head
    index.tsx                 Hem
    matstallen.tsx            Lista, karta, sök och filter
    matstallen.$placeId.tsx   Matställets detaljvy
    gruppen.tsx               Gänget, aktivitet, inställningar
  components/matrundan/       Feature-komponenter (dialogs, sheets, kort)
    AuthMenu.tsx              Google-inloggning och gruppväxlare
    OnboardingScreen.tsx      Skapa första gruppen i live-läge
    GeoapifyLocationInput.tsx Återanvändbart Plats-fält med verifierat val
    FoodTagMultiSelect.tsx    Sökbar väljare för kök och inriktning
    PlaceMap.tsx              Gruppens aktiva matställen på karta
    AppShell.tsx              Navigation + val mellan demo/live/onboarding
  lib/matrundan/
    types.ts                  Domänmodell
    store.tsx                 Vy-tillstånd, väljer demo- eller live-källa
    session.tsx               Auth-, mode- och gruppvalskontext
    live-repository.ts        Läser gruppens data från Supabase → AppState
    live-mutations.ts         Validerade skrivningar via RPC
    demo-data.ts              Svensk demodata för preview
    places-provider.ts        Provider-gränssnitt för platssökning
    geoapify.functions.ts     Serverfunktioner för Geoapify (authkrav)
    geoapify-normalize.ts     Mappning av Geoapify-taxonomi till appmodellen
    food-tags.ts              Stabil taxonomi och aliasnormalisering
    version.ts                Version och strukturerad changelog
  integrations/supabase/      Auto-genererad Supabase-klient och typer
    (ej att redigera manuellt)
```

Domänmodell, datalager och vyer hålls separerade så att demo- och live-läge
kan följa samma produktflöden utan att UI-komponenterna gör direkta
säkerhetskritiska databasfrågor.

## Konfiguration

Google-inloggningen använder Lovable Clouds hanterade OAuth-broker och de
publicerbara Supabase-nycklarna som redan finns i `.env`
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
`VITE_SUPABASE_PROJECT_ID`). Ingen egen Google Cloud-klient behövs.

Ingen service-role-nyckel finns i klientkoden eller i några `VITE_`-variabler.
Klienten använder enbart publishable key + användarens JWT; all känslig åtkomst
ligger bakom RLS och validerade RPC:er.

Geoapify API-nyckeln (`GEOAPIFY_API_KEY`) läggs i Lovable Cloud → Secrets,
aldrig som en `VITE_`-variabel eller i repot. Servern anropar Geoapify, så
nyckeln exponeras aldrig för klienten. Om nyckeln saknas visas ett tydligt
konfigurationsfel i live-sökningen, medan fliken för manuellt tillägg fortsätter
fungera.

## Lovable

Projektet är kopplat till GitHub. Ändringar som mergas till `main` synkas till
Lovable-previewn. Publicering till den publika appen är ett separat steg efter
verifiering.
