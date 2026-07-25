
# Kritisk granskning: plats-UX & gamification

Ingen kod ändras. Detta är en produktrekommendation. Utgångspunkten är en privat grupp på ~6 personer som äter tillsammans ~1–4 gånger/månad, ofta samma personer samtidigt.

---

## Del 1 – Gamification: är det överbyggt?

**Kort svar: ja, tydligt överbyggt för användningsfallet.** Systemet är designat som för en publik app med hundratals användare och tävlingslogik. I en 6-personers vänskapsgrupp bryter flera antaganden.

### 1. Nivåer tillför lite utöver ren statistik
- Nivån är en monoton funktion av "unika provade ställen". Det är samma information som siffran "Provade ställen" på profilen, bara omslaget i emoji.
- När samma gäng alltid går tillsammans rör sig alla i lås. Nivåerna blir en gemensam räknare, inte en personlig milstolpe.
- Rekommendation: **ta bort nivåsystemet** i sin nuvarande form. Behåll de tre nyckeltalen (Besök, Provade ställen, Föreslagna) på profilen. Om något behövs som "roligt", räcker en enda mjuk milstolpe per medlem ("10 ställen provade 🎉") som visas som en liten notis, inte en permanent progressbar.

### 2. Nivågränserna passar inte kadensen
- Vid 1–4 gemensamma besök/månad, och stort överlapp mellan besökta ställen, tar det ~1 år att nå nivå 3 och ~5+ år till "Matrundanmästare". Det motiverar inte, det tröttnar.
- Även om gränserna sänks blir problemet i (1) kvar: alla klättrar samtidigt.

### 3. Gruppintern nivå ger inte individualitet
- Individualiteten uppstår bara om medlemmar gör olika saker. I praktiken går ni ut tillsammans, så deltagarlistan är nästan identisk per besök. Nivån blir därmed en dubblett av gruppens totala besök, per person.
- Där verklig individualitet finns är i **smak och åsikter**: favoritkök, snittbetyg, "gillar sött", "streng recensent". Det är där profilen bör investera, inte i XP.

### 4. Badges riskerar belöna admin-beteende
- "Utforskare" (föreslår ställen) och "Kritiker" (fyller i detaljbetyg) belönar exakt det som redan är friktion. Den som råkar vara mest strukturerad vinner, inte den som är roligast att äta med.
- "Stammis" och "Varieté" är däremot upplevelsebaserade och OK.
- Rekommendation: **behåll Stammis och Varieté**, gärna omdöpta till neutrala "smakspår" istället för utmärkelser. **Ta bort Utforskare, Kritiker och Månadens matvän som badges.**

### 5. "Månadens matvän" blir konstigt i liten grupp
- Med 6 personer och ~2–4 besök/månad, där ofta 4–6 deltar per besök, är utfallet nästan slumpmässigt eller helt statiskt (samma person varje månad om någon råkar missa ett tillfälle). Att formellt "utse" en vinnare bland familj/nära vänner för att ha gått på fler middagar skaver.
- Rekommendation: **ta bort "Månadens matvän"**. Ersätt med en varm, icke-rankande månadssammanfattning: "I april åt ni på 3 nya ställen. Högst betyg: Lilla Napoli 4,3." Det firar gruppen, inte en individ.

### 6. Topplista alls?
- Nej, inte som ranking. Alternativ som passar bättre för produkten:
  - **Gemensamma milstolpar**: "10 ställen provade tillsammans", "1 år sedan första Matrundan".
  - **Årsöversikt** (Spotify Wrapped-light) en gång/år: mest besökta ställe, högst betyg, nytt kök ni upptäckte.
  - **Roterande höjdpunkter** utan poäng: "Senaste favoriten", "Nyaste stället", "Ni har inte varit på X sedan i höstas".
- Detta bevarar den varma sociala känslan utan att rangordna vänner.

### 7. Total nivå över grupper – planera i datamodellen nu?
- Nej. Datamodellen i Supabase-planen (memberships × visits × groups) räcker redan för att beräkna cross-group-statistik senare — inga extra fält behövs nu. Att bygga cross-group-nivå innan multi-group ens finns är prematur optimering och motverkar dessutom poängen med isolerade grupper.
- Rekommendation: **vänta**. Inga schemaändringar krävs.

### Sammanfattning gamification
- Nuvarande system är byggt för en app det inte är. Ta ner det till nästan noll och låt behovet av mer växa fram från riktig användning.

---

## Del 2 – Plats-UX

Nuvarande flöde har fyra samtidiga koncept: fritextfråga "Vad är du sugen på?", platsautocomplete, "Nära/Överallt", plus lista/karta-toggle. För en demo utan riktig sökning är det acceptabelt; med Geoapify inkopplat blir det **för mycket kontroller för en enkel uppgift**.

### 8. Två distinkta uppgifter – separera dem
Det finns egentligen två olika användarintent:

- **A. Jag vet vad stället heter** ("Lilla Napoli"). Då vill jag skriva namnet, se en träfflista, klicka. Plats/radie är irrelevant – Geoapify löser det med biasad global sökning.
- **B. Jag vill utforska** ("italienskt i Majorna"). Då är plats + kategori/kök relevant.

Idag mixas dessa i samma formulär, vilket gör båda krångligare än de behöver vara.

**Rekommenderat flöde när Geoapify kopplas in:**
1. **Ett** sökfält högst upp: "Sök matställe eller ort". Autocomplete visar både konkreta ställen (namn + adress) och orter/områden.
   - Väljer man ett ställe → hoppa direkt till bekräfta-och-lägg-till.
   - Väljer man en ort → filtrera på område, visa kategori-chips (kök/typ) för utforskning.
2. Ingen "Nära/Överallt"-toggle. Geoapify biasar automatiskt runt vald plats; utan vald plats söker den brett. Radie är en dold implementationsdetalj.
3. Kartvyn tas bort från "lägg till"-flödet. Den passar bättre på Matställen-vyn som filter/översikt, inte som en sekundär flik i en dialog.
4. Behåll "Lägg till manuellt" som en liten länk längst ner för det sällsynta fallet ställe saknas.

### 9. Gruppens stad/område
- **Dold standardbias.** Inte en synlig obligatorisk inställning, inte helt frånvarande. Gruppen har ofta en tyngdpunkt (Göteborg), och Geoapify blir bättre med den som biasCircle. Men användaren ska aldrig behöva ändra den för att söka i Stockholm på en helg.
- Konkret: `groups.home_area` finns i botten som bias, men UI:t nämner det bara i Gruppinställningar.

### 10. Slutrekommendation i tre delar

**Behåll nu**
- Domänmodell och Supabase-planen (profiles, groups, memberships, places, visits, reviews, favorites, group_next_place).
- Betygsflödet (helhet + valfria detaljer).
- "Nästa stopp", aktivitetsflöde, klickbara medlemsprofiler.
- Stammis och Varieté som mjuka "smakspår" (ej som utmärkelser med tävlingston).
- Gruppens hemområde som **dold** bias.

**Förenkla/ta bort nu (rensning inför Geoapify och riktig användning)**
- Ta bort nivåsystemet (LEVELS, LevelCard, progressbar). Ersätt med tre siffror + ev. en mjuk milstolpsnotis.
- Ta bort badges: Utforskare, Kritiker, Månadens matvän.
- Ta bort "Månadens matvän"-modulen i Grupp-vyn. Ersätt eventuellt med "Denna månad" som en neutral gruppsammanfattning (antal besök, högst betyg), utan att peka ut person.
- Slå ihop "Vad är du sugen på?" och platsfältet till **ett** sökfält i AddPlaceDialog. Ta bort Nära/Överallt-toggeln. Flytta kartan ur dialogen.
- Uppdatera version.ts och changelog: 0.5.0 "Enklare, varmare".

**Vänta med tills backend/verklig användning kräver det**
- Cross-group total nivå/statistik (kräver multi-group + Supabase ändå).
- Årsöversikt / Wrapped-vy (bygg när det finns ≥1 års data).
- Riktig kartvy på Matställen (först när Geoapify är inkopplat).
- Riktig leaderboard – bygg bara om användarna själva efterfrågar det efter några månader.

### Röd tråd
Matrundans värde är **"vad ska vi äta nästa gång, och vad tyckte vi förra gången"**. Allt som inte direkt stöttar lägg till → välj → besök → betygsätt är brus. Nuvarande gamification och plats-UX har drivit iväg från kärnan; en förenklingsrunda är rätt nästa steg innan Supabase/Geoapify kopplas in.
