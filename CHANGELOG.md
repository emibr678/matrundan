# Changelog

Alla noterbara ändringar i Matrundan listas här. Formatet är inspirerat av
[Keep a Changelog](https://keepachangelog.com/sv/1.1.0/) och versionerna
följer [semantisk versionshantering](https://semver.org/lang/sv/).

Tidigare historik är bevarad i:

- [v1.16.0–v1.26.1](./docs/archive/changelog-v1.16-through-v1.26.1.md)
- [v1.6.1–v1.15.0](./docs/archive/changelog-v1.6.1-through-v1.15.md)
- [historiken till och med v1.6.0](./docs/archive/changelog-through-v1.6.md)

## [Unreleased]

Inga ändringar ännu.

## [1.30.0] – 2026-08-08

### Ändrat

- **Platsunderhåll** samlar rapporterade platsfel och neutrala
  förbättringskandidater i en gemensam global arbetskö för särskilt behöriga
  platsunderhållare.
- Backendkällorna förblir separata men projiceras genom ett minimerat
  serverkontrakt med strukturerad feltyp och neutral platsinformation. Den
  globala kön får inte exponera ursprungsgrupp, medlemskap, rapportör eller
  historisk privat rapporttext.
- Extern matchning kontrolleras server-side och en verifierad provideridentitet
  länkas till samma kanoniska matställe utan att besök eller grupprelationer
  flyttas.
- Ärenden kan markeras som **OSM-åtgärd** för manuellt arbete i OpenStreetMap.
  Matrundan gör ingen automatisk extern OSM-skrivning i detta steg och befintlig
  offentlig OSM Note-historik bevaras.
- Strukturerat avfärdande och privata auditloggar bevarar
  underhållshistoriken utan att kopiera privat rapporttext.
- Den tidigare separata gruppkön **Rapporterade fel** är reducerad. Vanliga
  användare kan fortsatt rapportera fel från matställen och sökträffar, medan
  handläggningen sker centralt i Platsunderhåll.
- En lokal, tydligt märkt fiktiv demo visar både rapporterade fel och
  förbättringskandidater, karta och åtgärder utan provider-, databas- eller
  OSM-skrivningar.

## [1.29.1] – 2026-08-08

### Rättat

- En webbplats som anges när **Lägg till ett ställe som saknas** används sparas
  nu med stället i gruppen i stället för att försvinna efter att stället skapats.
- Webbplatsens egen URL används som källänk när ingen separat källänk eller
  observation har angetts, utan att försvaga serverns källkrav för andra
  praktiska uppgifter.

## [1.29.0] – 2026-08-08

### Ändrat

- **Lägg till ställen** behåller sökningen som huvudväg och visar **Lägg till ett
  ställe som saknas** först i anslutning till autocomplete, sökresultat eller
  ett tomt resultat när den faktiskt behövs.
- Fallbackformuläret prioriterar namn, kategori, kök/inriktning och ett
  sammanhållet verifierat platsval utan att användaren behöver förstå eller
  bedöma OpenStreetMap.
- Webbplats kan anges frivilligt tillsammans med **Passar för** och anteckning
  under **Fler uppgifter**. Symbol väljs automatiskt utifrån ställets kategori i
  stället för manuellt i fallbacken.
- Verifierat namn och plats kan matchas konservativt mot redan kända kanoniska
  Matrundan-ställen utan att ursprungsgrupp, medlemskap, gruppanteckningar,
  antal grupper eller andra privata uppgifter lämnar servern.
- När användaren väljer en befintlig kandidat återanvänds samma `place_id` och
  endast målgruppens relation skapas eller återaktiveras. Osäkra kandidater
  slås aldrig ihop automatiskt och kan uttryckligen avböjas.
- Ett nytt verifierat manuellt ställe utan aktiv extern källa skapar ett privat
  systeminternt förbättringsunderlag för senare källmatchning. Det betyder inte
  att stället saknas i OpenStreetMap och publicerar inget externt.
- Exempelgruppen kan återaktivera det arkiverade **Brödverket 47** från
  fallbackflödet med samma lokala platsidentitet och utan externa anrop.

## [1.28.0] – 2026-08-07

### Ändrat

- Lägg till ställen etablerar sökområdet före matställessökningen: geografifältet
  visas före valda områdes-pills och avståndet beskrivs som `Sök inom X km`.
- Kända kök, inriktningar och typer som sushi, pasta och café tolkas semantiskt
  i stället för att enbart matchas mot verksamhetsnamn.
- Matställessökningen skiljer generella köks- och typförslag från specifika
  verksamheter utan att ett verksamhetsval ändrar sökområde eller avstånd.
- En ny sökning behåller redan visade träffar under omladdningen och visar en
  diskret `Söker…`-status i stället för att tömma resultatytan.
- Sökresultat visas i mindre omgångar och varje listsida fylls med upp till 20
  faktiskt visningsbara träffar när providern har fler. **Visa fler** ger upp
  till nästa 20 visningsbara träffar och lägger dem sist utan att kasta om
  redan visade resultat.
- Att ta bort det sista sökområdet på mobil lämnar kvar fliken **Sök**, utan att
  formuläret för manuellt tillägg blinkar fram.
- Identiska Geoapify-sökningar och autocompleteanrop kan återanvända en
  kortlivad servercache för att minska onödiga provideranrop.
- Exempel- och demoläget använder samma sökintent med deterministiska lokala
  matställen och utan externa provideranrop.

## [1.27.1] – 2026-08-07

### Rättat

- Geografisk autocomplete visar kort platsnamn med svensk resulttyp och relevant
  ort, kommun eller län i stället för rå providertext som `Stavsnäs, AB`.
- Breda kommun-, läns- och regionträffar förklaras tydligt men förblir ovalbara
  så länge sökområden använder punkt och radie.
- Exempel- och demoläget använder samma autocompletepresentation utan externa
  Geoapify-anrop.

## [1.27.0] – 2026-08-07

### Ändrat

- Detaljen **Lägg till i gruppen** och detaljsidan för ett redan tillagt
  matställe använder samma visuella språk för platsidentitet och praktisk
  information.
- Adressen i förhandsdetaljen fungerar som kartlänk och webbplats samt
  öppettidsdata följer samma kompakta panelmönster som på den tillagda sidan.
- Sökresultatlistan behåller sin tidigare kompakta utformning; den nya
  detaljidentiteten används först när en träff öppnas för granskning.
- Ett ännu inte tillagt ställe får inga handlingar för besök, favorit eller
  nästa stopp. Kök och inriktning, Passar för, gruppanteckning och rapportering
  ligger kvar i förhandsflödet.

## [1.26.5] – 2026-08-06

### Rättat

- Nya öppna inbjudningslänkar kan användas av flera personer tills länken
  återkallas eller går ut.
- E-postbundna inbjudningar förblir engångslänkar för den angivna adressen.
- Aktiva medlemmar kan öppna länken igen utan dubbelt medlemskap eller en ny
  anslutningshändelse.
- Tidigare använda, återkallade eller utgångna äldre länkar återaktiveras inte
  av migrationen.

## [1.26.4] – 2026-08-06

### Rättat

- Nya breda kommun-, län-, region- och landsområden blockeras åter av
  servern innan gruppens befintliga sökområden ersätts.
- Befintliga breda sökområden kan ligga kvar oförändrade tills gruppen väljer
  ett mer precist område.
- Den privata bucketen för besöksfoton begränsas åter till högst 1,5 MB och
  endast JPEG.
- Korrigeringen använder en ny framåtriktad migration och spelar inte om eller
  fabricerar historiskt saknade migrationsversioner.

## [1.26.3] – 2026-08-06

### Ändrat

- Exempelgruppen täcker återbesök, besöksfoto, gäst, tidigare medlem, delat
  besök, arkiverat ställe och flera synliga omdömen i samma produktkomponenter
  som demo- och live-läge.
- Providerställe, begränsad platsinformation och ett långt mobilscenario gör
  fler verkliga produktfall möjliga att granska utan externa anrop.
- Exempeldata byggs från en uttrycklig referenstid och använder en ny
  sessionsversion så gammal flikdata inte döljer det aktuella scenariokontraktet.
- Kontraktstester och riktade mobilflöden verifierar referensintegritet,
  deltagarregler, delningsintegritet och 360 px utan horisontell overflow.

## [1.26.2] – 2026-08-06

### Ändrat

- Adress visas över en kompakt delad rad för webbplats och öppettider, med
  vertikalt centrerade tryckytor.
- En gemensam kontroll jämför adress och kartposition, webbplats och öppettider
  utan att lägga till en permanent fjärde rad på kortet.
- Gruppens manuella uppgifter behandlas som avsiktliga val; en varm diskret
  markering visas endast när nya uppgifter behöver granskas.
- Exempelgruppen använder samma kontrollflöde med lokala, deterministiska
  uppgifter och utan externa Geoapify- eller OpenStreetMap-anrop.
- Den klippta röda markeringen bakom kortets överkant visas inte längre när ett
  ställe är nästa stopp.