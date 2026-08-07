# UX-bedömning: Issue #148 – "Sök i" före intelligent matställessökning

Endast UX-konsultation. Ingen kod ändras. Bedömningen bygger på aktuell
`PlaceDiscoveryV16`, `SearchAreaControlsV16`, `SearchAreaPill`,
`GeoapifyLocationInput` och `SearchResultSectionsV16`.

## 1. Rekommenderad informationshierarki och ordning

Målbilden är rätt: geografin är en förutsättning, inte ett filter. Men dagens dialog
har fyra separata block före första träffen (Sök, Sökområden, hjälptext, Sökradie).
Det är ett block för mycket. Rekommenderad ordning, identisk på mobil och desktop:

1. **Sök i** – ett kompakt block: pills för aktiva områden + en diskret
   "Lägg till område" + radien som inline-kontroll i samma block.
2. **Sök matställen** – textfält med grupperad autocomplete.
3. **Resultat** – lista/karta-toggle på mobil, delad kolumn på desktop (oförändrat).

Motivering: "Sök i" läses som en mening ("Sök i Södermalm, Vasastan – inom 2 km"),
och matställesfältet blir det sista och därmed mest handlingsnära steget precis ovanför
träffarna. På desktop behålls samma vertikala ordning i vänsterkolumnen; inför inte en
egen desktoplayout för kontrollerna, det dubblar underhåll utan UX-vinst.

## 2. Hur "Sök i" visar pills och "Lägg till område eller adress"

Rekommendation: **pills först, fältet dolt till efterfrågan.**

- Rubrik `Sök i` + pill-rad direkt under. Förvalda gruppområden är redan pills, så
  användaren ser omedelbart var vi söker.
- Sista elementet i samma wrap-rad är en pill-formad knapp `+ Område` (aria-label
  "Lägg till område eller adress för den här sökningen"). Den ligger i pill-flödet så
  att raden inte får en egen höjd.
- Klick på `+ Område` fäller ut det befintliga `GeoapifyLocationInput` under raden.
  Efter valt område kollapsar fältet igen och nytt pill läggs till. Detta är den enskilt
  största höjdvinsten: autocomplete-fältet är permanent synligt idag men används sällan,
  eftersom gruppens områden nästan alltid räcker.
- Hjälptexten "Ändringar här gäller bara den här sökningen" bör flyttas in i det
  utfällda fältets beskrivning istället för att alltid ligga synlig. Den är bara
  relevant i det ögonblick användaren ändrar något.
- Vid 5 av 5 områden ersätts `+ Område`-knappen av samma status som idag, men som en
  kort rad under pillsen, inte en fullbredds-panel.

## 3. Var sökradien bör ligga

Rekommendation: **kompakt inline i "Sök i"-blocket, alltid synlig, men inte som eget
märkt formulärfält.**

Motivering: motorn använder fortfarande en gemensam punkt/radie-sökning, så radien är
inte en avancerad inställning – den är en direkt del av "var vi söker" och avgör hur
många träffar användaren får. Att gömma den bakom en expander gör tomma resultat
oförklarliga ("inga träffar" utan synlig orsak). Samtidigt förtjänar den inte en egen
`Label` + fullbredds-select som idag.

Konkret: en liten select/trigger till höger i samma rad som rubriken `Sök i`, med texten
`inom 2 km`. Vid 360 px läggs den på egen rad direkt under rubriken, högerställd, och
bibehåller 44 px tryckyta. Behåll dagens radievärden och copy ("Större område · inom
50 km").

## 4. "Sök matställen" och den grupperade autocompleten

Fältet: label `Sök matställen`, placeholder `Namn, kök eller inriktning`. Behåll
sökikonen och `pl-9`. Debounce som idag.

Autocomplete som listbox med två grupper, i denna ordning:

1. **Sök brett** (generella val) – t.ex. `Sushi`, `Pasta`, `Italienskt`, `Café`.
   Rad: ikon `Search` + termen + sekundär text `kök` / `kategori` / `inriktning`.
   Val fyller fältet med termen och kör en vanlig bred sökning.
2. **Matställen** (specifika träffar) – rad: kategori-emoji som i sökträffslistan +
   namn (fetare) + andra raden med adress när den finns, annars `område · ort`.
   Val filtrerar/hoppar till just det stället i resultatlistan; sökområdet ändras aldrig.

Grupperubrikerna är den viktigaste mekanismen mot förvirring – de behöver vara synliga
`text-[11px] uppercase text-muted-foreground`-rubriker, inte bara avdelare.

Vald-state: när ett specifikt ställe valts visas en liten borttagbar markering i fältet
eller direkt under det (`✕ Päronträdets Trattoria`) så att användaren förstår att listan
är avsmalnad och hur den återställs. En generell term ger ingen sådan markering – den
syns som vanlig text i fältet. Skillnaden i vald-state är i sig en förklaring av
skillnaden i betydelse.

## 5. Innan användaren har ett aktivt sökområde

Visa inte tomma resultat och kör ingen sökning. Istället:

- `Sök matställen`-fältet renderas men är inaktiverat med hjälptext
  `Välj först var vi ska söka.`
- I "Sök i"-blocket visas dagens streckade tomtillstånd, men med copy som pekar på
  handlingen: `Lägg till ett område för att söka.` och `+ Område` primärt markerad.
- Detta är också argumentet för att geografin ligger först: ett inaktivt fält under en
  tom sektion är begripligt; ett aktivt fält som inte ger träffar är det inte.

## 6. Undvika förvirring mellan generellt val och specifikt ställe

Fyra samverkande signaler, ingen av dem ny grafik:

- gruppering med rubriker (`Sök brett` vs `Matställen`);
- olika radikon (lupp vs kategori-emoji);
- olika radhöjd/innehåll (en rad vs två rader med adress);
- olika konsekvens som syns efteråt (fritext i fältet vs borttagbar markering).

Undvik badges eller färgkodning – det bryter Matrundans lugna uttryck och tillför inget
utöver grupperingen.

## 7. Edge cases vid 360 px

- **Många/långa pills**: behåll `flex-wrap` och `truncate` med `title`. Sätt tak för
  synliga pills till fyra plus `+2` som fäller ut resten, annars kan fem långa
  adressetiketter äta halva dialoghöjden. `shortSearchAreaLabel` används redan.
- **Långa restaurangnamn/adresser**: två rader med `break-words` per rad och max två
  rader på adressraden (`line-clamp-2`). Ingen horisontell scroll.
- **Autocomplete ovanpå dialogens scroll**: viktigast tekniska risken. Använd samma
  popover-strategi som `GeoapifyLocationInput` redan gör i dialogen, så att listan inte
  klipps av dialogens `overflow-y-auto`. Begränsa listhöjden till ca 40 vh och tillåt
  scroll i listan. Kollapsa listan vid scroll i dialogen istället för att låta den
  följa med.
- **Tangentbord på mobil**: när matställesfältet fokuseras ska "Sök i"-blocket inte
  kollapsa eller flytta sig – layoutstabilitet före smarthet.

## 8. Tillgänglighet

- Matställesfältet: `role="combobox"`, `aria-expanded`, `aria-controls`,
  `aria-activedescendant`; listan `role="listbox"` med `role="group"` +
  `aria-label` per grupp och `role="option"` per rad.
- Piltangenter hoppar över gruppubriker; `Home`/`End` till första/sista; `Esc` stänger
  listan utan att rensa fältet; `Enter` väljer markerad rad.
- `+ Område` är en riktig `button` med `aria-expanded` mot det utfällda fältet. Fokus
  flyttas till fältet vid utfällning och tillbaka till `+ Område` vid stängning.
- Pill-raden behåller `role="list"`/`listitem` och `aria-label="Valda sökområden"`.
- Antal träffar annonseras i en `aria-live="polite"`-region (finns delvis redan som
  träffräknaren).
- Alla tryckytor minst 44 px, inklusive radie-triggern och pillens `✕`.

## 9. Vad som uttryckligen bör lämnas orört

- `SearchResultSectionsV16` – sökträffslistan, dess kompakta radlayout och
  "Redan i gruppen"-sektionen.
- Lista/karta-toggle, `MultiAreaPlaceMap`, markörbeteende och radiecirklar.
- "Välj flera"/bulkläge och den sticky bulk-panelen.
- Förhandsdialogen "Lägg till i gruppen" och den ordinarie platsdetaljsidan (#108).
- Manuellt tillägg (`ManualAddPlaceFormV16`).
- Gruppens sparade sökområden i inställningar, femområdesgränsen, radievärdena och
  regeln att alla sparade områden är förvalda.
- Sök-/dedupliceringsmotorn: punkt + gemensam radie. Boundary/polygon = #149.

## 10. Utmaningar mot upplägget

- **Det största problemet är inte ordningen, utan antalet block.** Om vi bara flyttar
  "Sök i" ovanför och behåller fyra block har vi inte gjort dialogen begripligare vid
  360 px. Kollapsa-fältet och inline-radien är därför den viktigaste delen av #148.
- **Grupperad autocomplete kan bli scopekryp.** Om provider-sökningen inte kan leverera
  namnträffar tillräckligt snabbt vid varje tangenttryck bör gruppen `Matställen` fyllas
  från den redan hämtade resultatmängden, inte från en ny provider-anrop-kedja. Det är
  billigare, snabbare och räcker för den upplevda intelligensen.
- **Hoppa över en separat "senaste sökningar"-grupp.** Det låter hjälpsamt men gör
  listan högre och tillför inget för en grupp som redan har sparade områden.
