# Changelog

Alla noterbara ändringar i Matrundan listas här. Formatet är inspirerat av
[Keep a Changelog](https://keepachangelog.com/sv/1.1.0/) och versionerna
följer [semantisk versionshantering](https://semver.org/lang/sv/).

Tidigare historik är bevarad i:

- [v1.6.1–v1.15.0](./docs/archive/changelog-v1.6.1-through-v1.15.md)
- [historiken till och med v1.6.0](./docs/archive/changelog-through-v1.6.md)

## [Unreleased]

Inga ändringar ännu.

## [1.20.1] – 2026-08-03

### Ändrat

- Exempelgruppen beskriver konsekvent sitt fiktiva Stockholmsgäng och låter
  användaren välja mellan Google och e-post innan en egen grupp skapas.
- Kontoregistreringen lovar inte längre att e-postbekräftelse alltid kan hoppas
  över.
- Ägare och administratörer hanterar medlemmar genom en textbaserad meny med
  stora tryckytor och bekräftelse före ändrad roll, överfört ägarskap eller
  borttagning.

### Säkerhet

- Projektets egen TanStack Start-konfiguration registrerar ramverkets
  CSRF-middleware för serverfunktioner.

## [1.20.0] – 2026-08-02

### Lagt till

- Ägare och administratörer hanterar rapporterade fel på en egen sida med
  kompakta filter för **Att granska**, **Redo att skicka**, **Skickade** och
  **Avslutade**.
- Varje rapport öppnas i en fokuserad detaljpanel som bara visar det steg och de
  handlingar som är relevanta för rapportens aktuella läge.

### Ändrat

- Den tidigare långa platsdatasektionen i gruppinställningarna har ersatts av en
  kompakt ingång med räknare.
- OpenStreetMap förklaras först när ett rättelseförslag faktiskt kan skickas,
  tillsammans med tydlig information om vad som blir offentligt.
- Tekniska OSM-statusar har ersatts med begriplig copy som **Att granska**,
  **Redo att skicka**, **Väntar på granskning** och **Granskad i OpenStreetMap**.
- Skickade rättelseförslag visar en tydlig länk till ärendet och en separat
  statusuppdatering utan att upprepa tidigare gransknings- och
  publiceringskontroller.

## [1.19.0] – 2026-08-02

### Lagt till

- Källstödda ändringar av webbplats och öppettider kan visas som fältvisa
  förslag i andra grupper som använder samma kanoniska matställe.
- Varje grupp väljer uttryckligen om ett förslag ska användas. Ingen befintlig
  gruppuppgift skrivs över automatiskt.
- Motstridiga uppgifter visas som osäkra i stället för att Matrundan väljer en
  vinnare.

### Ändrat

- Förslag som redan motsvarar gruppens eller kartdatans aktuella uppgift visas
  inte, och äldre underlag slutar föreslås efter 90 dagar.
- Ett godkänt förslag sparas som en ny gruppspecifik ändring och blir inte
  automatiskt ett nytt förslag till fler grupper.

### Databas och integritet

- Förslags-RPC:n lämnar endast neutral status, fältvärde, anonymt
  innehållsfingeravtryck och tidpunkt. Ursprungsgrupp, medlem, privat källa,
  anteckning, antal och interna identifierare lämnar aldrig servern.
- Endast ändringar med en uttrycklig källänk kan bli anonyma förslag. Källänken
  används enbart som serverintern behörighets- och kvalitetsmarkör och delas
  inte vidare.
- Globala Geoapify-snapshots kan endast skrivas av serverrollen efter en
  gruppverifierad hämtning. Vanliga autentiserade klienter saknar skrivbehörighet.

## [1.18.0] – 2026-08-02

### Lagt till

- Alla aktiva medlemmar kan lägga till eller rätta gruppens webbplats och
  öppettider med en privat källänk eller observation.
- Praktisk information har en gruppskyddad ändringshistorik med vem som gjorde
  ändringen och när.
- Detaljsidan kan hämta senaste kartdata på nytt. En säker normaliserad snapshot
  delas mellan grupper som använder samma kanoniska matställe utan att exponera
  privata gruppuppgifter.

### Ändrat

- Webbplats och öppettider visas i en kompakt sektion **Praktisk information** i
  stället för en stor tom informationsruta.
- Gruppens egen uppgift används direkt i gruppen men skriver aldrig tyst över
  andra grupper eller den kanoniska platsen.
- När kartdatan skiljer sig från gruppens uppgift visas en jämförelse. Gruppen
  väljer själv om den vill behålla sin uppgift eller återgå till kartdatan.
- En medlems ändring kan skapa ett privat granskningsunderlag för ägare och
  administratörer innan något publiceras till OpenStreetMap.

### Databas och integritet

- `group_places` får en gruppspecifik öppettidsöverstyrning och privat metadata
  för källa, ändrare och ändringstid.
- Historik och externa snapshots saknar direkt klientåtkomst och nås endast via
  medlemskapskontrollerade RPC:er.
- Geoapifys rådata och API-nyckel stannar på servern. Klienten får endast
  normaliserad webbplats, öppettider, tidszon, källangivelse och hämtningstid.

## [1.17.1] – 2026-08-02

### Ändrat

- Kryss och **Tillbaka** från granskningen av en sökträff återgår till samma
  sökning med bevarad söktext, urval och position. Bara ett synligt och aktivt
  modalt lager används åt gången.
- Ägare och administratörer granskar platsdatarapporter med tydliga handlingar:
  **Förbered för OpenStreetMap**, **Markera som åtgärdad** och **Avsluta utan
  åtgärd**.
- Den offentliga OSM-texten visas först efter att rapporten uttryckligen har
  förberetts för OpenStreetMap. Interna anteckningar förblir privata.

## [1.17.0] – 2026-08-02

### Lagt till

- Matställen med en aktiv Geoapify-källa kan visa **Öppettider idag** och ett
  utfällbart veckoschema på detaljsidan.
- Saknad webbplats eller saknade öppettider visas som lugna rader med en
  sekundär åtgärd för att lämna underlag till gruppens admin.
- Felaktiga eller saknade öppettider kan rapporteras som en egen typ av
  platsdatafel.

### Ändrat

- Öppettider visas utan en osäker **Öppet nu**-status. Specialdagar och ovanliga
  regler får en tydlig reservation, och kartdata anges som potentiellt
  inaktuell.
- Platsdetaljer hämtas bakom en autentiserad, gruppskyddad servergräns och
  mellanlagras endast i den aktuella webbläsarsessionen.

### Databas och integritet

- En ny RPC verifierar aktivt medlemskap och att matstället hör till gruppen
  innan servern får använda dess aktiva Geoapify-källa.
- Klienten får bara normaliserade öppettider, säker webbplats, hämtningstid och
  källangivelse. Rå leverantörsdata, gruppmedlemskap och interna databaskopplingar
  exponeras inte.

## [1.16.3] – 2026-08-02

### Ändrat

- Kryss och **Tillbaka** från granskningen av en sökträff återgår till samma
  sökning i stället för att stänga hela tilläggsflödet.
- Den som själv har rapporterat en sökträff ser den diskreta statusen **Din
  rapport väntar på granskning** om träffen inte samtidigt döljs.
- Ett saknat serverstöd för sökträffsrapportering visas med begriplig svensk
  copy i stället för en teknisk PostgREST-funktionssignatur.

### Databas och integritet

- En ny gruppscopad RPC returnerar endast nycklar för den inloggade användarens
  egna aktiva providerträffsrapporter. Andra medlemmars rapporter, rapporttext,
  användaridentitet och interna ID:n exponeras inte.

## [1.16.2] – 2026-08-02

### Ändrat

- **Begränsad platsinformation** ligger på en kompakt egen rad under Webbplats
  och Google Maps utan det tidigare stora glappet.
- Ingången till det sekundära underhållsflödet heter **Stängt eller fel
  uppgifter?** och förklarar kort att användaren kan rapportera till gruppens
  admin eller dölja träffen för gruppen.
- Den neutrala informationsikonen har tagits bort ur söklistan. Signalen **Kan ha
  stängt permanent** visas fortfarande där när underlag för den finns.

## [1.16.1] – 2026-08-02

### Ändrat

- Granskningen före tillägg visar **Webbplats** och **Google Maps** som kompakta
  länkar tillsammans med matställets uppgifter, på samma sätt som detaljsidan.
- **Begränsad platsinformation** visas som en diskret förklaring och en liten
  indikator i söklistan. En möjlig permanent stängning behåller en tydlig
  varning och möjlighet till anonym bekräftelse.
- Rapportering och gruppens reversibla döljning ligger bakom den gemensamma
  ingången **Stämmer inte uppgifterna?** i stället för att belasta det vanliga
  tilläggsflödet.
- Sökområden visas som kompaktare chips. När fem områden är valda ersätts det
  avstängda sökfältet med en tydlig status och vägledning.

## [1.16.0] – 2026-08-02

### Lagt till

- Sökresultat kan visa en neutral varning om ett matställe **kan ha stängt
  permanent**. Signalen avslöjar aldrig vilken grupp eller medlem som lämnat
  underlaget och visar inte rapporttext, antal eller interna identifierare.
- Aktiva medlemmar kan bekräfta **Verkar fortfarande öppet** eller **Bekräfta
  permanent stängt** från granskningsvyn före tillägg. Bekräftelsen innehåller
  ingen fritext och döljer inte träffen automatiskt.
- **Begränsad platsinformation** visas när både webbplats och öppettider
  uttryckligen saknas i leverantörens platsdata. Signalen betyder inte att
  verksamheten har stängt.

### Ändrat

- Söklistan visar bara den korta stängningssignalen. Förklaring, motstridiga
  uppgifter och möjlighet att bekräfta ligger i den öppnade granskningsvyn.
- En ensam ogranskad observation visas som ej verifierad. En adminbedömd signal
  eller oberoende stöd från fler grupper får större tyngd.
- Motstridiga uppgifter visas som **Uppgifterna är osäkra** i stället för att en
  enskild uppgift behandlas som ett säkert besked.
- Äldre rapporter och bekräftelser tappar automatiskt tyngd. Ett nyligt
  registrerat verkligt besök räknas som anonym motbevisning.

### Databas och säkerhet

- Bekräftelser lagras privat per person, grupp och exakt kanonisk plats eller
  provideridentitet. Direkt klientåtkomst till tabellen är spärrad.
- Läs-RPC:n använder endast evidens från andra grupper och returnerar enbart en
  neutral status och två kvalitetsflaggor. Ursprunglig grupp, användare,
  rapporttext, antal och interna ID:n lämnar aldrig servern.
- Kontoradering tar bort användarens aktiva signalbekräftelser så de inte
  fortsätter påverka andra gruppers platsdata.
