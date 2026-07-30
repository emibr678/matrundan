## Utgångsläge

Jag har gått igenom Hem, Matställen, matställessida, Gruppen och landningssidan i mobilbredd (390 px) samt läst copy i vyer och dialoger. Ingen horisontell overflow, inga konsolfel. Grunden är stabil och den varma paletten sitter — det som återstår är finputs på tomrum, hierarki, copy-konsekvens och tonfall.

## Vad jag hittade

**1. Faktafel i copy på landningssidan**
Exempelgruppen beskrivs som "ett fiktivt kompisgäng i Stockholm", men all demodata ligger i Göteborg. Första intrycket för en ny familjemedlem blir motsägelsefullt.

**2. Hem känns tom och avslutas abrupt**
Under statistikkortet och de två knapparna tar sidan slut med ett stort tomt fält. Hem är appens hjärta men berättar inget om gruppens liv. Förslag: en varm, kort avslutning — t.ex. "Senast tillsammans"-rad (senaste besöket med plats, deltagare och betyg) som länkar vidare, alternativt ett litet "Kvar att prova"-tips med ett slumpat ställe. Ingen ny datamodell behövs, allt finns i state.

**3. Statistikkortet är kyligt**
"Ställen / Besök / Kvar att prova" är rena siffror utan värme. Förslag: behåll strukturen men gör rubriken mer relationell ("Ni har provat 5 av 9 ställen tillsammans") och ge kortet en mjuk mikrotext under progressbaren när gruppen närmar sig hela listan.

**4. Tomma tillstånd är funktionella men opersonliga**
"Inget nästa stopp valt", "Inga besök än. Bli först i gänget." — bra ansats, men blandad ton mellan vyer. Går igenom samtliga tomma tillstånd (Hem, Matställen, matställessida, Gruppen, filtrerad lista) och ger dem en gemensam, varm och uppmuntrande röst på svenska.

**5. Matställessidan: knapparna dominerar över innehållet**
Tre staplade fullbreddsknappar (Registrera besök / Välj som nästa stopp / Favorit) tar mer plats än stället självt. Förslag: behåll "Registrera besök" som primär fullbredd, gör "Välj som nästa stopp" och "Favorit" till en kompaktare rad bredvid varandra. Frigör utrymme och stärker hierarkin.

**6. Dubblerad "Registrera besök" på matställessidan**
Knappen finns både i huvudkortet och i det tomma besökstillståndet direkt under. Ta bort dubbletten i det tomma tillståndet och låt den rutan bara bära den varma texten.

**7. Matställen: mycket beslutsyta före listan**
Sökfält, topplista med tre tillfällesflikar, fem filterchips, filterknapp och Lista/Karta-växlare — allt före första kortet. Förslag: fäll ihop topplistan till ett kompakt kort som kan expanderas, så att listan börjar högre upp. Ingen funktionalitet tas bort.

**8. Adresstext trunkeras hårt**
"Okänd tvärgata nära centru…" på matställessidan. Låt adressen radbrytas på två rader istället för att klippas mitt i ett ord.

**9. Terminologi och tonfall**
Går igenom hela appen för konsekvent bruk av "gänget"/"gruppen", "tillfälle" (inte "sammanhang"), "ställe"/"matställe" och tilltal (ni/du). Blandningen finns idag mellan vyer och dialoger.

**10. Kärnidén syns svagt i appen efter inloggning**
Landningssidan säljer "gemensam matresa", men inne i appen är den känslan bara implicit. Punkt 2 och 3 ovan är det billigaste sättet att låta idén genomsyra Hem utan att lägga till nya funktioner.

## Vad jag INTE föreslår

- Inga ändringar i datamodell, RPC:er, RLS eller gamification-logik.
- Inga nya funktioner, ingen ny navigation, inga nya beroenden.
- Inga ändringar i demo/live-gränssnittet eller i auth-flödet.

## Teknisk omfattning

Frontend och copy enbart. Berörda filer: `src/routes/index.tsx`, `src/routes/matstallen.tsx`, `src/routes/matstallen.$placeId.tsx`, `src/routes/gruppen.tsx`, `src/components/matrundan/LandingScreen.tsx`, `PlaceCard.tsx`, `GroupHighlights.tsx` samt mindre copy-justeringar i dialoger.

Version bumpas till v1.3.1 med uppdaterad `version.ts`, in-app-historik och `CHANGELOG.md`.

## Verifiering

- `bun run verify:changed` (typecheck, lint, tester)
- Playwright-kontroll i 360 px av Hem, Matställen, matställessida och Gruppen — `scrollWidth <= clientWidth`
- Befintliga e2e-tester (bl.a. `package-6a-ux.spec.ts`) justeras om copy de asserterar ändras
- Publicering sker först efter din uttryckliga godkännande

## Fråga innan jag börjar

Vill du ha hela listan (1–10), eller ska jag hålla mig till copy- och tonfallsdelen (1, 4, 9) och lämna layoutändringarna till efter familjens första testrunda?
