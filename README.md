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

- Tydlig landningssida för att skapa grupp, gå med via inbjudan eller prova
  den interaktiva exempelgruppen Fredagsgänget i Stockholm.
- Tre huvudvyer: Hem, Matställen och Gruppen.
- Sökning, filtrering, karta och topplista i matställeslistan.
- Registrering av besök med valfria detaljbetyg, kommentarer och ett privat foto.
- Personliga och delade favoriter, samt status per matställe
  (”Nytt för mig”, ”Nytt för gruppen”, ”Alla har provat”).
- Klickbara medlemsprofiler med besök, favoriter och smakprofil.
- Navigerbart aktivitetsflöde med djuplänkar till besök, matställen och
  medlemmar.
- Google Maps som extern länk för vägbeskrivning.
- ”Om Matrundan” med aktuell version och versionshistorik.

## Status – v0.14.0

Paket 5C lägger till ett valfritt privat foto per besök. Bilden kan väljas vid
registreringen eller hanteras i efterhand, komprimeras och omkodas innan den
sparas och visas som ett minne i gruppens besökshistorik. Endast faktiska
deltagare eller gruppens ägare och admin får ändra fotot. Det är kopplat till
ursprungsgruppen och följer aldrig automatiskt med när besöket delas vidare.
Fredagsgänget använder samma gränssnitt men lagrar bilden bara lokalt i sessionen.

Paket 5B gör det möjligt att lägga till flera sökträffar i samma omgång.
Sökdialogen, radien, list- eller kartläget, det valda resultatet och positionen
bevaras efter varje tillägg. Resultat märks Tillagd, Finns redan eller Lägg
tillbaka, en räknare summerar omgången och Klar avslutar uttryckligt. Manuellt
tillägg och den kanoniska dubblett- och återaktiveringslogiken är oförändrade.

Paket 5A och 5A.1 skiljer tydligt mellan en publik start, en interaktiv
exempelgrupp och användarnas riktiga privata grupper. En utloggad användare
möts av en landningssida med valen att skapa grupp, gå med via en privat
inbjudningslänk eller prova **Fredagsgänget**.

Fredagsgänget är märkt **Exempelgrupp · Stockholm** på alla vyer. Gruppen,
medlemmarna, besöken, omdömena och aktiviteten är fiktiva exempeldata, medan
de visade matställena är verkliga Stockholm-ställen. Kärnflödena kan provas
med samma komponenter och lokala mutationer som appen i övrigt. Ändringar
sparas bara i den aktuella flikens `sessionStorage`, kan återställas och når
aldrig Supabase eller användarens riktiga grupper.

Platsadministrationen från Paket 4C är kvar: ägare och admin kan ta bort ett
matställe från gruppens aktiva lista utan att tidigare besök, omdömen eller
gruppens egna platsuppgifter försvinner. Kök och inriktning väljs från den
gemensamma normaliserade listan och mobilväljaren följer den synliga viewporten
när tangentbordet visas.

### Tre körlägen

- **Publik landning:** standard för utloggade användare. Ingen gruppdata eller
  grupp-store laddas. Här kan besökaren skapa grupp, gå med via inbjudan eller
  öppna exempelgruppen.
- **Exempelgrupp (`/exempel`):** fast Stockholm-startdata med interaktiva lokala
  flöden. Ändringar lagras i flikens `sessionStorage`, kan återställas och gör
  inga live-skrivningar.
- **Live-läge:** aktiveras efter Google-inloggning. Läsning och skrivning går mot
  Supabase enligt RLS. Har användaren inga grupper visas onboardingen.

Den interna utvecklings- och regressionstestsandboxen nås fortsatt via
`?demo=1`. Den är skrivbar och använder separat `localStorage`, men är inte
appens publika startupplevelse.

### Vad som fungerar i live-läget

- Google-inloggning via Lovable Cloud.
- Skapa och administrera grupper, bjuda in via engångstoken, byta roll,
  ta bort medlemmar, överföra ägarskap, lämna grupp och redigera profil.
- Lägga till matställen, ta bort dem från gruppens aktiva lista och lägga
  tillbaka dem utan att förlora historik eller gruppspecifik metadata.
- Korrigera gruppens kategori, kök och inriktning, Passar för och anteckning.
- Registrera besök med deltagare + omdöme atomärt, redigera eget omdöme,
  lägga till ett privat besöksfoto, favoritmarkera och sätta/byta/rensa gruppens
  nästa stopp.
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
    exempel.tsx               Interaktiv exempelgrupp i aktuell session
    matstallen.tsx            Lista, karta, sök och filter
    matstallen.$placeId.tsx   Matställets detaljvy
    gruppen.tsx               Gänget, aktivitet, inställningar
  components/matrundan/       Feature-komponenter (dialogs, sheets, kort)
    AuthMenu.tsx              Google-inloggning och gruppväxlare
    LandingScreen.tsx         Publik start för skapa, gå med och exempel
    OnboardingScreen.tsx      Skapa första gruppen i live-läge
    ShellChrome.tsx           Navigation och beständiga statusmarkeringar
    GeoapifyLocationInput.tsx Återanvändbart Plats-fält med verifierat val
    FoodTagMultiSelect.tsx    Sökbar väljare för kök och inriktning
    PlaceMap.tsx              Gruppens aktiva matställen på karta
    AppShell.tsx              Val mellan landning, exempel och live
  lib/matrundan/
    types.ts                  Domänmodell
    store.tsx                 Vy-tillstånd och val av lokal/live-lagring
    session.tsx               Auth-, mode- och gruppvalskontext
    live-repository.ts        Läser gruppens data från Supabase → AppState
    live-mutations.ts         Validerade skrivningar via RPC
    example-data.ts           Fast Stockholm-startdata för exempelgruppen
    demo-data.ts              Skrivbar lokal data för utveckling och tester
    places-provider.ts        Provider-gränssnitt för platssökning
    geoapify.functions.ts     Serverfunktioner för Geoapify (authkrav)
    geoapify-normalize.ts     Mappning av Geoapify-taxonomi till appmodellen
    food-tags.ts              Stabil taxonomi och aliasnormalisering
    version.ts                Version och strukturerad changelog
  integrations/supabase/      Auto-genererad Supabase-klient och typer
    (ej att redigera manuellt)
```

Domänmodell, datalager och vyer hålls separerade så att exempel-, demo- och
live-läge kan följa samma läsmodell utan att UI-komponenterna gör direkta
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