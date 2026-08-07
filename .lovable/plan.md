# Issue #108 – rätt scope: två parallella platsdetaljer

Missförståndet: den visuella samordningen gjordes mellan **söklistan** och sparade platskort. Rätt par är i stället:

1. **Förhandsdetaljen** ("Lägg till i gruppen") för en kandidat som ännu inte finns i gruppen — `AddPlaceResultDialogsV16.tsx` (`PendingPlaceSummary`).
2. **Detaljsidan** för ett redan tillagt ställe — `src/routes/matstallen.$placeId.tsx` med `PlacePracticalInfoPanel`.

Söklistan (`SearchResultSectionsV16.tsx`) ska tillbaka till sin tidigare kompakta form.

## Steg 1 – Återställ söklistan

Commit `9d7e5de` ("Samordna platskandidaternas visuella språk") är den felaktiga breddningen. Den ska rullas tillbaka i `SearchResultSectionsV16.tsx`, alltså tillbaka till:

- `flex`-rad med `rounded-xl`, emoji-ruta 40×40 (`emojiForCategory`) i stället för `PlaceIdentityMark`;
- namn i `font-medium` (inte `font-display text-base font-semibold`);
- plats/adress som enkla `[11px]`-rader utan `MapPin`-ikon och utan `pl-4`-indrag;
- **ingen** webbplats-/öppettidsrad i listan;
- åtgärdsknappen `shrink-0` till höger, inte `w-full`; bulk-kryssrutan `absolute right-2 top-2`.

Ingen ändring av sök-, dedup- eller providerlogik. Endast presentationen i den filen.

## Steg 2 – Delade visuella primitiver mellan de två detaljerna

Målet är igenkänning, inte samma innehåll. Följande ska vara identiskt:

| Primitiv | Gemensam regel |
| --- | --- |
| Identitetsblock | Samma grid `[4rem_minmax(0,1fr)]` (`min-[390px]:[5rem_…]`), `PlaceIdentityMark size="detail"`, kategori som `[11px]` tracking-rad **över** namnet, namn i `font-display text-2xl` |
| Yta | `rounded-3xl` kort, `bg-gradient-to-br from-secondary to-secondary/40`, `p-4 sm:p-5` |
| Praktiska rader | Samma ikonrytm och `min-h-11`-rader: adress (📍), webbplats (`Globe2`), öppettider (`Clock3`), via `PlaceExternalLink` med samma `text-sm font-medium text-primary` |
| Sektionsrytm | `space-y-5` mellan block, avdelare `border-t border-border/60`, tunn bakgrundsväxling `bg-background/60` för sekundära block |
| Typografi | Rubriker `font-display`, metadata `text-xs text-muted-foreground`, brödtext `text-sm` |
| Tryckyta | Allt interaktivt minst 44 px, ingen horisontell overflow vid 360 px |

Konkret i förhandsdialogen: `PendingPlaceSummary` byter från `flex` + 44 px emoji-ruta + `font-medium`-namn till samma identitetsgrid, `PlaceIdentityMark` och kategori-över-namn som detaljsidan, och adressen blir en egen ikonrad i stället för en sammanslagen `address · area · city`-textrad.

## Steg 3 – Vad som medvetet ska skilja

- **Ingen "Föreslå som nästa stopp"** och inget "Registrera besök" i förhandsdialogen. Första beslutet är bara *om* stället ska in i gruppen.
- Ingen favorithjärta-knapp, inga besöks-/betygsaggregat, ingen "Senast tillsammans"-rad — de existerar inte för en kandidat.
- Öppettider/webbplats visas i förhandsdialogen som **läsbar status utan redigering** (ingen "Lägg till webbplats"-dialog, ingen kartdatakontroll). Redigering hör till ett tillagt ställe.
- Förhandsdialogen behåller sina egna fält: kök/inriktning, tillfällen, gruppanteckning, dölj-förslag och rapportera-fel.
- Primär åtgärd i dialogen är **"Lägg till i gruppen"** i `DialogFooter`, aldrig i innehållsflödet.

## Steg 4 – Riskabla val i nuvarande förhandsskärm

1. **Google Maps-länken sitter jämbördigt med webbplatsen.** Två `ExternalLink`-länkar på samma rad läses som två likvärdiga erbjudanden, och Maps är det som klickas av misstag. Förslag: adressen blir Maps-länken (samma mönster som detaljsidan) och den separata "Google Maps"-länken tas bort.
2. **"Begränsad platsinformation" ligger inline bland länkarna.** En kvalitetsvarning blandad med handlingar sänker båda. Den bör ligga som egen neutral metadatarad under de praktiska raderna, inte i länkflödet.
3. **Rapportera-fel-sektionen (`PlaceSuggestionSignalPanel`) ligger högt upp, direkt under identiteten.** Det gör "något kan vara fel" till det andra man läser innan man ens bestämt sig. Den bör flyttas ned som sista, diskreta blocket – gärna som en ghost-rad ("Fel uppgifter?") som fäller ut, inte ett alltid synligt panelkort.
4. **Fyra formulärblock i rad utan hierarki** (kök, tillfällen, anteckning, rapport) gör dialogen tung vid 360 px. Förslag: kök + tillfällen + anteckning samlas under en enda tydlig etikett i stil med "Lägg till för gruppen (valfritt)", visuellt avskilt från kandidatidentiteten med en `border-t`.
5. **Två olika emoji-källor.** Dialogen använder `emojiForCategory`, detaljsidan `PlaceIdentityMark`/`PlaceThumb`. Dialogen ska använda samma komponent — ingen ändring av den automatiska symbolupplösningen, bara av vilken komponent som renderar.
6. **`ExternalLink`-ikon i storlek 3.5 vs 4** och `underline-offset` istället för `hover:underline` i `PlaceExternalLink` — små inkonsekvenser som gör att raderna inte känns som samma system.

## Minimal ändringsmängd

Endast frontend/presentation:

- `src/components/matrundan/SearchResultSectionsV16.tsx` — återställ till formen före `9d7e5de`.
- `src/components/matrundan/AddPlaceResultDialogsV16.tsx` — bygg om `PendingPlaceSummary` till delat identitetsblock + praktiska rader; flytta signal-/rapportpanelen sist; gruppera de valfria fälten.
- Ev. ny liten presentationskomponent (t.ex. `PlaceIdentityHeader`) som både detaljsidan och dialogen använder, så primitiverna delas i kod och inte bara visuellt.
- Uppdatera berörda e2e-assertions (`tests/e2e/v1-16-3-add-place-return.spec.ts`, `mobile-search-hygiene.spec.ts`, `package-6a-ux.spec.ts`) om selektorer flyttas.

Inga ändringar i DB, RPC, sök/dedup/provider, symbolupplösning, navigation, version, changelog eller migrationer. Ingen publicering.

## Öppen fråga

Ska adressen i förhandsdialogen vara klickbar (Maps) redan innan stället är tillagt, eller ren text för att hålla dialogen fri från utgående klick? Jag rekommenderar klickbar, eftersom det är det man behöver för att avgöra om stället är rätt.
