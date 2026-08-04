# Kritisk granskning + rekommenderad plan (Paket H, I, J)

Granskningen bygger på nuvarande kod: `ShellChrome.tsx`/`AuthMenu.tsx` (sidhuvud), `PlaceExternalInfo.tsx` (kortet "Praktiskt", konfliktbanner, "Kontrollera kartdatan", jämförelsedialog), `matstallen.$placeId.tsx` (ordning: huvudkort → Praktiskt → betyg/handlingar → Besök → Om stället med rapportknapp → Betygsdetaljer) och `GroupSettingsSheet.tsx` (undersidan `about` som bara öppnar `AboutDialog`).

## Bedömning

**Paket H – ja, riktningen är bättre.** "Matrundan – Gruppnamn" på samma rad tvingar två långa svenska namn att konkurrera om samma 360 px-rad och gruppnamnet tappar sin roll som *tryckbar kontext*. Gruppnamn under logotypen (nuvarande lösning) är passivt: det ser ut som text, men bytet sker på andra sidan av headern. Att flytta gruppens identitet till knappen kopplar ihop "var är jag" med "byt här", och personens namn behövs inte i headern — det finns i menyn. Risk: knappen blir bred. Lös med `min-w-0` + `truncate` på gruppnamnet, `shrink-0` på emoji och chevron, och maxbredd i steg (`max-w-[8rem] sm:max-w-[12rem] md:max-w-none`). Ingen hård namnbegränsning. I demo/exempel behålls den lilla badgen "demo"/"exempel" i knappen; menyns toppsektion visar då lägesnamnet i stället för e-post.

**Paket I – rätt problem, men två saker bör skärpas.**
- Ta bort "Praktiskt" och det inre kortet: ja. Det är ett kort-i-kort som duplicerar huvudkortets ram och samlar sex olika informationstyper.
- Kompakt utan att bli otydligt: adressen blir länk till Google Maps (tar bort en hel rad), sedan exakt två rader `Webbplats` och `Öppettider` med etikett vänster, värde/åtgärd höger, `min-h-11`, hårfin `divide-y`. Öppettider visar "Öppet nu · till 21" / "Stängt · öppnar 11" som primärtext och hela veckoschemat i en `Collapsible` som är stängd som standard. Badgen "Gruppens uppgift" tas bort ur normalläget — den förklarar inget för en vanlig användare. En diskret ikonknapp (penna, `aria-label="Ändra webbplats och öppettider"`) längst till höger på rubrikraden är hela Ändra-ingången.
- Konfliktcopy: **"Det finns nyare uppgifter om stället"** + knapp **"Jämför"** i en neutral (ej amber) rad. Amber är reserverat för "Kan ha stängt permanent"; en normal faktaavvikelse ska inte larma. Jämförelsedialogen visar per berört fält två block: **"Nuvarande (gruppens)"** och **"Nya uppgifter"** med faktiska värden, inklusive fullt veckoschema för öppettider — inte dagens hänvisning "visa respektive schema på detaljsidan". Val: **"Behåll nuvarande"** / **"Använd de nya uppgifterna"**. Fältvis val bör undvikas i denna iteration; ett beslut per konflikt räcker och `applyMapDataForConflicts()` gör redan detta korrekt per fält.
- Ändringsmetadata och "Kontrollera kartdatan" försvinner från normalläget. Metadatan flyttas in i redigeringsdialogen (den hör till "vem satte detta"), och manuell hämtning blir "Sök efter ny information" under **Fler alternativ** i samma dialog.
- Rapportlänken längst ned: rätt nivå. En dämpad textknapp "Rapportera felaktig information" efter Betygsdetaljer, all förklaring inne i dialogen, ingen accordion. Risk att den blir svårfunnen är acceptabel — det är ett undantagsflöde och den finns även i sökflödets "Stängt eller fel uppgifter?".
- Ordningen i punkt 9 stämmer med koden så nära att bara Praktiskt-blocket och rapportåtgärden behöver flytta.

**Paket J – ja.** Undersida som bara innehåller ett kort som öppnar en dialog är ett rent dubbelsteg. Brytt ut innehållet ur `AboutDialog` till `AboutContent` och rendera det både på undersidan och (om dialogen behålls någon annanstans, t.ex. LandingScreen) i dialogen.

## Risker och edge cases

- Header: grupp saknas/onboarding och utloggat läge — knappen måste falla tillbaka till "Logga in" respektive "Demo"/"Exempel" som idag.
- Arkiverad grupp: "· Arkiverad" försvinner från logotypraden; visa i stället en liten arkiv-ikon i knappen samt fortsatt banner i main.
- Skärmläsare: knappens `aria-label` bör vara "Profil och grupp: {gruppnamn}" eftersom synlig text nu är gruppens namn.
- Platsdetalj: fall utan Geoapify-källa, manuellt tillagda ställen, demo/exempel (read-only), laddningsläge för öppettider och `practicalInfoError` måste alla ge en lugn tom rad ("Saknas"), aldrig ett halvt kort.
- Öppettider utan tidszon: behåll nuvarande fallback, visa hela schemat utan "Öppet nu"-rad.
- Jämförelse: extern data kan hämtas efter render; dölj signalen tills `details` finns.

## Minsta sammanhängande scope

1. `ShellChrome.tsx` + `AuthMenu.tsx`: flytta gruppkontexten till knappen, ta bort gruppnamnet under logotypen, identitet överst i menyn.
2. `PlaceExternalInfo.tsx`: ta bort rubrik/kort/metadata/refresh, adress som Maps-länk (delvis i `matstallen.$placeId.tsx`), två rader + kollapsat schema, neutral konfliktsignal, utbyggd jämförelsedialog.
3. `PlacePracticalInfoDialog.tsx`: metadata + "Fler alternativ" med "Sök efter ny information"; "Hur vet du det?" visas villkorligt.
4. `matstallen.$placeId.tsx`: rapportåtgärd ut ur "Om stället" till botten.
5. `AboutDialog.tsx` → `AboutContent` + `GroupSettingsSheet.tsx` renderar innehållet direkt.
6. Versionsbump (v1.25.0), CHANGELOG, in-app historik; verifiering vid 360 px och `bun run verify:agent`.

Ingen migration, inga RPC-ändringar, ingen ändring av revisionshistorik eller käll-/observationskrav i datamodellen. Ingen publicering.
