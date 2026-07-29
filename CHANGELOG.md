# Changelog

Alla noterbara ändringar i Matrundan listas här. Formatet är inspirerat av
[Keep a Changelog](https://keepachangelog.com/sv/1.1.0/) och versionerna
följer [semantisk versionshantering](https://semver.org/lang/sv/).

Den fullständiga historiken till och med version 0.14.0 är bevarad i
[docs/archive/changelog-through-v0.14.md](./docs/archive/changelog-through-v0.14.md).

## [0.19.1] – 2026-07-29

### Förbättrat

- Hem visar **Ni har provat 6 av 9 ställen** och progressbaren utan ett
  redundant procenttal.
- När användaren söker döljs topplistan, så sökfältet leder direkt till den
  filtrerade listan.
- **Passar för** förklaras med konkreta sorters besök utan det abstrakta
  samlingsordet ”sammanhang”.
- Det frivilliga **Passar också för** öppnas genom en uttrycklig handling i
  stället för att en ny rad dyker upp automatiskt.

### Rättat

- Progressionsraden på Hem klistrar inte längre ihop text och procenttal på
  smala skärmar.
- Det överflödiga valet **Inget andra sammanhang** är borttaget.

## [0.19.0] – 2026-07-29

### Nytt

- Topplistan kan växla mellan **Snabbt & smidigt**, **Vardag & häng** och
  **Något särskilt**.
- Ett ställe rankas endast i sitt primära sammanhang och ordnas efter gruppens
  synliga medelbetyg.

### Förbättrat

- Varje ställe får ett obligatoriskt **Passar bäst för** och högst ett frivilligt
  **Passar också för**.
- Sammanhangen beskriver situationen, inte objektiv kvalitet, prisnivå eller
  ambitionsnivå.
- Befintliga sparade val tolkas i sin nuvarande ordning som primärt och
  sekundärt. Inga produktionsrader skrivs om automatiskt.

### Rättat

- Den fria flervalsmodellen från 0.18.0 har ersatts med den beslutade
  klassificeringen innan topplistorna byggdes vidare.

## [0.18.0] – 2026-07-29

### Förbättrat

- **Tydligare sammanhang.** **Passar för** använder nu **Snabbt & enkelt**,
  **Vardag & häng** samt **Middag & upplevelse**. Kategorierna beskriver vilken
  typ av besök stället passar för – inte dess absoluta kvalitet.
- En mobilvänlig förklaring ger exempel för varje kategori och tydliggör att ett
  ställe kan passa i flera sammanhang.
- Nya ställen får inte längre en kategori automatiskt. Minst ett sammanhang
  måste väljas aktivt innan stället kan läggas till.
- Samma kategorier och hjälp används vid tillägg, administration, filtrering och
  på matställets detaljsida. Befintliga ställens sparade val bevaras.

### Rättat

- Kategoriväljaren och förklaringen verifieras vid 360 px utan horisontell
  overflow.

## [0.17.0] – 2026-07-29

### Förbättrat

- **Kompakt datumplanering.** Hem visar datum och aktuell svarssammanfattning på
  en lugn rad. Svarsalternativ, namn och hantering öppnas i den separata vyn
  **Planera nästa stopp**.
- Bekräftade datum visas utan en tung svarssammanställning på Hem.
- **Aktivt helhetsbetyg.** Besöksregistreringen börjar utan förvalt betyg och
  kan inte sparas förrän användaren själv har valt 1–5.
- Besöksdialogen har en enda primär sparaknapp. För användare med flera grupper
  erbjuds **Lägg till i annan grupp** först efter att besöket har sparats.

### Rättat

- Datumplaneringen och besöksdialogen verifieras vid 360 px utan horisontell
  overflow.

## [0.16.1] – 2026-07-29

### Förbättrat

- **Tydligare Google Maps.** Adressen är åter vanlig information och kompletteras
  av den tydliga länken **Öppna i Google Maps**.
- **Bättre placerad administration.** **Hantera ställe** ligger nu diskret intill
  **Om stället** i stället för ensam längst ned i huvudkortet.

## [0.16.0] – 2026-07-29

### Förbättrat

- **Tydligare ansvar för huvudvyerna.** Hem fokuserar på nästa stopp och
  progression. Gruppen äger aktivitet och visar inte längre nästa stopp en gång
  till.
- **Tydligare Matställen.** Sidan förklarar att listan innehåller vad gänget vill
  prova och har provat, sökningen kommer före topplistan och handlingen heter
  konsekvent **Lägg till ställe**.
- **Tydligare handlingar på matställets detaljsida.** Nästa stopp skiljer på
  handling och status, personlig favorit heter **Favorit** och Maps nås via
  adressen i stället för en likvärdig åtgärdsknapp.
- Flaggan ersätter glittersymbolen för nästa stopp.
- Medlemsraderna på Gruppen har färre överflödiga etiketter.

### Rättat

- Huvudvyerna och matställets detaljsida har ett riktat mobiltest som verifierar
  informationsplacering, copy och avsaknad av horisontell overflow vid 360 px.

## [0.15.0] – 2026-07-28

### Nytt

- **Datumförslag för nästa stopp.** En aktiv gruppmedlem kan föreslå en dag och
  en valfri tid direkt på kortet för gruppens aktuella nästa stopp.
- Varje aktiv medlem kan svara **Passar**, **Passar inte** eller **Osäker** och
  ändra sitt svar så länge förslaget är öppet.
- Gruppen ser både antal och namn för de aktuella svaren.

### Förbättrat

- Förslagsställaren, gruppens ägare eller admin kan bekräfta eller ta bort
  datumet. Det sker ingen automatisk bekräftelse utifrån majoritet.
- Ett öppet eller bekräftat datumförslag stängs automatiskt när nästa stopp
  byts, tas bort från gruppen eller registreras som besökt.
- Datumförslag och svar är privata för gruppen. Direkt tabellåtkomst är
  återkallad och skrivningar går genom medlems- och rollvaliderade
  `SECURITY DEFINER`-RPC:er.
- Läsmodellen räknar endast svar från aktiva medlemmar.
- Fredagsgänget använder samma gränssnitt och sparar planeringen tillfälligt i
  den lokala webbläsarsessionen utan live-skrivningar.

### Rättat

- 360 px-regressionen verifierar att gruppen kan föreslå, svara, bekräfta,
  ladda om och ta bort datumet utan horisontell overflow.
