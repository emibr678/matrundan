# Matrundan

Matrundan är en privat webbapp för vänner och familj som vill samla matställen,
välja nästa gemensamma stopp, registrera verkliga besök och bevara gruppens
egna minnen och omdömen.

Fokus är gängets gemensamma matresa – ingen offentlig restaurangkatalog, social
feed, individuell matdagbok eller global ranking.

## Huvudflöde

1. **Utforska eller lägg till** matställen manuellt eller via platssökning.
2. **Välj nästa stopp** manuellt eller genom att slumpa.
3. **Föreslå datum** och låt gruppen svara Passar, Passar inte eller Osäker.
4. **Registrera besöket** med datum, tillfälle och faktiska deltagare.
5. **Spara minnet** med omdöme och ett valfritt privat besöksfoto.

## Funktioner

- Publik landningssida för att skapa grupp, gå med via privat inbjudan eller
  prova den interaktiva exempelgruppen Fredagsgänget i Stockholm.
- Tre huvudvyer: Hem, Matställen och Gruppen.
- Sökning, filtrering, karta och topplista i matställeslistan.
- Flera matställen kan läggas till under samma sökomgång utan att sökning,
  radie, karta eller position försvinner.
- Nästa stopp kan väljas manuellt eller slumpas.
- Ett privat datumförslag med valfri tid kan kopplas till nästa stopp.
- Aktiva medlemmar kan svara Passar, Passar inte eller Osäker.
- Förslagsställaren, ägare eller admin kan bekräfta eller ta bort datumet.
- Registrering av besök med deltagare, omdöme och ett valfritt privat foto.
- Personliga och delade favoriter samt status per matställe.
- Klickbara medlemsprofiler med besök, favoriter och smakprofil.
- Privat, diskret gamification med nivåer, utmärkelser och gruppens höjdpunkter.
- Navigerbart aktivitetsflöde med länkar till besök, matställen och medlemmar.
- Google Maps som extern länk för vägbeskrivning.
- ”Om Matrundan” med aktuell version och versionshistorik.

## Status – v0.19.0

Paket 6D delar upp sammanhanget i ett obligatoriskt **Passar bäst för** och
högst ett frivilligt **Passar också för**. De tre valen är **Snabbt & smidigt**,
**Vardag & häng** och **Något särskilt**.

Matställenas topplista kan växla mellan de tre sammanhangen. Bara det primära
valet avgör var ett ställe rankas; det sekundära valet används för beskrivning
och filtrering. På så sätt kan både en lokal pizzeria och en mer ambitiös
matupplevelse få höga betyg utan att jämföras som samma sorts besök.

## Tidigare – v0.18.0

Paket 6C gör **Passar för** till en tydligare beskrivning av sammanhang:
**Snabbt & enkelt**, **Vardag & häng** och **Middag & upplevelse**. En kort
förklaring visar att kategorierna inte är ett kvalitetsomdöme och att samma
ställe kan passa i flera sammanhang.

Nya ställen får inte längre ett automatiskt förval. Minst ett sammanhang väljs
aktivt, och samma språk används vid tillägg, administration, filtrering och på
matställets detaljsida. Befintliga ställens sparade val bevaras.

Paket 6B gör datumplaneringen på Hem kompakt. Datum, bekräftelse och en kort
svarssammanfattning ligger kvar i huvudflödet, medan svarsalternativ, namn och
hantering öppnas i **Planera nästa stopp**.

Besöksregistreringen kräver nu ett aktivt val av helhetsbetyg. Dialogen har en
enda primär knapp för att spara besöket; möjligheten att lägga till besöket i en
annan grupp erbjuds först efter att det har sparats.

Uppföljningen 6A.1 gör Google Maps tydligt tillgängligt via en egen namngiven
länk och flyttar **Hantera ställe** till den administrativa kontexten vid
**Om stället**.

Paket 6A renodlar appens huvudvyer. Hem äger nästa stopp och progression, medan
aktiviteten nu bara finns på Gruppen. Gruppen visar därför inte längre nästa
stopp en gång till.

Matställen förklarar tydligare vad gruppens lista innehåller, prioriterar
sökningen före topplistan och använder **Lägg till ställe** konsekvent. På
detaljsidan skiljs gruppens nästa stopp, användarens personliga favorit och den
externa Maps-länken tydligare åt. En flagga ersätter den tidigare
glittersymbolen för nästa stopp.

Paket 5D lägger datumplaneringen direkt under gruppens aktuella **Nästa stopp**.
En aktiv medlem kan föreslå en dag och en valfri tid. Varje aktiv medlem kan
svara **Passar**, **Passar inte** eller **Osäker** och ändra sitt svar medan
förslaget är öppet.

Det sker ingen automatisk majoritetsbekräftelse. Förslagsställaren, gruppens
ägare eller admin kan bekräfta eller ta bort datumet. Förslaget stängs
automatiskt om nästa stopp byts, tas bort från gruppen eller registreras som
besökt. Tidigare medlemmars gamla svar räknas inte i den aktuella gruppvyn.

Paket 5C ger varje besök ett valfritt privat foto. Bilden komprimeras och
omkodas före lagring, är privat för ursprungsgruppen och följer inte med när ett
kanoniskt besök delas till en annan grupp.

Paket 5B gör det möjligt att lägga till flera sökträffar i samma omgång.
Sökning, radie, list- eller kartläge, valt resultat och position bevaras efter
varje tillägg.

Paket 5A och 5A.1 skiljer tydligt mellan publik start, interaktiv exempelgrupp
och användarnas riktiga privata grupper. Fredagsgänget använder samma
produktkomponenter men sparar ändringar endast i den aktuella flikens
`sessionStorage`.

## Körlägen

### Publik landning

Standard för utloggade användare. Ingen grupp-store eller privat gruppdata
laddas. Besökaren kan skapa grupp, öppna en privat inbjudan eller prova
Fredagsgänget.

### Exempelgrupp (`/exempel`)

Fast Stockholm-startdata med interaktiva lokala flöden. Medlemmar, besök,
omdömen och historik är fiktiva; de visade matställena är verkliga.
Ändringar sparas i flikens `sessionStorage`, kan återställas och gör inga
live-skrivningar. Datumförslag och besöksfoto använder samma UI som live-läget
men lokala adaptrar.

### Intern testsandbox (`?demo=1`)

Skrivbar lokal sandbox för utveckling och regressionstester. Den använder en
separat `localStorage`-nyckel och är inte den publika startupplevelsen.

### Live-läge

Aktiveras efter Google-inloggning. Läsning och skrivning går mot Supabase via
gruppscopade read-models och validerade RPC-anrop.

## Livefunktioner

- Google-inloggning via Lovable Cloud.
- Skapa och administrera grupper, bjuda in via engångstoken, byta roll, ta bort
  medlemmar, överföra ägarskap, lämna grupp och redigera profil.
- Lägga till matställen, ta bort dem från gruppens aktiva lista och lägga tillbaka
  dem utan att förlora historik eller gruppspecifik metadata.
- Korrigera gruppens kategori, kök, inriktning, Passar för och anteckning.
- Sätta, byta och rensa gruppens nästa stopp.
- Föreslå datum och valfri tid för nästa stopp, svara och bekräfta eller ta bort
  förslaget enligt medlems- och rollregler.
- Registrera besök med deltagare och omdöme atomärt, redigera eget omdöme och
  hantera ett privat besöksfoto.
- Dela ett kanoniskt besök till en annan grupp utan att duplicera plats, besök,
  deltagare eller recensioner.
- Styra egen kommentarssynlighet per grupp.
- Välja om delade besök räknas i progression.
- Geoapify-sökning med server-skyddad API-nyckel, verifierat sökområde och radier
  1/3/5/10/25/50 km.

## Datamodell och integritet

- `places` är kanoniska verkliga matställen.
- `group_places` innehåller gruppens relation, metadata och aktiva samling.
- `visits` är kanoniska verkliga besök.
- `visit_group_links` kopplar original- och mottagargrupper till samma besök.
- `review_group_visibility` styr betygs- och kommentarssynlighet per grupp.
- `visit_media` kopplar ett privat foto till besök + ursprungsgrupp.
- `next_stop_date_proposals` och `next_stop_date_responses` innehåller gruppens
  privata planering för aktuellt nästa stopp.

Känsliga läsningar går genom `get_group_app_state_v5d`. Skrivningar går genom
`SECURITY DEFINER`-RPC:er med låst `search_path`, autentisering, aktivt
medlemskap och relevanta rollkontroller. Ursprungsgruppens identitet, privata
kommentarer och medlemskap lämnar aldrig servern vid delning.

## Teknik

- TanStack Start v1, React 19 och Vite 8
- TypeScript och Tailwind CSS v4
- shadcn/ui och Radix UI
- Bun som pakethanterare och runtime
- Lovable Cloud/Supabase för auth, datalager och privat fillagring

### Kom igång

```sh
bun install
bun run dev
```

Verifiering:

```sh
bun run doctor
bun run verify:changed
bun run verify:agent
bun run verify:full
```

## Arkitektur

```text
src/
  routes/                       Filbaserade vyer
  components/matrundan/
    AppShell.tsx                Landning, exempel och live
    ShellChrome.tsx             Navigation och statusmarkeringar
    NextStopDateCard.tsx        Datumförslag och gruppens svar
    AddPlaceDialog.tsx          Sökning och tillägg av matställen
    VisitDialog.tsx             Registrering av besök
  lib/matrundan/
    types.ts                    Klientens domänmodell
    store.tsx                   Lokal/live-gräns
    next-stop-date.ts           Datumformat, svar och behörighetshjälpare
    live-repository.ts          Säker read-model till AppState
    live-mutations.ts           Validerade RPC-skrivningar
    example-data.ts             Fast exempelstart
    demo-data.ts                Intern testsandbox
    version.ts                  Aktuell version + sammanfogad historik
    version-history.ts          Oförändrad historik till v0.14.0
supabase/migrations/            Schema, RPC, RLS och Storage
```

Den aktuella arkitekturkällan finns i [docs/architecture.md](./docs/architecture.md).
Den detaljerade historiken till och med v0.14.0 finns i
[docs/archive/architecture-v0.14.md](./docs/archive/architecture-v0.14.md).

## Konfiguration

Google-inloggningen använder Lovable Clouds hanterade OAuth-broker och de
publicerbara Supabase-nycklarna i `.env`. Ingen service-role-nyckel finns i
klientkoden eller i `VITE_`-variabler.

Geoapify API-nyckeln (`GEOAPIFY_API_KEY`) lagras i Lovable Cloud Secrets och
används endast server-side.

## Lovable och publicering

Projektet är kopplat till GitHub. Mergade commits på `main` synkas automatiskt
till Lovable-previewn. Publicering till den publika appen är alltid ett separat,
uttryckligt godkänt steg.

Se [CHANGELOG.md](./CHANGELOG.md) för aktuell release och den länkade fullständiga
historiken.
