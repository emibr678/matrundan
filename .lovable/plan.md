
# UX- och produktgranskning av Matrundan – rådgivande analys

Basen är en inspektion av de faktiska filerna i repot: `src/routes/index.tsx`, `src/routes/matstallen.tsx`, `src/routes/matstallen.$placeId.tsx`, `src/routes/gruppen.tsx`, `src/components/matrundan/AppShell.tsx`, `ShellChrome.tsx`, `PlaceCard.tsx`, `NextStopDateCard.tsx`, `VisitDialog.tsx`, `VisitDetailSheet.tsx`, `GroupHighlights.tsx` och `AddPlaceDialogImpl.tsx`. Ingenting nedan bygger på tidigare chatt-diskussion. Inga kod- eller filändringar föreslås eller görs.

---

## A. Nulägesanalys

### A1. Mental modell som appen faktiskt kommunicerar

Rambilden (`ShellChrome`) etablerar tre flikar: **Hem**, **Matställen**, **Gruppen**. Logotyp och avatar/AuthMenu överst. Det är en klassisk konsument-app-struktur som lovar: "en handlingsvy, en katalogvy, en socialvy". Det stämmer med produktkärnan – men mikroinnehållet drar åt andra håll:

- Hem säger "Nästa stopp" (`Sparkles`, "Nästa stopp") + framstegsmätare + genvägar + "Senaste aktivitet". Alltså både beslut, statistik och feed.
- Matställen säger "Sök, filtrera, topplista, karta". Alltså katalog.
- Gruppen säger "Nästa stopp igen, Gänget, Gänget gillar, Höjdpunkter (topplista), Aktivitet". Alltså socialt + gamification + duplicerat nästa stopp.

Konsekvensen: "Nästa stopp", "Aktivitet" och "Favoriter" finns på minst två flikar; ingen fråga tillhör tydligt en enda vy.

### A2. Vy-för-vy-genomgång

**Hem (`src/routes/index.tsx`)**
- *Tror användaren:* "Vad ska vi göra härnäst?" – snabbaste vägen till nästa stopp och att registrera besök.
- *Fungerar:* Det stora primärkortet med `next.photo`, kategori, adress, "Föreslaget av X" är starkt och läsvänligt. Primärknappen `Registrera besök` (h-12, full bredd) är rätt storlek. Slumpa-chippen längst upp är trevlig som lekfullt komplement.
- *Skapar brus:* Kortet innehåller nu **tre olika grafiska block**: färgat hero, `NextStopDateCard` (egen sektion med tabbar/kollapsibel svarslista), och CTA-knapp. Direkt under följer en **"Progress-kort"** med 3 numeriska rutor + procent, sedan **två outline-knappar** (Lägg till/Bläddra) och sist **Aktivitetskort med 5 rader**. Sidan har fyra separata kort och totalt ca 8–10 diskreta ytor på en 360 px-mobil. Sparkles-ikonen används både i eyebrow *och* som ikon inuti Gruppen-fliken – den blir semantiskt otydlig (dekor vs. status).
- *Visuellt primär idag:* Hero-kortet + `Registrera besök`. Rätt.
- *Borde vara primär enligt kärnan:* Precis det. Men datumförslaget stjäl visuellt eftersom det ligger som en egen sektion i samma kort med tabellknappar och sifferbadges, vilket gör att `Registrera besök` glider ner ur "första skärmens" fokusområde vid 360 px.

**Matställen-listan (`src/routes/matstallen.tsx`)**
- *Tror användaren:* "Gruppens lista över ställen vi vill/har provat." H1 säger "Matställen" – neutralt men lite katalogigt.
- *Fungerar:* Sök + Quick-filters + Filter-sheet är en välkänd och skalbar modell. `PlaceCard` med thumb/rating/status/adress är stabil. Toggle Lista/Karta är begriplig.
- *Skapar brus:* En **Topplista på 1–3 ställen** ligger *ovanför* både sökfältet och den egentliga listan; den kan tävla med användarens faktiska intention (bläddra allt). Filterchipsen "Alla / Favoriter / Nytt för mig / Nytt för gruppen" är fyra parallella lägen som inte är ömsesidigt uteslutande i användarens huvud ("Nytt för mig" som statusetikett låter som filtrering, men *inkluderar* även "Nytt för gruppen" – icke uppenbart). `StatusBadge` + rating-siffra + kök-tags + adress + hjärta hamnar tätt inpå varandra – kortet fungerar men saknar tydlig visuell hierarki mellan primär info (namn, status) och sekundär (kök, adress). H1 = "Matställen" utan "gruppens" kvalificerare gör att copyn inte förstärker att listan är gruppens gemensamma.
- *Primär idag:* `Lägg till`-knappen (rundad pill, uppe till höger).
- *Borde vara primär:* Att hitta ett specifikt ställe eller filtrera till nästa stopp-kandidater. "Lägg till" är rätt att ha nära, men den nuvarande topplistan konkurrerar mer än den hjälper.

**Matställe-detalj (`src/routes/matstallen.$placeId.tsx`)**
- *Tror användaren:* "Vad är detta för ställe och vad har gänget tyckt? Kan jag registrera ett besök här eller markera som nästa?"
- *Fungerar:* Hero med thumb + kategori + adress + status är tydligt. `Registrera besök` (h-12, full bredd) är rätt primär. Sektionerna "Om stället", "Betygsdetaljer", "Besök (N)" följer en läsbar berättelsestruktur.
- *Skapar brus:* Under primärknappen ligger **tre likadana outline-knappar i rad**: `Sparkles Nästa`, `Heart Spara`, `ExternalLink Maps`. På 360 px försvinner ordet "Nästa stopp" (tredje raden `sm:hidden` visar bara "Nästa"). Ordet "Nästa" utan sammanhang är otydligt: knapp mot handling? länk mot nästa besök? På toggeltillstånd byts texten till "Är nästa" – ett tillstånd, inte en handling – vilket blandar knappspråk (verb) med statusspråk (adjektiv). "Spara"/"Sparad" har samma problem: det är faktiskt en personlig favorit, inte en generisk save. `ExternalLink → Maps` som lika stor knapp som "Nästa" och "Spara" ger felaktig viktning – Maps är en flykt ur produkten, inte ett gruppbeslut.
- *Primär idag:* `Registrera besök` (bra) + tre likvärdiga sekundärknappar (för mycket lika).
- *Borde vara primär:* Registrera besök. Näst viktigast: markera som nästa stopp för gruppen. Favorit/Maps är tertiärt.

**Gruppen (`src/routes/gruppen.tsx`)**
- *Tror användaren:* "Vilka är vi, vad har vi gjort tillsammans, vad snackar vi om nu?"
- *Fungerar:* Grupphero med emoji/namn/medlemsantal är en fin identitetsmarkör. Medlemslistan med `MemberAvatar` + roll + "Senast på…" ger relation. Aktivitetskortet ger puls.
- *Skapar brus:* Här ligger *igen* ett "Nästa stopp"-kort (rad 149–167) direkt efter hero – exakt samma information som på Hem, men mindre. Det tar bort en unik uppgift från fliken. Därefter **"Gänget"**, sen **"Gruppens höjdpunkter"** (topplista med två tab-rader × 3 kategorier + milstolpe-chips), sen **"Gänget gillar"** (delade favoriter), sen **"Aktivitet"**. Fem sektioner + inställnings-sheet med ytterligare fem underrubriker (Gruppinställningar, Medlemmar & roller, Bjud in, Lämna, Om appen). Sidan är i praktiken en dashboard, inte en identitetsvy. `GroupHighlights` blandar två tab-rader ("visits/newPlaces/breadth" × "I år/Totalt") – kognitiv belastning för en sekundär funktion. Rollen visas som badge (`Du`, `admin`) *och* som text under namnet ("medlem"), vilket ger dubbel information.
- *Primär idag:* Ingen tydlig – ögat vandrar mellan gruppens namn, nästa stopp-kortet och första medlemsraden.
- *Borde vara primär:* "Gänget" som identitet – vem gruppen består av och gruppens gemensamma minnen. Datum, planering och beslut hör hemma på Hem.

**Registrera besök (`VisitDialog.tsx`)**
- *Tror användaren:* "Snabbt logga att vi var här."
- *Fungerar:* Datum + tillfälle + deltagarchips + helhetsbetyg + kollapsbart detaljbetyg + foto + kommentar är en välavvägd progressiv disclosure. Deltagarväljaren som badges är rätt mönster.
- *Skapar brus:* Standardvärden pushar användaren: "middag" är förvalt, `overall=4` är förvalt. Att ha ett förvalt betyg tenderar att skapa systematiskt högt snitt – produktrisk, inte bara UX. `Spara och lägg till i annan grupp` som sekundärknapp bredvid `Spara besök` är en avancerad handling som få kommer förstå på registreringsögonblicket ("varför skulle jag *nu* lägga till i annan grupp?"). Den skulle passa bättre efter sparning.

**Lägg till matställe (`AddPlaceDialogImpl.tsx`)**
- *Tror användaren:* "Jag vill lägga in ett ställe vi hört talas om."
- *Fungerar:* Tab-struktur "Sök" / "Manuell", debounced Geoapify-sökning, karta/lista-toggle, statusetiketter "Tillagd/Finns redan/Kan läggas tillbaka", radie-chips. Tydligt bekräftelseflöde med kök/tillfällen/anteckningar.
- *Skapar brus:* Dialogen är en fullfjädrad app-i-appen (>1000 rader). På 360 px konkurrerar sökfält, plats-input, radiechips, resultat-toggle, resultatlista och foot-actions om utrymmet i en modal. Manuellt-fliken kräver mycket fält (namn, kategori, kök, adress, område, stad, tillfälle, anteckningar, emoji) – det är fler fält än vad snabb-registrering brukar tåla. Emoji som "photo" i manuell blandar dekoration med data.

### A3. Fem största UX-problem, rangordnade efter påverkan

1. **Duplicering av "Nästa stopp" mellan Hem och Gruppen** löser upp informationsarkitekturen. Ingen vy äger något ensamt – "vart går jag?" blir en gissning. Diagnos: fel informationsarkitektur.
2. **Hem-vyn är visuellt platt** – hero + datumkort + progress + två knappar + aktivitet ligger som lika viktiga block, ofta som "kort-i-kort". Primäråtgärden `Registrera besök` hamnar en scroll bort på 360 px. Diagnos: bristande visuell hierarki + bristande progressiv visning.
3. **Detaljsidans tre outline-knappar ("Nästa/Spara/Maps") viktas lika** och deras copy är otydlig ("Nästa", "Spara"), särskilt vid 360 px där texten trunkeras. Nästa stopp är ett gruppbeslut, favorit är personlig, Maps är ett externt hopp – att visa dem som semantiskt jämlika är förvirrande. Diagnos: copy + visuell hierarki + felaktig informationsarkitektur (blandar personligt/gruppgemensamt/externt).
4. **Gruppen-fliken är en dashboard, inte en gruppidentitetsvy.** Fem tunga sektioner + sheet med fem till gör att vardaglig användning (bara vilja se gänget/aktivitet) blir mödosam. Diagnos: för många parallella funktioner utan tydlig hierarki.
5. **Ordvalen blandar personligt och gruppgemensamt.** "Spara/Sparad" (favorit), "Nästa" (gruppens val), "Matställen" (gruppens lista), "Höjdpunkter" (gamification). Ingen konsekvent språklig markör talar om vem något gäller. Diagnos: copy.

**Huvudsaklig diagnos:** Informationsarkitektur och visuell hierarki är rotorsaken. Det finns inte för många funktioner; de är fel *placerade* och saknar visuell prioritering. Copy är förstärkande men inte primär orsak.

---

## B. Visuell och språklig riktning

### B1. Visuellt system

**Vad som redan finns:** paletten `sage`, `mustard`, `secondary`, `primary` (terrakotta-ton) används genomgående; gradienter används på hero (Hem), grupp-hero (`from-sage/50 to-secondary`), detalj-hero (`from-secondary to-secondary/40`) och `CATEGORY_GRADIENT` för thumbnails. `font-display` mot brödtext ger tydlig hierarki. Kort använder `rounded-2xl`/`rounded-3xl` konsekvent. `paper-grain`-bakgrund på shell.

**Bedömning:** riktningen "varm, jordnära, gemensam måltidskänsla" fungerar väl för produktlöftet och behöver inte kastas. Terrakotta som primär är korrekt för handlingsknappar; salvia funkar som lugn identitet i grupphero; senap är en trevlig accent för "kvar att prova" och tillfällen. Problemet är inte färgvalen utan att **för många ytor ropar samtidigt**: gradienter på gruppheros + primärgradient på nästa-stopp-hero + gradient på thumbnails + färgade `Progress`/badges + mustard-status-tiles gör att inget vilar.

**Konkreta användningsregler att rekommendera (behåll paletten):**

- *En primär färgyta per vy.* Terrakotta-gradienten reserveras för det som är dagens handlingsobjekt (Nästa stopp-hero på Hem, detaljhero på matställe). Ingen annan yta får använda samma gradientvikt på samma skärm.
- *Salvia = grupp/identitet, inte status.* Grupphero, medlemssektioner. Aldrig knappar eller CTA.
- *Senap = "kvar att göra"/upptäckt.* Statusbrickor "Nytt för gruppen/mig", "Kvar att prova"-siffra. Inte hero-gradienter.
- *Neutral bas dominerar.* `bg-card` + tunn `border-border/70`-linje är default; färg tillförs bara för semantisk signal.
- *En kortnivå per sektion.* Skippa `Card>Card`. Det förekommer på Hem (progresskort med interna tiles), på Gruppen (`Card` med `Card`-liknande divider-rader), i AddPlace (dialog=modalkort som innehåller resultatkort). Nested surfaces urholkar visuell rytm.
- *Badges är sällsynta.* En medlemsrad har idag potentiellt: `Du`-badge, rollbadge, samt rolltext i lower row. Välj en. Reservera badges för semantisk avvikelse (arkiverad, delad, tidigare medlem, utanför progression). Inte för identitet ("Du").
- *Ikoner ska ha ett jobb.* `Sparkles` används för både dekor och "nästa stopp" – välj en betydelse. `Heart` är entydig (favorit) och kan behållas.
- *Typografi:* `font-display` bör användas *endast* för objektnamn och skärmrubriker H1/H2, inte för siffror i statistik-tiles (där den nu förekommer). Siffror bör vara tabular via monospace-siffror eller vanlig `font-medium`.

Det finns inget skäl att införa Inter/Poppins/lila-gradient-generisk look. Behåll den varma karaktären och skärp ovanstående regler.

### B2. Språkliga rekommendationer per sammanhang

Nuvarande copy är blandad. Konkreta rekommendationer:

| Sammanhang | Nuvarande | Rekommenderat |
|---|---|---|
| Fliken/H1 för gruppens lista | "Matställen" | Behåll "Matställen" som fliknamn (kort, 360 px-vänligt); tydliggör via subrubrik: "Vad gänget vill prova och har provat" |
| Handling: lägga till ett ställe i gruppens lista | "Lägg till" / "Lägg till matställe" | "Lägg till ställe" (kort, entydig); i tom-lista: "Lägg till ert första ställe" |
| Personlig markering | `Spara` / `Sparad` (hjärt-ikon) | "Favorit" (ikon-toggle utan textetikett på små ytor; aria: "Markera som favorit" / "Ta bort favorit"). På detaljvyn: `♡ Favorit` / `♥ Favorit` – tillstånd bör inte byta ord, bara ikonfyllning. |
| Gruppens val av kommande ställe – knapp | "Nästa" (mobil) / "Nästa stopp" (desktop) / "Är nästa" (aktivt) | Handling: "Välj som nästa stopp". Aktivt tillstånd: liten badge "Nästa stopp" på kortet, inte ett byte av knapptext. Toggling = separat "Ta bort som nästa stopp"-handling i overflow eller confirm. |
| Nästa-stopp-eyebrow på Hem | `Sparkles` + "Nästa stopp" | Behåll texten. Byt `Sparkles` till en tydligare gruppsymbol (flagga eller pin). Sparkles bör försvinna från grupplistan. |
| Datumförslag – vilotillstånd | "Föreslå datum" | Behåll. |
| Datumförslag – aktivt | "Datumförslag" + tre knappar + siffror | Kompakt rad: "Föreslaget: fre 8 aug · 3 passar" (öppnar bottom sheet med svar/åtgärder). |
| Datumförslag – bekräftat | "Planerat till fredag 8 augusti" + Badge "Bekräftat" | Bra – kortas till "Bokat: fre 8 aug 19:00". Inga svarsknappar när bekräftat. |
| Registrera besök | "Registrera besök" | Bra. Behåll. |
| Delning | "Spara och lägg till i annan grupp" | Efter sparning: toast med sekundär åtgärd "Lägg till i en annan grupp?". Inte som parallellknapp i registreringsdialogen. |
| Historik/vy | "Besök (N)" | Bra. |
| Gamification-sektion | "Gruppens höjdpunkter" | Behåll – det är vackert och avdramatiserar. Undvik ordet "leaderboard/topplista" i UI. |
| Rollbadge | `admin` / `medlem` visas som badge + text | Visa bara badge om rollen är `ägare` eller `admin`. `medlem` är default – ingen etikett. |

Alla knapptexter ovan ryms i 360 px utan trunkering (testat mot befintlig `min-h-11`-mönster).

---

## C. Prövning av tidigare hypoteser

- **Varm, ljus, neutral bas med terrakotta primär, salvia bekräftad status, senap höjdpunkter:** *Behåll paletten, ändra användningsreglerna.* Salvia bör vara identitetsfärg (grupp) snarare än enbart bekräftad status. "Bekräftat"-tillstånd (t.ex. datum) kan bära salvia som **tunn border/bakgrundston**, inte som primärgradient.
- **Färre färgade ytor, mindre kort-i-kort, färre badges, en tydlig huvudhandling per vy:** *Behåll – och prioritera detta högt.* Detta är den enskilt största hävstången i appen just nu. Se A3-punkt 2 och 4.
- **Behåll huvudfliken "Matställen", copy "Lägg till i listan":** *Delvis behåll.* Behåll fliknamnet. Undvik "Lägg till i listan" som knapp – "listan" är abstrakt. Använd "Lägg till ställe" och kvalificera fliken med subrubrik istället.
- **Byt "Spara" till "Favorit"/"Min favorit" som hjärttoggle:** *Behåll.* Termen "Spara" är den mest missledande enskilda etiketten i appen.
- **Byt "Nästa" + gnista mot "Nästa stopp" med tydlig ikon (flagga):** *Behåll principen, ändra utförandet.* Ikonen bör signalera *gruppens val* snarare än "kul/nytt" (gnistan). En flagga eller pin funkar. Viktigast: separera handlingen ("Välj som nästa stopp") från tillståndet ("Nästa stopp" som statiskt badge på kortet). Ha inte en toggle-knapp som byter text mellan verb och adjektiv.
- **Hem äger nästa stopp, Gruppen antingen kompakt sammanfattning eller inget:** *Rekommendation: ta bort helt från Gruppen.* Kompakt sammanfattning är en halvmesyr som återinför duplicering och urholkar Gruppen som identitetsvy. Om det finns oro för att en användare "landar" på Gruppen och missar dagens beslut – lös det via bottom-nav-badge på Hem-fliken (t.ex. liten prick när nytt datumförslag väntar på svar), inte via duplicerat innehåll.
- **Kompakt datumplanering på Hem + bottom sheet för svar/åtgärder:** *Behåll starkt.* `NextStopDateCard` är i dag ~100 px hög med tre svarsknappar, respons-siffror, expander och två managementknappar – för mycket. En rad med primärstatus + "Se svar/planering" som öppnar sheet är rätt.
- **Datumtillstånd inget/aktivt/bekräftat, nollvärden dominerar inte Hem:** *Behåll.* Om det inte finns förslag ska "Föreslå datum" vara en *diskret* rad, inte ett tomt kort. "Ta bort förslaget" bör aldrig ligga öppet på Hem.

---

## D. Syntes, informationsarkitektur och prioritering

### D1. Där jag håller med / inte håller med / vad som saknats

- **Håller med:** kompakt datum, favorit-terminologi, "Nästa stopp"-språk, färre parallella ytor.
- **Håller inte med:** att bara "flytta" innehåll mellan Hem och Gruppen räcker. Om delar av Gruppen (nästa stopp, aktivitet) inte flyttas *bort* utan bara *skalas ner* överlever duplicerings-problemet.
- **Missat i tidigare diskussion:** (a) `Matställen`-listans **topplista ovanför sökfältet** är en egen konkurrens som ingen adresserat – den bör flyttas till Gruppen eller integreras i "Sortera efter betyg"; (b) **default-betyg 4** i `VisitDialog` är en produktrisk för snittkvaliteten; (c) `Aktivitet` finns både på Hem (5 rader) och på Gruppen (10 rader) och bör ligga endast på ett ställe – argumenten talar för Gruppen; (d) `ExternalLink → Maps` som primärnivåknapp på detaljsidan lockar bort användaren från produkten; (e) den stora **inställnings-sheeten** på Gruppen blandar gruppinställningar, medlemshantering, inbjudningar, lämna-grupp, demo och "Om appen" i ett scroll-fönster – det är ett eget informationsarkitektur-problem.

### D2. Målbild för informationsarkitektur

- **Hem** = "Vad gör vi härnäst?" Innehåller: nästa stopp (hero + kompakt planering-rad + registrera besök). Ingenting annat. Ingen aktivitet, ingen progress-panel, inga genvägar till "Lägg till" (den bor i Matställen och i tom-tillstånd på Hem).
- **Matställen** = "Gruppens lista över ställen." Innehåller: sök, filter, lista/karta, "Lägg till ställe". Topplista tas bort härifrån.
- **Gruppen** = "Vilka är vi och vad har vi gjort tillsammans?" Innehåller: identitet (hero + medlemmar), aktivitet, gänget-gillar, höjdpunkter (nedtonad), inställningar. Inget nästa stopp.
- **Detaljsidan** = "Ett ställe och vad vi tycker om det." Primär: Registrera besök. Sekundär (mindre vikt): favorit-toggle + "Välj som nästa stopp". Tertiär (textlänk eller ikon-knapp): Öppna i Maps.
- **Inställnings-sheeten** bör delas i två: `Gruppen` (namn, emoji, sökområde, delade besök) + `Medlemmar & inbjudningar` som två separata sheets/rutor.

### D3. Prioriterade rekommendationer

**P0 – hög tydlighetsvinst, låg risk**
- *Copy:* Byt "Spara/Sparad" → "Favorit" (hjärt-toggle, ikon räcker på små ytor). Byt knapptexten "Nästa/Är nästa" på detaljsidan till en handling "Välj som nästa stopp"; visa aktivt tillstånd som en badge på kortet snarare än på knappen. Ta bort duplikat-etikett `medlem` och `Du`-badge.
- *Visuell hierarki:* Nedgradera detaljsidans "Nästa/Favorit/Maps"-triplet – gör Maps till en textlänk eller en ikonknapp i headern, inte en tredjedel av knappraden. Ta bort `Sparkles`-eyebrow på Hem eller ersätt med en pin/flagga.
- *IA (låg risk):* Ta bort "Nästa stopp"-kortet från `src/routes/gruppen.tsx`. Ta bort "Topplista" från toppen av `matstallen.tsx` och lämna sorteringen "Högst medelbetyg" i filtret. Ta bort "Senaste aktivitet" från Hem.

**P1 – informationsarkitektur och interaktion**
- Kompaktisera `NextStopDateCard` till en enda rad + bottom sheet. Reservera "Ta bort förslaget" till sheeten.
- Flytta "Spara och lägg till i annan grupp" från `VisitDialog` till en toast/efter-spar-åtgärd.
- Ändra default-`overall`-betyg i registreringsdialogen från 4 till 0 (tvinga aktivt val) – produkt-/data-fråga, se D4.
- Skala `GroupHighlights` till ett läge (endast "I år" som default) och en kategori-selector; behåll milstolpar.

**P2 – funktionell/strukturell justering**
- Dela `SettingsSheet` i två separata sheets med tydliga syften.
- Introducera diskret notifieringsprick i bottom-nav när ett datumförslag väntar på användarens svar, som ersättning för dublett-innehåll på Gruppen.
- Se över `AddPlaceDialogImpl`s manuella-flik för att minska antal fält (t.ex. gömma `area`, `photo`, `notes` bakom "Fler detaljer").

### D4. Litet första design-/språkpaket (P0)

**Ytor som ingår:**
- `src/routes/index.tsx` (Hem): ta bort "Senaste aktivitet"-sektionen; nedgradera `Sparkles`-eyebrow.
- `src/routes/matstallen.$placeId.tsx`: skriv om triplet-knapparna. Primärt kvarstår `Registrera besök`. Sekundärt en enda tydlig knapp "Välj som nästa stopp" (eller badge om redan valt). `Favorit` som ikon-toggle i header eller ovanpå hero (som PlaceCard redan har). Maps som textlänk under adressen ("Öppna i Maps").
- `src/routes/matstallen.tsx`: ta bort "Topplista"-sektionen; behåll sortering "Högst medelbetyg" i filtret.
- `src/routes/gruppen.tsx`: ta bort duplicerat "Nästa stopp"-kort.
- `src/components/matrundan/PlaceCard.tsx` + detalj: `aria-label` "Markera som favorit / Ta bort favorit"; ingen textetikett "Sparad".

**Ytor som uttryckligen lämnas orörda i P0:**
- `NextStopDateCard` (större omarbetning hör till P1).
- `VisitDialog` (default-betyg är en produkt-fråga, se nedan).
- `AddPlaceDialogImpl`.
- Alla databas-, RPC-, RLS-, gamification- och Geoapify-lager.
- Färgtoken i `src/styles.css`.

**Acceptanskriterier (verifierbara):**
1. Hem på 360 px visar hero + `Registrera besök`-knapp helt inom första vyhöjden i typisk iPhone/Android-simulering (t.ex. iPhone 12 viewport 390×844 räknas som pass om primärknapp syns utan scroll; på 360×640 accepteras max en halv skärm scroll för att nå knappen).
2. Detaljsidan har exakt en primärknapp och maximalt två sekundära (favorit + nästa stopp). Maps är inte en primär/sekundär knapp.
3. Matställen-listan visar sökfältet innan någon annan sektion.
4. Gruppen-fliken innehåller inte ordet "Nästa stopp" som egen sektion.
5. Inga ord "Sparad"/"Spara" används för favoritfunktionen i UI (grep-check).
6. Konsolen är fri från nya varningar; existerande tester passerar (`bun run typecheck` + `bun run test`).

**Användarverifiering:** ett kort test med 3–5 personer på 360 px-mobil där man ber dem: (a) "visa vart ni ska härnäst", (b) "spara ett ställe som personlig favorit", (c) "föreslå att gruppen provar Il Forno". Mät om primärhandlingen hittas inom 5 sekunder utan att användaren scrollar mer än en skärmhöjd.

### D5. Frågor produktägaren behöver besluta

1. **Ska Gruppen-fliken ha noll referens till "nästa stopp", eller behöver den en diskret "väntar på ditt svar"-notis?** Olika svar leder till olika interaktionsmönster (bottom-nav-badge vs. inbäddad rad).
2. **Ska favorit vara personlig (som idag) eller gruppgemensam ("gänget-favorit")?** Konsekvens: en hjärt-toggle vs. två separata koncept (personligt hjärta + gruppens topplista i `Gänget gillar`).
3. **Ska "Nästa stopp" vara ett gruppbeslut som kräver samtycke (röstning) eller kan vem som helst sätta det ensam?** Idag kan vem som helst sätta det. Om produkten ska mogna mot samtycke förändras hela knapp-språket ("Föreslå som nästa stopp" vs. "Välj som nästa stopp").
4. **Ska helhetsbetyget i `VisitDialog` ha ett förvalt värde (4) eller kräva aktivt val?** Påverkar datakvalitet och därmed hela ratings-berättelsen.
5. **Ska topplistor och nivåer vara synliga per default eller vara opt-in per grupp?** Vissa vängrupper vill ha gamification, andra ogillar rankning även privat. Konsekvens: `GroupHighlights` blir en inställning.
6. **Ska "Aktivitet"-flödet leva vidare i produkten eller ersättas av notiser?** Om flödet ska stanna → hemmavist är Gruppen. Om det ska bli notiser → ta bort sektionen helt och lägg energi på pushbara händelser.
7. **Ska "Öppna i Maps" räknas som produkthandling eller flykt?** Om primär: behåll som knapp. Om sekundär: nedgradera till textlänk.
8. **Ska en gruppmedlem kunna se ett annat lands/annan grupps favoriter/besök när de delas, eller ska delning alltid vara en explicit engångsimport?** Detta påverkar hur `ShareVisitDialog`/`VisitDetailSheet` bör benämnas ("Delat besök" vs. "Importerat besök").

---

Ingen kod, inga migrationer, ingen publicering utförs som del av denna granskning.
