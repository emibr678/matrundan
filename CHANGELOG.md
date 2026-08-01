# Changelog

Alla noterbara ändringar i Matrundan listas här. Formatet är inspirerat av
[Keep a Changelog](https://keepachangelog.com/sv/1.1.0/) och versionerna
följer [semantisk versionshantering](https://semver.org/lang/sv/).

Den fullständiga historiken till och med version 1.6.0 är bevarad i
[docs/archive/changelog-through-v1.6.md](./docs/archive/changelog-through-v1.6.md).

## [Unreleased]

Inga ändringar ännu.

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
