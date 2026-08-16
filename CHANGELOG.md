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

## [1.36.0] – 2026-08-16

### Nytt

- Hem visar en diskret signal för aktuella deltagarbesök där ditt eget omdöme
  saknas och länkar direkt till samma gemensamma besök.
- Besök markerar samma aktuella besök med **Ditt omdöme saknas**, medan äldre
  obesvarade besök ligger kvar i historiken utan framträdande påminnelse.

### Förbättrat

- Påminnelsen följer faktisk deltagarstatus och existensen av ditt kanoniska
  omdöme, så den försvinner när du lämnar omdöme eller korrigerar att du inte
  var med.

## [1.35.1] – 2026-08-16

### Rättat

- Versionshistoriken i appen beskriver nu korrekt att den som registrerar ett
  nytt besök alltid räknas som faktisk deltagare och lämnar sitt eget omdöme.

## [1.35.0] – 2026-08-15

### Förbättrat

- Besöksdetaljen samlar gruppens betygssammanfattning och deltagarnas egna
  omdömen i samma **Gängets omdömen**-yta i stället för flera konkurrerande
  sektioner.
- Ditt omdöme ligger tillsammans med övriga deltagares omdömen, med en enda
  tydlig kompletteringsknapp när du ännu inte har svarat och kompakt redigering
  när omdömet finns.
- Flera omdömen visas kompakt med valfria detaljer. Normal
  deltagarkorrigering ligger sekundärt medan ett tidigare **Jag var inte med**
  fortfarande får ett tydligt återställningsläge.
- Ett befintligt besöksfoto kan inte längre ersättas av en annan deltagare.
  Uppladdaren behåller rätten att byta sin bild medan ägare och admin bara kan
  ta bort någon annans foto som modereringsåtgärd i väntan på flerfotostödet.
- Exempelgruppen innehåller ett 3-av-4-scenario och ett besök utan aktiva
  omdömen så flerpersons- och tomlägen kan granskas utan externa anrop.

## [1.34.0] – 2026-08-14

### Nytt

- Faktiska deltagare som saknar eget omdöme kan komplettera samma kanoniska
  besök med helhetsbetyg, smak, service, prisvärdhet och valfri kommentar utan
  att ett nytt besök skapas.
- En medlem som felaktigt lagts till som deltagare kan välja **Jag var inte med**
  och senare återställa **Jag var med**. Progression och synliga
  deltagaromdömen följer den korrigerade deltagarsanningen.

### Förbättrat

- Den som registrerar ett nytt besök räknas alltid som faktisk deltagare och
  lämnar sitt eget omdöme i samma flöde. Andra deltagare kan fortfarande
  korrigera sin närvaro utan att ett nytt besök skapas.

## [1.33.0] – 2026-08-13

### Ändrat

- Matrundans egna varumärkesytor använder samma transparenta markering och
  ordmärke i landning, exempelgrupp och inloggat läge i stället för en generisk
  tallriksemoji.
- **Om Matrundan** återanvänder samma dialog och varumärkesmarkering oavsett var
  den öppnas.
- Installeringsikoner för PWA och favicon ligger kvar separat och används inte
  som inline-märke i appens gränssnitt.
- Grupp- och matställeemojis behåller sin innehållsbetydelse och påverkas inte av
  varumärkesändringen.

## [1.32.0] – 2026-08-13

### Ändrat

- Gruppinställningarna är uppdelade efter tydliga uppgifter: **Gruppen**,
  **Sökområden**, **Medlemmar och inbjudningar**, **Matställen**, **Besök och
  progression** samt **Gruppstatus**.
- Gruppnamn och symbol sparas separat från sökområden och sökavstånd så en
  ändring inte behöver skriva om den andra delen.
- Dolda sökträffar ligger kvar som gruppspecifikt matställeunderhåll. Den gamla
  informationsrutan om den flyttade rapportkön har tagits bort eftersom
  handläggningen sker i globala **Platsunderhåll**.
- **Om Matrundan** och versionshistoriken nås från profil- och gruppmenyn i
  stället för Gruppinställningar.

## [1.31.0] – 2026-08-11

### Ändrat

- Kommuner och annan verifierad geografi kan användas som sökområden inom sin
  faktiska providergräns i stället för att behandlas som en godtycklig punkt och
  radie.
- Samma sökning kan kombinera boundaryområden med adresser, orter och andra
  punktval. Sökavståndet påverkar bara punktvalen och samma providerställe
  dedupliceras om det matchar flera valda områden.
- Kartan visar verifierade Polygon/MultiPolygon-gränser tillsammans med
  punktområdenas radier, matställespins och befintlig klustring.
- Befintliga sparade sökområden behåller sin tidigare punktsemantik tills ett
  område uttryckligen väljs om och får en verifierad gräns.
- Exempel- och demoläget kan verifiera samma boundary- och punktflöden med lokal
  geometri och fiktiva matställen utan externa provideranrop.

## [1.30.1] – 2026-08-11

### Rättat

- Behöriga deltagare, gruppägare och administratörer kan åter ladda upp och byta
  privata besöksfoton utan `permission denied` från Storage-policyn.
- Storage-policyn använder en smal kontroll för den aktuella användaren medan
  den interna hjälpfunktionen med valfritt användar-ID fortsatt är spärrad för
  direkta klientanrop.

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
  matställen och utan externa Geoapify-anrop.

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