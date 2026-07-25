
# Rekommendation: Sökning & Gamification i Matrundan

Ingen kod ändras här — detta är ett beslutsunderlag. Efter godkännande delar jag upp det i konkreta implementationssteg.

---

## 1. Geoapify och områdessökning

### Nuläge
`AddPlaceDialog` har idag två separata inmatningar: fritt sökord + ett "Plats"-fält som `parseLocation` splittar på komma till `{area, city}`. Provider-kontraktet (`PlacesSearchOpts`) kräver `city` som obligatorisk sträng och tolkar `area` som filter. Det tvingar användaren att veta och skriva båda — en krycka för att demo-providern inte kan geokoda.

### Princip
Rätt mönster med en riktig geokodare (Geoapify) är **ett fält, autocomplete-driven**. Användaren skriver "Gamla Enskede", får ett rankat förslag, väljer det, och appen får tillbaka strukturerad data (område, stad, lat/lng, land). Tvetydiga namn ("Centrum") disambigueras genom att flera förslag visas — inte genom att användaren fyller i mer.

### Rekommenderat upplägg

**Två inmatningsfält, men båda med autocomplete och båda valfria:**

1. **Vad** (frivilligt) — namn eller typ, t.ex. "pizza", "Trattoria La Strada".
2. **Var** (frivilligt) — område, stad, adress eller landmärke. Autocomplete via Geoapify Autocomplete API. När användaren väljer ett förslag lagras `{lat, lng, city, area, country, boundingBox}` som en `LocationBias`.

**Sökbeteende:**
- Har användaren valt en Var-plats → använd `bias`-parameter (mjuk viktning), inte `filter` (hård begränsning). Geoapify stödjer detta via `bias=proximity:lng,lat` och `bias=countrycode:se`.
- Ingen Var vald → använd gruppens valfria hemort som mjuk bias, annars hela Sverige.
- **Radiereglaget slopas** i sitt nuvarande skarpa läge. Ersätts av en enkel toggle: **"Nära vald plats"** (bias) ↔ **"Hela landet"** (ingen bias). Att välja km i förväg är fel abstraktion — användaren tänker inte i kilometer, hen tänker "här" eller "överallt".
- Gruppens hemort är alltid mjuk bias, aldrig hård begränsning. Uppfyller kravet "grupper som vill utforska pizzerior i hela Sverige".

### Datamodells- och UI-konsekvenser

- **Provider-kontrakt:** ersätt `{ city, area, radiusKm }` med `{ query?, near?: { lat, lng, radiusKm? } | null, countryCode? }`. `near` är den valda Var-platsen, `null` = ingen bias.
- **Ny typ `LocationBias`** i `location.ts`: `{ label, lat, lng, city?, area?, country }`. Ersätter `parseLocation`/`formatLocation`.
- **UI i `AddPlaceDialog`:** två `Command`-baserade combobox-fält (shadcn), en toggle "Nära/Överallt", ingen km-select. Kartvyn behålls men centreras på Var-platsen om vald, annars på första träffen.
- **Ingen ny state i store** — Var-valet är dialoglokalt.
- **Demo-läget:** demo-providern får en enkel autocomplete-lista över svenska stadsdelar (Gamla Enskede, Södermalm, Haga, Majorna, Centrum-Göteborg vs Centrum-Malmö osv.) så mönstret är korrekt redan innan Geoapify kopplas in. Ingen fuzzy stad+område-splittring behövs längre.
- **Geoapify-nyckeln** läses via server-funktion när backend kopplas på; inget i klientkoden.

### Vad byggs nu / senare
- **Nu:** enfältsmönstret (Vad + Var som autocomplete) mot demo-providern, ny provider-signatur, borttagen radie-select, toggle Nära/Överallt.
- **Senare:** Geoapify-provider som drop-in mot samma kontrakt.

---

## 2. Gamification

### Grundhållning
Matrundan är en varm, privat app för familj/vänner — inte Foursquare. Gamification får förstärka det sociala utforskandet men aldrig göra registrering av besök till en självbelöning. Detta styr alla val nedan.

### Rekommendation: gruppintern nivå + mjuka utmärkelser. Ingen global leaderboard.

**Nivå = per grupp.** Global nivå bryter isoleringsprincipen (skulle kräva att medlem A ser data från medlem B:s andra grupper, vilket är fel för en privat app). Per-grupp håller känslan intim och gör att en ny grupp känns som en ny resa, inte en fortsättning av ett existerande poängkonto.

**Statistik på medlemsprofilen delas i två block:**
- *I den här gruppen* (primärt, större): besök, provade ställen, favoriter, aktuell nivå.
- *Totalt* (sekundärt, mindre, längst ner): summerat över alla grupper användaren är med i, utan att avslöja gruppnamn. Skapar en känsla av personlig resa utan att exponera andra grupper. Endast användaren själv ser sitt "Totalt"-block på egen profil — andras profiler visar bara gruppdata.

### Nivåmodell

Mät på **unika matställen provade i gruppen**, inte antal besök. Det korrigerar direkt för missbruk (registrera 10 besök samma vecka på samma ställe ger inte nivå). Besöksantal kan visas som separat statistik men styr inte progression.

Fem nivåer med lätt-svensk ton:

| # | Namn | Unika ställen |
|---|---|---|
| 1 | Nybörjare | 0 |
| 2 | Matupptäckare | 3 |
| 3 | Smakletare | 8 |
| 4 | Mataventyrare | 20 |
| 5 | Matkonnässör | 40 |

Motivering av trösklar: en aktiv grupp som besöker ~1 ställe/vecka når nivå 3 på ca två månader, nivå 4 på ~5 månader, nivå 5 på nästan ett år. Håller progressionen levande utan att bli triviell. Justera efter första riktiga användning.

### Badges (komplement, inte ersättning)

Nivåer visar bredd. Badges visar karaktär. Ett litet antal, mjuka och beskrivande — inte "achievements" i spelmening:

- **Fikaexpert** — 5+ besök i kategori café/bageri.
- **Nattugglan** — 3+ besök med tillfälle "Kväll".
- **Världsresenären** — provat 5+ olika kök.
- **Pionjär** — först i gruppen att prova 3+ ställen.
- **Bidragaren** — föreslagit 5+ ställen som andra sen besökt.

Alla räknas per grupp. Visas som små chips på medlemsprofilen under nivåbadgen.

### Leaderboard: nej, men "Denna månad i gruppen"

En traditionell leaderboard ("Anna 42, Erik 31, Maja 12") skapar fel dynamik i en liten privat grupp — det pekar ut den som registrerar minst. Istället: en liten **"Denna månad"-modul** i Gruppen-fliken som lyfter *aktivitet*, inte rangordning:

- "Ni har provat 4 nya ställen denna månad"
- "Erik föreslog flest ställen (3)"
- "Maja provade sitt första bageri"

Positivt, kollektivt fokus, roterande innehåll. Om användarna senare uttryckligen ber om rangordning kan en opt-in leaderboard läggas till per grupp.

### Anti-missbruk

- Nivå räknas på **unika `placeId`**, inte besöksrader.
- Badges som räknar besök har högsta rimliga tröskel (5+, inte 20+).
- Ingen synlig "poäng" — bara nivånamn och unika-ställen-räknare. Utan siffra att jaga blir manipulation ointressant.
- Ingen påminnelse/notis av typen "du är 1 besök från nästa nivå" — det är precis den mekanism som lockar till fejkbesök.

### Datamodells- och UI-konsekvenser

- **Ingen ny persisterad data behövs** för nivåer och badges — allt härleds från befintliga `visits`, `favorites`, `places` via en ren funktion `deriveMemberStats(state, memberId)` i `src/lib/matrundan/store.tsx` eller ny `src/lib/matrundan/gamification.ts`.
- **Ny modul `gamification.ts`:** definierar `LEVELS`, `BADGES`, funktioner `levelFor(uniquePlaces)`, `badgesFor(stats)`, `monthlyGroupHighlights(state)`.
- **UI-ändringar:**
  - `MemberProfileSheet`: lägg till nivåbadge i headern (bredvid rollen), badge-chips under smakprofil, samt ett "Totalt"-block som bara syns för `currentUserId === member.id`.
  - `gruppen.tsx`: ny "Denna månad"-modul ovanför medlemslistan.
  - Ingen ändring i `types.ts` eller `store.tsx` state.
- **Svenska termer:** "Nivå", "Utmärkelser", "Denna månad". Undvik "achievements", "score", "XP".

### Vad byggs nu / senare / inte alls

- **Nu:** nivåer (härledda), 4-5 badges, nivåbadge på medlemsprofil, "Totalt"-block för egen profil.
- **Senare:** "Denna månad"-modulen i Gruppen-fliken (kräver lite mer polering av copy och roterande innehåll).
- **Inte alls, tills vidare:** traditionell leaderboard med rangordning, notiser om "nästa nivå", synliga poängsummor, cross-group nivåer, streaks/serier.

---

## Sammanfattning av nästa steg

1. **Sökning:** enfältsmönster med Vad + Var (autocomplete), Nära/Överallt-toggle, ny provider-signatur, uppdaterad demo-provider.
2. **Gamification:** ny `gamification.ts` med härledda nivåer och badges, uppdaterad `MemberProfileSheet` med nivå, badges och privat "Totalt"-block.
3. **Senare:** "Denna månad"-modul och skarp Geoapify-provider.

Säg till om något av detta ska justeras — t.ex. andra nivånamn, andra trösklar, eller om du hellre vill dela upp implementationen i två separata leveranser (sökning först, gamification sedan).
