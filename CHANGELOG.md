# Changelog

Alla noterbara ändringar i Matrundan listas här. Formatet är inspirerat av
[Keep a Changelog](https://keepachangelog.com/sv/1.1.0/) och versionerna
följer [semantisk versionshantering](https://semver.org/lang/sv/).

Tidigare historik är bevarad i:

- [v1.6.1–v1.15.0](./docs/archive/changelog-v1.6.1-through-v1.15.md)
- [historiken till och med v1.6.0](./docs/archive/changelog-through-v1.6.md)

## [Unreleased]

Inga ändringar ännu.

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
