
# UX-granskning av Matrundan (ingen kod ändrad)

## Helhetsbedömning
Appen har en varm, sammanhållen nordisk identitet, tydlig bottennav och ett tight kärnflöde: Hem → Nästa stopp → Registrera besök fungerar i praktiken på 2–3 klick. Största friktionen ligger i **desktop-layouten**, i **Gruppen-fliken som är övervägande administration**, samt i några **mikrotexter och terminologival** som skaver. Detaljvyn är behagligt avskalad — bra att extern restauranginfo inte trängs in.

Testat i preview på mobil (390×844) och desktop (1280×1800) via alla huvudflöden. Inga typecheck-fel att åtgärda; det handlar om produkt- och interaktionsjusteringar.

## Vad som redan fungerar och bör behållas
- **Hero "Nästa stopp"** kommunicerar syftet direkt när man landar — den ska förbli sidans centrum.
- **Slumpa-knappen** sitter där ögat söker den, och tomlägestexten när inget nästa stopp finns är tydlig.
- **Statuschippen** ("Nytt för mig", "Nytt för gruppen", "Alla har provat", "Några har provat") är korta och färgkodade — bra semantik.
- **VisitDialog** — 4-stjärnigt default på helhetsbetyg, deltagare förvalda till "Du", detaljbetyg dolt bakom Collapsible. Läroboksexempel på "frivilliga detaljer visas när användaren ber om dem".
- **AddPlaceDialog** — tydlig Sök/Manuellt-toggle och den lilla textraden "Ställen får ligga var som helst – gruppens stad är bara ett förslag" motverkar exakt den geografiska missuppfattningen som beskrevs.
- **Detaljvyn** har en enda Google Maps-knapp — inga externa recensioner, inget brus. Behåll.
- **Progressbaren "X av Y provade"** ger tydligt gruppmål utan att bli tävling.
- **Kategori + flera kök** (Restaurang · italienskt · pizza) läser sig naturligt i PlaceCard.

## Problem, prioriterade

### P0 — måste åtgärdas

**1. Desktop-layouten är för smal och känns ofärdig**
Var: alla sidor. Root-shellet klampar innehållet till `max-w-2xl` (≈672 px) mitt på en 1280+ skärm; på desktop syns ~40 % innehåll och ~60 % tomma gradientytor. Bottennav ligger dessutom fixed på desktop, vilket ser som en mobilemulator.
Varför: appen påstår "bra desktop-layout" men levererar en mobilramme i mitten. För en konsumentapp för vänner är det ok att vara mobile-first, men desktop måste kännas medvetet.
Lösning: På ≥`md` bredda huvudkolumnen (t.ex. `max-w-5xl`) och lägg Hem som 2-kolumn (Nästa stopp + statistik/aktivitet vid sidan), samt byt bottennav mot en topp- eller sidonav. Behåll bottennav endast på `<md`.

**2. "Gruppen" är en huvudflik med nästan bara administration**
Var: bottennav → Gruppen. Innehållet är medlemslista, inbjudan, Google-login-platshållare, återställ demo-data och admin-changelog. Inget av det används dagligen; det tar samma vikt i navigationen som Hem och Matställen.
Varför: bryter proportionerna i informationsarkitekturen och skjuter kärnflödet (lägg till → välj → besök → betygsätt) åt sidan. Användaren nämnde själv detta.
Lösning: Ersätt fliken "Gruppen" med **"Aktivitet"** eller **"Gänget"** som visar det som är socialt värdefullt dagligen (aktivitetsflöde, vem har provat vad, vem har favoriserat, vems tur att välja) och flytta inbjudan/roller/inställningar/admin till en **kugghjulsikon i headern** eller ett menyval "Inställningar" längst ner i den fliken. Bevaka: medlemslistan i sig hör hemma på fliken (den är social), det är inbjudan/roller/version som ska bli sekundärt.

**3. Rubriken/rooten "Utforskningen" saknas — men rubrikerna "Topp betygsatta" och "Senaste aktivitet" på Hem konkurrerar om samma yta som "Nästa stopp"**
Var: Hem, under fold.
Varför: När man scrollar möts man av tre likvärdiga sektioner utan hierarki. "Topp betygsatta" är dessutom otydligt — bygger den på gruppens medelbetyg? På vilket urval?
Lösning: Rama in Hem som "Gruppens gemensamma val + snabb överblick"; flytta hela "Topp betygsatta" till Matställen-fliken där den hör hemma (som ett sorteringsläge eller egen sektion högst upp). Bevara "Senaste aktivitet" på Hem — den är kort och socialt drivande. Under topplistan sätt hjälptext "Baserat på gruppens medelbetyg (minst 1 besök)" så kriteriet är klart.

### P1 — bör åtgärdas snart

**4. Meny/måltid-terminologi blandar frukost/lunch/**fika**/middag/kväll**
Var: VisitDialog "Måltid"-select.
Varför: "fika" och "kväll" är inte samma taxonomi som "frukost/lunch/middag" — fika är socialt, kväll är tidpunkt. Nybörjare fastnar en sekund.
Lösning: Byt fältet från "Måltid" till "**Tillfälle**" och lista: Frukost, Lunch, Fika, Middag, Kvällsöl/sent. Alternativt: låt kategorin på stället styra defaultvärdet (café → Fika).

**5. Emoji används som "photo" — bräckligt och inkonsekvent**
Var: PlaceCard, Hem-hero, detaljvy. På preview-servern renderas flera emoji som tomma rutor (t.ex. Koka visas som ☆). På mobiler med gamla emojiuppsättningar blir det ännu värre.
Varför: appen ger sken av visuell rikedom men riskerar att se trasig ut.
Lösning: Låt emoji vara *default-avatar* men gör tydligt utrymme för framtida riktig bild (Storage-URL i `Place.photo`). På hero: om ingen bild, använd en varm färgad gradient med kategori-emoji **plus** kategoritext, inte bara en emoji ovanpå en färgruta.

**6. Toppen av Matställen är filter-tung**
Var: Matställen-listan. Fyra filterchip + tre selects + sökfält = sju kontroller innan första kortet på mobil.
Varför: nedlastar mobilanvändaren och skymmer att listan är kort.
Lösning: Kollapsa Kategori/Situation/Sortering bakom en "Filter"-knapp med räknarplopp när aktiva; behåll bara sök + snabbchipsen (Alla/Favoriter/Nytt för mig).

**7. Statusbadge-varianten "Delvis / Några har provat" är otydlig i sin nytta**
Varför: användaren behöver sällan skilja på "1 av 5 har provat" vs "4 av 5 har provat" — de gör inte olika saker med informationen.
Lösning: Slå ihop till en enda "Några har provat"-status och visa antal besök på hover/i detaljvy istället. Alternativt visa "3/5 i gänget provat" numeriskt när den är delvis.

**8. Detaljvyn saknar tydlig hierarki mellan action-knapparna**
Var: `matstallen.$placeId.tsx` — fyra likstora outline-knappar i rad ("Besök", "Nästa stopp", "Spara", "Google Maps").
Varför: primär åtgärd (Besök) drunknar; "Google Maps" (extern) väger lika mycket som "Registrera besök" (kärnflödet).
Lösning: Gör "Registrera besök" till full-bredd primary; lägg de andra tre som mindre outline/ghost i en rad under. Behåll Google Maps som enda externa länk.

**9. "Bjud in" — inbjudningslänken är för teknisk**
Var: Gruppen-fliken. `http://localhost:8080/inbjudan/g1?kod=matr-1234` monospace, långt, syns till hälften.
Varför: känns som en admin-panel, inte som att bjuda in en vän.
Lösning: Presentera som "Kopiera länk" + "Dela via…" (system share sheet på mobil). Dölj själva URL-strängen bakom ett litet "visa länk"-toggle.

### P2 — polish

**10. Bakåt-länken i detaljvyn är en textlänk högst upp.** Byt till en riktig ikonknapp (`< Tillbaka`) med större träffyta (44×44) — särskilt eftersom det är den enda vägen tillbaka.

**11. Star-fältet i StatTile på Hem har rubriker i versaler ("STÄLLEN", "BESÖK", "KVAR ATT PROVA") — läsligt men skriker.** Överväg små caps-utseende via typografi istället, eller normal case.

**12. "Fredagsgänget · Göteborg" i headern är statisk även på Gruppen där gruppens namn står stort i hero.** Redundans. Dölj headern-text på just den vyn eller ersätt med aktuell platsindikator.

**13. Progressbar "4 av 8 provade" — 8 låter litet.** Gör hjälptext "Du och gänget har provat 4 av 8 tillagda ställen" så tal känns mänskligt.

**14. Ingen indikation på vems tur det är att välja nästa stopp.** Om "gruppens gemensamma nästa" är centralt kan man addera "Föreslaget av Johan · Ändra"-rad under hero-kortet. Frivilligt, men förstärker det sociala.

**15. Accessibility:** `<button>`-baserade chip på filter/deltagare bör ha `aria-pressed`; ikonknappar (favorit-hjärtat) har label — bra; kontrollera att `<main>` bara renderas en gång — det gör den; datepickerns nativa input i VisitDialog har låg kontrast på placeholdertext ("07/23/2026") — låt Label bära all information och behåll input.

## Rekommenderad implementeringsordning
1. **P0-2 Omforma "Gruppen"-fliken.** Byt till "Aktivitet/Gänget" som primärflik; flytta administration till kugghjul/inställningssida. Detta återställer proportioner i IA innan andra ändringar görs.
2. **P0-1 Desktop-layout.** Bredda kolumnen, gör Hem 2-spalt på ≥md, ersätt bottennav med topnav på desktop.
3. **P0-3 Rubrikordning på Hem + flytta "Topp betygsatta" till Matställen** med tydlig kriterie-text.
4. **P1-8 Primär åtgärd i detaljvyn** — snabb vinst för kärnflödet.
5. **P1-6 Kollapsa filterrad på Matställen.**
6. **P1-4 Byt "Måltid" → "Tillfälle"** och P1-7 slå ihop statusen "Delvis"/"Några har provat".
7. **P1-5 Emoji-som-foto:** förstärk gradient-fallback och förbered `Place.photo` för URL.
8. **P1-9 Inbjudan** som Kopiera/Dela istället för URL-textfält.
9. **P2** i valfri ordning.

## Detalj-anteckningar för implementation
- Root-container i `AppShell.tsx` styr max-bredd och padding för hela appen — här sker desktop-refaktorn.
- Ny "Aktivitet"-flik kan i första steg återanvända `state.activity` från store; ingen datamodelländring krävs.
- Statusreduktion kräver bara ändring i `StatusBadge.tsx` + `statusOf()` i store.
- Byte av "Måltid" till "Tillfälle" påverkar `Visit.meal`-typen; behåll fältnamnet i typen och byt bara label + defaults för att undvika bred refaktor.

**Ingen kod har ändrats.** Godkänn planen så börjar jag med P0-2 (Gruppen-fliken) enligt rekommenderad ordning.
