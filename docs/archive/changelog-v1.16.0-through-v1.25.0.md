# Changelog

Alla noterbara ändringar i Matrundan listas här. Formatet är inspirerat av
[Keep a Changelog](https://keepachangelog.com/sv/1.1.0/) och versionerna
följer [semantisk versionshantering](https://semver.org/lang/sv/).

Tidigare historik är bevarad i:

- [v1.6.1–v1.15.0](./docs/archive/changelog-v1.6.1-through-v1.15.md)
- [historiken till och med v1.6.0](./docs/archive/changelog-through-v1.6.md)

## [Unreleased]

Inga ändringar ännu.

## [1.25.0] – 2026-08-04

### Ändrat

- Den kombinerade profil- och gruppmenyn visar aktiv grupp i sidhuvudet och
  hanterar långa gruppnamn utan en extra rad under Matrundan.
- Platsdetaljen prioriterar betyg, handlingar och besök. Webbplats och
  öppettider visas kompakt, medan adressen öppnar Google Maps.
- Nya uppgifter om webbplats eller öppettider kan jämföras direkt med gruppens
  nuvarande värden. Ingenting skrivs över automatiskt.
- Underhållsinformation och sökning efter nya platsuppgifter ligger i
  redigeringsdialogen i stället för i vardagsvyn.
- **Rapportera felaktig information** ligger som en diskret slutåtgärd på
  platsdetaljen i stället för inuti **Om stället**.
- **Om Matrundan** visar syfte, aktuell version och tidigare uppdateringar direkt
  i gruppinställningarna utan ett extra dialogsteg.

### Säkerhet

- Interna notifieringsköer och äldre appstatusfunktioner har fått striktare
  anropsrättigheter i databasen.

## [1.24.0] – 2026-08-04

### Ändrat

- Aktiv grupp visas diskret under Matrundan i sidhuvudet med stöd för långa
  grupp- och profilnamn.
- Topplistan visar alla betygsatta ställen som standard och kan sedan filtreras
  på **Passar för**.
- Statuspills, redigering av ställesuppgifter, sökresultatens vyval och
  redigering av eget omdöme är tydligare på mobil.
- Besöksdetaljen leder vidare till stället utan en dubblerad Maps-knapp.
- Praktiska uppgifter använder ett enklare **Hur vet du det?**-flöde och skiljer
  tydligt på att kontrollera kartdata och att välja att använda den.

## [1.23.0] – 2026-08-03

### Ändrat

- Gruppinställningarna öppnar en kompakt meny för **Grupp och sökning**,
  **Medlemmar och inbjudningar**, **Underhåll av matställen**,
  **Inställningar och status** samt information om appen.
- Långa formulär och administrativa verktyg ligger på egna undersidor med
  tillbaka-navigering och rollanpassad synlighet.
- Osparade ändringar i grupp- och sökinställningarna skyddas innan användaren
  lämnar vyn.
- Gruppens aktivitet har en tydlig väg till den gemensamma besökshistoriken.

## [1.22.0] – 2026-08-03

### Ändrat

- Webbplats, öppettider och Google Maps visas som jämbördiga rader under
  **Praktiskt** med samma visuella hierarki och externa länkbeteende.
- Redigeringen använder kortare copy, fältvis återgång till kartdata och ett
  kompakt privat underlag för ändringen.

### Rättat

- Öppettider är inte längre visuellt indragna under webbplatsen.
- Återgång till kartdata skapar inte längre ett nytt granskningsunderlag.

## [1.21.1] – 2026-08-03

### Ändrat

- Hela kortet **Senast tillsammans** öppnar det specifika besöket, medan
  **Alla besök** leder till gruppens samlade historik.
- Besöksrader i gruppens aktivitet öppnar samma besöksdetalj som Hem och
  besökshistoriken.

## [1.21.0] – 2026-08-03

### Lagt till

- Besök kan innehålla namngivna gäster utan att de skapas som gruppmedlemmar
  eller får medlemsprogression.
- Gruppen har en gemensam besökshistorik via **Visa alla besök** på Hem. Historiken
  visar det senaste först och använder samma besöksdetaljer som matställesvyn.

### Ändrat

- Matställen visar hur många av gruppens medlemmar som har varit där, och nästa
  stopp beskrivs konsekvent som ett förslag.
- Hem visar om den aktuella medlemmen själv har svarat på datumförslaget, utöver
  gruppens sammanställning.
- Exempelgruppen visar en avsiktlig demokarta utan externa kartanrop och
  förklarar att användaren testar som Alex, gruppens ägare.
- Topplistan visar antal besök och redigeringsvägarna har mer specifika namn.

### Rättat

- Dialoger och paneler annonserar **Stäng** på svenska, och varje stjärnbetyg är
  semantiskt kopplat till rubriken för helhet, smak, prisvärdhet eller service.
- Samma kommentar visas inte längre både som gemensam besökskommentar och som
  användarens eget omdöme.

### Databas och integritet

- Besöksgäster lagras privat och besökslokalt. Gästnamn visas bara i besökets
  ursprungsgrupp; andra grupper som får besöket delat ser endast ett anonymt
  antal personer utanför gruppen.
- Endast valda faktiska gruppmedlemmar får deltagarprogression. Registreraren får
  ingen automatisk kredit och gäster påverkar inte medlemsstatistik.

## [1.20.2] – 2026-08-03

### Rättat

- Ägaren i exempelgruppen kan använda samma medlemshantering som i en riktig
  grupp. Rolländringar, ägarbyte och borttagning sparas lokalt i fliken.
- Medlemsprofiler kan öppnas direkt från medlemslistan i gruppinställningarna i
  både exempel- och live-läge.

### Ändrat

- Sökområden visas med mindre gemensamma pills i både **Matställen** och
  **Gruppinställningar**.
- När fem vanliga sökområden redan är valda visar gruppinställningarna en kompakt
  förklaring i stället för ett stort avstängt sökfält.

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
