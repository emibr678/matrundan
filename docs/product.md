# Produktmodell

Det här dokumentet beskriver **hur Matrundan fungerar som produkt i dag**: vilka
problem appen löser, vilka centrala begrepp den använder och vilket ansvar de
viktigaste ytorna har.

Det är inte en roadmap, featurekatalog eller teknisk specifikation.

- [product-roadmap.md](./product-roadmap.md) beskriver riktning, strategiska teman
  och backlogmodell.
- [ux-principles.md](./ux-principles.md) beskriver hur UX och copy ska utformas.
- [architecture.md](./architecture.md) beskriver varaktiga data-, integritets- och
  säkerhetsgränser.
- GitHub Issues äger detaljerat scope, beslutshistorik och operativ status.

När en leverans **materiellt ändrar den bestående produktmodellen** ska den
destillerade nulägessanningen uppdateras här. En copyjustering, implementationsteknisk
förändring eller kortlivad leveransstatus är däremot normalt inte skäl att ändra
det här dokumentet.

## Matrundan i korthet

Matrundan är en privat, gruppcentrerad app för vänner och familjer som vill
upptäcka, välja, besöka och minnas matställen tillsammans.

Kärnresan är:

1. **samla** ställen gruppen är nyfiken på;
2. **välja** vad som står näst på tur;
3. **besöka** ett verkligt ställe och registrera vilka som faktiskt var med;
4. **minnas** genom historik, omdömen, bilder och favoriter;
5. använda minnet för att **välja igen**.

Sökning, karta, statistik, rekommendationer, personliga sammanställningar och
gamification ska stödja den här gemensamma resan. De ska inte göra Matrundan till
en offentlig restaurangkatalog, publik recensionsplattform, individuell
matdagbok, social feed, global ranking eller generell karttjänst.

## Produktens grundmodell

### Gruppen är huvudkontexten

En **grupp** motsvarar ett verkligt sammanhang, exempelvis familjen,
kompisgänget eller en plats som några vill utforska tillsammans.

Varje grupp har sin egen:

- samling av matställen;
- planering;
- historik;
- medlemskrets;
- gruppspecifika favoriter och platsuppgifter.

En användare kan tillhöra flera grupper. Grupper är inte tekniska mappar eller en
hierarki och en bred grupp är inte automatiskt förälder till smalare grupper.
Den aktiva gruppen är därför fortfarande Matrundans primära arbetskontext.

### Matstället är ett verkligt ställe

Ett **matställe** representerar ett verkligt ställe som kan återanvändas mellan
grupper. Samma verkliga plats ska inte dupliceras bara för att flera grupper är
intresserade av den.

Gruppens relation till platsen är däremot gruppspecifik. Där kan exempelvis
gruppens klassificering, favoritstatus, planering och andra egna uppgifter skilja
sig från en annan grupps.

Gruppens samling innehåller både ställen gruppen vill prova och ställen den redan
har besökt. Samlingen är alltså inte en att-göra-lista som töms efter ett besök.

### Nästa stopp är ett planeringsstöd

**Nästa stopp** är gruppens tydligaste planerade kandidat. Därutöver kan ställen
ligga **På tur** i en mjuk kö.

Planeringen ska hjälpa gruppen att komma vidare utan att bli ett formellt
boknings- eller röstningssystem. Ett spontant besök ska inte flytta planeringen.
Kön går vidare när det aktuella planerade stoppet registreras från
planeringsflödet.

### Besöket är det som faktiskt hände

Ett **besök** representerar ett verkligt tillfälle på ett matställe. Besöket är
kanoniskt även om det senare visas i flera grupper.

Det är alltid de **faktiska deltagarna** som räknas. Den som registrerar besöket
får ingen extra progression om personen inte var med. Återbesök är nya verkliga
besök och räknas därför igen.

Gäster kan förekomma utan konto. När en gäst senare kopplas till en medlem ska
identiteten hanteras uttryckligt och inte antas utifrån namn.

### Omdömen beskriver upplevelsen i rätt sammanhang

Ett omdöme hör till en faktisk deltagares erfarenhet av ett verkligt besök.

**Typ av upplevelse** beskriver matstället i gruppens kontext och hjälper
omdömet att tolkas i rätt sammanhang:

- **Snabbt & enkelt**
- **Avslappnat**
- **Något extra**

Ett ställe kan beskrivas med en eller två typer. Klassificeringen gäller
matstället, inte det enskilda besöket.

**Tillfälle** är ett separat begrepp för exempelvis Lunch, Middag, Fika och
Något att dricka. Hämtmat är också en separat egenskap när den är relevant.

### Favoriter och progression är stöd

Favoriter hjälper gruppen och individen att hitta tillbaka till ställen som varit
betydelsefulla. De är gruppscopade; favorit i en grupp betyder inte automatiskt
favorit i alla grupper.

Progression och annan gamification bygger på verkligt deltagande och återbesök.
Den ska vara varm, privat och sekundär till matupplevelsen, aldrig bli appens
huvudsyfte.

## Huvudytorna

### Hem — gruppens nuläge och nästa steg

**Hem** svarar främst på: _Vad har gruppen på gång just nu?_

Ytan sammanfattar det som är mest relevant i den aktiva gruppen, framför allt:

- Nästa stopp och sådant som står på tur;
- hur gruppens samling faktiskt används;
- senaste gemensamma besök och annan aktuell orientering.

Hem ska vara en lugn överblick, inte den primära platsen för att bygga eller
administrera gruppens matställen. Insamling och utforskning ägs av Matställen.

### Matställen — gruppens samling och utforskning

**Matställen** är gruppens huvudyta för att samla, hitta, förstå och återupptäcka
ställen.

Här hör bland annat hemma:

- gruppens samling;
- sökning och tillägg av ställen;
- lista och karta;
- relevanta filter;
- gruppens Topplista;
- platsdetalj och gruppspecifika uppgifter om stället.

Vid en konkret sökning söker Matrundan samtidigt i kartan och bland relevanta
Matrundan-ställen. Befintliga ställen visas under **Finns i Matrundan** med neutral
platsidentitet. Ett tidigare besök krävs inte. När kartträffen säkert motsvarar
ett befintligt ställe presenteras en rad; osäkra träffar hålls isär.

Användaren väljer ett verkligt matställe. Jämförelsen **Är det samma ställe?** visas
först vid osäkerhet. Vanliga medlemmar kan återanvända stället utan att ändra dess
kartkoppling. Ägare/admin kan samtidigt bekräfta kartträffen om servern verifierar
en enda stark kandidat utan konkurrent. Plats-ID och historik bevaras; andra
gruppers privata uppgifter följer inte med.

Ett specifikt exakt eller nära exakt namn kan hitta ett befintligt ställe inom
50 km från ett punktval även när den valda radien är snävare. Adress och ort visas
alltid. Generiska sökningar respekterar valda områden och tom sökning öppnar ingen
global katalog. En verifierad adress i manuell fallback får en sista kartkontroll
nära den valda positionen. Kartfel eller utebliven träff blockerar inte fallbacken.

På kartan väljer ett punkttryck stället och visar dess bottenkort. Tillägg eller
granskning öppnas först genom kortets uttryckliga knapp. Ingen punkt är vald innan
användaren väljer den.

Topplistan är ett stöd för återupptäckt och val utifrån gruppens faktiska
erfarenheter, inte ett offentligt eller globalt Matrundan-betyg.

### Gruppen — människorna bakom rundan

**Gruppen** svarar främst på: _Vilka gör den här resan tillsammans och vad har
gruppen byggt upp?_

Här hör bland annat hemma:

- medlemmar och deras profiler;
- inbjudningar och grupphantering;
- individuell progression i gruppkontext;
- gruppens höjdpunkter och gemensamma favoriter;
- aktivitet och väg vidare till besökshistorik.

Gruppen är inte en social feed. Aktivitet och gamification ska hjälpa igenkänning
och gemenskap utan att konkurrera med matresan.

### Lägg till ett besök i fler grupper

Efterhandsdelning utgår från besöksdetaljens handling **Lägg till besöket i en
annan grupp**. **Redigera besök** korrigerar händelsen och deltagandet. Ett eller
flera mål kan väljas; **Dela min kommentar** och **Dela min bild** är gemensamma
val för handlingen och förvalda när eget innehåll finns. Tidigare besök som
erbjuds när ett ställe läggs till börjar däremot ovalda.

Vid nyregistrering med fler grupper valda visas en bekräftelse med aktuella
gruppnamn och valt eget innehåll innan någon skrivning. **Ändra grupper** återgår
till det bevarade utkastet. Utan extra grupper sparas besöket direkt.

En befintlig besökslänk kan kompletteras med deltagarens eget innehåll. Den
skapar ingen ny händelse. Ändrad kommentar eller utbytt/borttagen bild påverkar
alla grupper där innehållet redan visas; konsekvensen förklaras vid ändringen.

## Min matresa — personlig lins över riktiga grupper

**Min matresa** är en sekundär personlig sammanställning av sådant användaren
redan legitimt får se genom sina grupper. Den är **inte en egen grupp**, supergrupp
eller ny global huvudkontext.

Den verkliga aktiva gruppen finns kvar även när Min matresa är öppen.
Gruppspecifika handlingar lämnas därför vidare till en riktig grupp när det
behövs.

Min matresa hjälper användaren att gå från utspridd historik till personlig
orientering och återupptäckt över sina grupper. Ytan kan användas även när
användaren bara har en läsbar grupp; värdet blir tydligare när flera grupper
bidrar.

### Översikt

**Översikt** ska vara kort och lugn. Den lyfter det som är mest relevant för
användaren just nu, exempelvis:

- egna omdömen som behöver kompletteras;
- en kompakt Topplista;
- sammanfattad personlig statistik;
- senaste egna faktiska besök.

Översikten ska inte växa till en dashboard med många likvärdiga block.

### Topplista

**Topplista** är den fulla rankade vyn över kanoniska ställen där användaren har
legitimt synligt betygsunderlag genom sina grupper.

Samma verkliga ställe och samma synliga omdöme ska inte räknas flera gånger bara
för att de förekommer i flera grupper. Relevanta filter verkar på den
cross-group-mängden, men gruppspecifik metadata får aldrig slås ihop till en
falsk global sanning.

Topplistan är privat och stödjande. Den är inte ett offentligt Matrundan-betyg
eller en global rekommendationsranking.

### Statistik

**Statistik** ger mening åt användarens personliga historik över grupperna.

Ytan innehåller:

- egen samlad statistik från faktiska deltaganden;
- lågmäld jämförelse med personer som användaren delar minst en aktiv grupp med;
- den fulla personliga besökshistoriken.

Samma kanoniska besök räknas högst en gång även om det är synligt genom flera
grupper. Återbesök räknas däremot som nya besök.

Den sociala jämförelsen är varm och privat. Den får visa lågupplösta
sammanställningar, men ska inte exponera andra privata gruppers namn, medlemskap,
ställen eller besöksdetaljer.

## Delning mellan grupper

Matrundan ska återanvända samma verkliga objekt i stället för att skapa kopior.

När ett besök läggs till i ytterligare en grupp är det fortfarande samma
kanoniska besök. Delningen får aldrig implicit avslöja:

- ursprungsgrupp;
- privata medlemskap;
- interna identifierare;
- kommentarer eller bilder som inte uttryckligen får visas i målgruppen.

En användares egen kommentar eller bild kan följa med till valda grupper när
personen uttryckligen delar den. Ägarskap flyttas inte och andra deltagares
innehåll följer inte med automatiskt.

Gruppspecifika saker som favoriter, nästa stopp, reaktioner, anteckningar och
platsmetadata förblir gruppspecifika. Samma ställe får ha olika Typ av upplevelse
i olika grupper. När ett besök läggs till i fler grupper kan den aktiva gruppens
typer föreslås för mål som saknar klassificering. Användaren måste uttryckligen
bekräfta dialogens synliga val med sparhandlingen. Ett befintligt förslag är aktivt
som standard och kan väljas bort; befintliga typer i målgruppen lämnas alltid
orörda. Att avstå hindrar inte delningen och historiska omdömen ändras inte.

## Sökning, geografi och platsdata

Sökning och karta ska hjälpa gruppen att hitta verkliga ställen utan att bli en
egen katalogprodukt.

**Sparade sökområden** är förvalda sökcentrum. De är aldrig geografiska
begränsningar och inget område är primärt framför de andra. Alla sparade områden
är valda när sökningen öppnas.

Externa källor som Geoapify och OpenStreetMap hjälper platsidentifiering och
datakvalitet, men deras tekniska modell ska inte bli användarens produktmodell.

## Produktguidning

Matrundan använder sparsam produktguidning för att förklara sådant som förändrar
den mentala modellen eller blir relevant för första gången.

Grundintroduktionen orienterar användaren i:

**Matrundan → Matställen → Hem → Gruppen**

Den ska förklara varför och vad, inte varje knapp.

Viktig engångshjälp ska ha en permanent väg tillbaka, exempelvis **Så funkar
Matrundan**. Kontextuell hjälp visas när ett begrepp faktiskt blir relevant och
ska inte bilda popupkedjor eller återkommande nagging.

## Exempel, demo och live

Matrundan har publik Exempelgrupp, deterministiskt demo/testläge och autentiserat
live-läge. De ska representera **samma produktmodell**.

Exempelgruppen är Matrundan med fiktiv data, inte en separat variant av produkten.
När ett huvudflöde ändras ska exempel/demo därför följa samma komponenter,
begrepp, copy och interaktionsmodell där det är möjligt.

Skillnader ska bara finnas där läget faktiskt kräver det, exempelvis autentisering,
skrivrättigheter, testverktyg eller tydlig exempelmarkering.

## Bestående produktgränser

Följande regler ska behandlas som produktkontrakt när nya funktioner, UX eller
copy utvecklas:

- gruppen är primär produkt- och integritetsgräns;
- verkliga matställen och besök återanvänds kanoniskt i stället för att
  dupliceras i onödan;
- bara faktiska deltagare får progression och återbesök räknas;
- registreraren får ingen särskild kredit;
- spontana besök flyttar inte Nästa stopp;
- privat innehåll får inte läcka mellan grupper bara för att samma kanoniska
  objekt delas;
- Min matresa är ett sekundärt personligt lager, inte en ny individuell
  huvudprodukt;
- gamification är varm, privat och sekundär;
- sparade sökområden är startpunkter, inte begränsningar;
- produktcopy ska vara naturlig svenska;
- huvudflöden ska fungera utan horisontell overflow vid 360 px.

Detaljerade säkerhets- och datakontrakt finns i
[architecture.md](./architecture.md). Återanvändbara UX-/copyregler finns i
[ux-principles.md](./ux-principles.md).

## Utvalda beslutsspår

Det här dokumentet ska kunna läsas utan historiken nedan. Länkarna finns för de
fall där ett framtida arbete behöver förstå **varför** en viktig produktmodell
ser ut som den gör.

- [Issue #318 — Skala gruppbyte, igenkänning och grupphantering när användaren tillhör många grupper](https://github.com/emibr678/matrundan/issues/318)
  — flera grupper utan teknisk grupphierarki och gruppväljaren som riktig
  gruppkontext.
- [Issue #431 — Renodla Hem och låt Matställen äga samla-flödet](https://github.com/emibr678/matrundan/issues/431)
  — ansvarsfördelningen mellan Hem och Matställen.
- [Issue #393 — Gör Nästa stopp självförklarande med en mjuk kö](https://github.com/emibr678/matrundan/issues/393)
  — Nästa stopp, På tur och relationen mellan planerade och spontana besök.
- [Issue #179 — Dela egen besöksbild uttryckligen tillsammans med delat besök](https://github.com/emibr678/matrundan/issues/179)
  — kanoniska besök och uttrycklig synlighet för eget innehåll mellan grupper.
- [Issue #109 — Min matresa: samlad topplista, statistik och besök från mina grupper](https://github.com/emibr678/matrundan/issues/109)
  — den personliga cross-group-linsen och dess tre delytor.
- [Issue #363 — Introducera nya användare till Matrundans kärnflöde och viktiga begrepp](https://github.com/emibr678/matrundan/issues/363)
  — produktguidning, kärnintroduktion och uppmärksamhetsprinciper.
