# Changelog

Alla noterbara ändringar i Matrundan listas här. Formatet är inspirerat av
[Keep a Changelog](https://keepachangelog.com/sv/1.1.0/) och versionerna
följer [semantisk versionshantering](https://semver.org/lang/sv/).

Den fullständiga historiken till och med version 1.6.0 är bevarad i
[docs/archive/changelog-through-v1.6.md](./docs/archive/changelog-through-v1.6.md).

## [Unreleased]

Inga ändringar ännu.

## [1.14.0] – 2026-08-01

### Lagt till

- Manuella matställen kan få en verifierad kartposition när de läggs till i
  live-läge.
- Medlemmen kan samtidigt skapa ett privat underlag om att stället saknas i
  OpenStreetMap. Underlaget granskas av gruppens ägare/admin och publiceras
  aldrig automatiskt.
- Ägare och administratörer får en separat **Möjlig match i gruppen** när en
  senare Geoapify- eller OSM-träff säkert motsvarar ett providerlöst manuellt
  ställe.

### Ändrat

- En bekräftad källkoppling behåller det befintliga plats-ID:t, gruppens privata
  uppgifter, besök och omdömen i stället för att skapa en kanonisk dubblett.
- Tvetydiga matchningar, ställen som redan har en aktiv källa och externa
  identiteter som redan används lämnas orörda.
- Möjliga matchningar kan inte markeras för masstillägg och kräver en separat
  administrativ bekräftelse.

### Databas och säkerhet

- `link_provider_source_to_existing_place_v1` kräver autentisering, aktiv grupp
  och ägare/admin. Målplatsen måste vara ett aktivt manuellt gruppställe utan
  aktiv extern källa.
- Servern kräver exakt en konservativ match baserad på namn, adress och högst
  cirka 100 meters avstånd. Fuzzy auto-merge och sammanslagning av två redan
  etablerade platser ingår inte.
- Geoapify- och eventuell exakt OSM-identitet läggs till i `place_sources`.
  Rå providerdata stannar på serversidan och privata gruppfält skrivs inte om.

## [1.13.0] – 2026-08-01

### Lagt till

- Ägare och administratörer kan granska och redigera den exakta offentliga
  texten innan en rapport publiceras som en anonym OpenStreetMap-anteckning.
- Publicerade OSM-anteckningar får en offentlig länk och en status som kan
  kontrolleras manuellt från gruppens privata granskningskö.

### Ändrat

- **Förberedd för OpenStreetMap** är fortsatt ett internt granskningssteg.
  Publicering kräver en separat bekräftelse och en giltig kartposition.
- Exempelgruppen och testsandboxen simulerar hela publicerings- och
  statusflödet lokalt utan externa nätverksanrop.
- Matrundan kan läsa om en anonym anteckning är öppen eller stängd, men kan inte
  kommentera eller stänga den utan ett autentiserat OSM-konto.

### Databas och säkerhet

- Den privata rapporten lagrar OSM-note-ID, offentlig URL, status och
  kontrolltid. Gruppnamn, rapportör, intern anteckning och interna ID:n skickas
  inte automatiskt till OpenStreetMap.
- Publiceringen reserveras atomiskt, blockerar dubbelpublicering och använder
  låga dygnsgränser per person och grupp.
- Bara serverrollen får registrera ett bekräftat externt OSM-svar. Klienten får
  inte direkt skriva note-ID eller extern status.
- En neutral slumpmässig referens används för att hitta samma anteckning efter
  ett osäkert nätverksavbrott utan att exponera gruppens identitet.

## [1.12.0] – 2026-08-01

### Lagt till

- Alla aktiva gruppmedlemmar kan rapportera felaktigt namn, adress, webbplats,
  dubblett eller en stängd och ersatt verksamhet direkt från matställets
  detaljsida.
- Ägare och administratörer får en privat granskningskö under
  **Gruppinställningar → Platsdata** med rapportens beskrivning och en
  ögonblicksbild av platsinformationen som gällde när rapporten skapades.

### Ändrat

- Rapporter kan vänta på granskning, förberedas för OpenStreetMap, markeras som
  åtgärdade i Matrundan eller avslutas utan åtgärd.
- **Förberedd för OpenStreetMap** är endast ett internt tillstånd i detta paket
  och skapar ingen offentlig OSM-anteckning.
- Exempelgruppen och den interna testsandboxen använder samma rapportflöde men
  sparar endast i respektive webbläsarsession eller lokala testlagring.

### Databas och säkerhet

- `place_data_reports` lagrar gruppprivata rapporter och en begränsad
  ögonblicksbild av platsen och dess källidentiteter. Rå providerdata sparas
  inte i rapporten och lämnas aldrig till klienten.
- Aktiva medlemmar får skapa rapporter endast för ställen som tillhör gruppen.
  Bara ägare och administratörer får läsa gruppens samlade kö eller ändra
  rapportstatus.
- Direkt klientåtkomst till rapporttabellen är spärrad. Läsning och skrivning går
  genom autentiserade, gruppscopade RPC-funktioner med låst `search_path`.

## [1.11.0] – 2026-08-01

### Lagt till

- Matställets egen webbplats visas på detaljsidan när Geoapify och
  OpenStreetMap har en giltig adress.
- Geoapify- och OpenStreetMap-identiteter lagras separat med första och senaste
  observation samt aktiv eller ersatt källkoppling.

### Ändrat

- Webbplatslänkar normaliseras till säkra HTTP- eller HTTPS-adresser och visas
  diskret bredvid Google Maps utan att göra söklistan tyngre.
- En leverantörsidentitet är bara unik bland aktiva källkopplingar. Historiska
  kopplingar kan därmed bevaras när en ny restaurang tar över samma plats utan
  att äldre besök eller omdömen skrivs om.
- Den nya read-modelen lämnar ut webbplats och begränsad källidentitet, men
  aldrig rå leverantörsdata.

### Databas och säkerhet

- Migrationen lägger additivt till `places.website`,
  `group_places.website_override` och livscykelfält på `place_sources`.
- Befintliga källrader markeras som aktiva och tidigare hämtningstid används
  som första observation. Befintliga platser, gruppkopplingar och besök
  bevaras.
- Nuvarande och äldre provider-RPC:er går genom samma rollkontrollerade
  implementation, så en databasdriftsättning kan ske före klientpublicering.

## [1.10.1] – 2026-08-01

### Ändrat

- Sökresultat använder åter det enkla enskilda tillägget som normalläge.
- **Välj flera** aktiverar ett separat läge med kryssrutor och en gemensam
  batchåtgärd. **Avbryt** rensar urvalet och återställer normalläget.
- Listan och kartan följer samma läge, så masstillägget inte längre konkurrerar
  visuellt med det vanliga tilläggsflödet.

## [1.10.0] – 2026-08-01

### Lagt till

- Flera nya sökträffar kan markeras i listan eller på kartan och läggas till i
  gruppen i samma omgång.
- Filtergruppen **Saknar uppgifter** hittar ställen utan **Kök/inriktning**,
  **Passar för** eller båda.

### Ändrat

- Masstillägg använder providerkategori och tillgängliga uppgifter om kök och
  inriktning, medan osäkra gruppuppgifter lämnas tomma för senare komplettering.
- Alla aktiva medlemmar kan redigera kategori, kök och inriktning, Passar för
  och gruppens privata anteckning.
- Ägare och administratörer behåller ensamrätt på att ta bort och lägga tillbaka
  ställen samt dölja felaktiga providersökträffar.
- Ett masstillägg ger en sammanfattad aktivitet i stället för en aktivitet per
  ställe.

### Teknik och säkerhet

- `create_or_link_provider_places_batch_v1` behandlar högst 50 validerade
  providerträffar per anrop, deduplicerar på provideridentitet och isolerar fel
  per träff.
- Batch-RPC:n och metadata-RPC:n kräver autentisering, aktiv grupp och aktivt
  medlemskap. Direkt anonym åtkomst är spärrad.
- Migrationen bevarar befintliga kanoniska platser, gruppkopplingar, metadata
  och historik.

## [1.9.0] – 2026-08-01

### Ändrat

- **Passar för** väljs direkt med en eller två likvärdiga kategorier utan ett
  separat steg för **Passar bäst för** och **Passar också för**.
- Ett ställe med två val visas i topplistan för båda kategorierna.
- Detaljsidan och administrationen visar alla val under en gemensam
  **Passar för**-rubrik.
- Befintliga val behålls. Ingen databasrensning eller migration behövs eftersom
  samma fält och högst två värden används vidare utan ordningssemantik.

## [1.8.1] – 2026-07-31

### Ändrat

- **Lägg till matställe** visar färre instruktioner och låter sökfält,
  sökområden och handlingar förklara flödet.
- Google Maps-knappen heter **Öppna i Google Maps** och den överflödiga
  hjälptexten under knappen är borttagen.
- Valfria uppgifter använder kortare och konsekvent copy i både sökresultat och
  manuellt tillägg.
- Gränsen på fem samtidiga sökområden visas först när den har nåtts.

## [1.8.0] – 2026-07-31

### Lagt till

- Ägare och administratörer kan välja **Dölj från gruppens sökningar** för en
  felaktig eller inaktuell providerträff.
- Dolda sökträffar lagras per grupp och kan återställas under
  **Gruppinställningar → Dolda sökträffar**. Det verkliga matstället raderas
  inte och andra grupper påverkas inte.
- Exempelgruppen sparar samma val i webbläsarsessionen i stället för databasen.

### Ändrat

- Mobilväljaren för **Kök och inriktning** är en stabil helskärmsdialog med
  `100dvh`, låst rubrik och Klar-knapp samt en separat scrollande resultatlista.
  Den kan inte längre dras bort med en swipe och använder ingen egen
  `visualViewport`-höjd.
- **Så fungerar Passar för** öppnas på mobil i en begränsad, vertikalt
  scrollningsbar dialog med stängknapp och safe-area-stöd. Desktop behåller en
  kompakt popover.
- Google Maps-sökningen tar bort dubblerade namn, adresser och områden. En riktig
  gatuadress används när den finns och koordinater används som reserv när
  platsinformationen är knapp.
- Texten kring Google Maps förklarar att länken gör en sökning och att rätt
  verksamhet behöver kontrolleras.

### Fixat

- Android WebView kan inte längre lämna ett tomt vitt lager när tangentbordet
  stängs i väljaren för Kök och inriktning.
- Passar för-förklaringen fortsätter inte utanför skärmen på korta mobila
  viewportar.
- Geoapify-träffar som uttryckligen är märkta som nedlagda, övergivna, rivna
  eller borttagna filtreras bort.

### Teknik och säkerhet

- `group_hidden_place_suggestions` identifierar en dold träff med grupp,
  leverantör och provider-ID. Direkt tabellåtkomst är spärrad; läsning och
  ändringar går genom medlems- respektive rollkontrollerade RPC-funktioner.
- Release-CI kräver versionshöjning för användarsynlig kod och migrationer och
  verifierar att apphistorik samt senaste daterade changelogpost matchar version
  och datum.
- Negativa kontraktstester säkerställer att en UI-ändring utan versionshöjning
  stoppar CI.

## [1.7.1] – 2026-07-31

### Ändrat

- Ett sökresultat öppnas först i en informationsvy där platsen kan kontrolleras
  i Google Maps innan den läggs till i gruppen.
- **Passar för** är frivilligt vid tillägg och kan kompletteras när gruppen har
  besökt eller lärt känna stället.

## [1.7.0] – 2026-07-31

### Ändrat

- **Passar för** använder nu **Snabbt och enkelt**, **Avslappnat** och
  **Något extra**.
- Ett ställe kan ha ett primärt och ett frivilligt sekundärt val, men valet får
  lämnas tomt tills gruppen vet.
- Tidigare Passar för-val nollställs genom migration eftersom den äldre
  indelningen inte kan översättas säkert till de nya kategorierna.

## [1.6.2] – 2026-07-31

### Ändrat

- Gruppinställningarnas vanliga sökområden använder samma autocomplete-till-
  valbricka-flöde som sökdialogen och sparas tillsammans med gruppens övriga
  ändringar.
- Breda administrativa Geoapify-resultat som kommuner, län, regioner och länder
  visas som vägledning men kan inte väljas som oprecisa punktcentrum.

## [1.6.1] – 2026-07-31

### Ändrat

- Sökområden väljs i ett återanvändbart platsfält. Varje vald träff läggs direkt
  till som en valbricka och fältet kan användas igen utan en extra panel eller
  bekräftelseknapp.
- Flerområdeskartan använder canvasrenderade kategoriikoner i stället för
  enhetsberoende emoji-glypher, vilket ger stabilare markörer på mobil.
- Live-läsningen faller tillfälligt tillbaka till den föregående kompatibla
  read-modelen om den aktuella RPC-funktionen saknas efter en ofullständig
  databasdriftsättning.
