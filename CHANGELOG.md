# Changelog

Alla noterbara ändringar i Matrundan listas här. Formatet är inspirerat av
[Keep a Changelog](https://keepachangelog.com/sv/1.1.0/) och versionerna
följer [semantisk versionshantering](https://semver.org/lang/sv/).

## [Unreleased]

- Inget släppt ännu.

## [0.3.0] – 2026-07-24

### Nytt
- Klickbara medlemsprofiler med besök, favoriter, smakprofil och
  medlemsspecifikt aktivitetsflöde.
- Geografisk sökning i utforskningen med gemensamt platsfält, valbar
  sökradie och en tydligt märkt kartprototyp.
- Navigerbart aktivitetsflöde: aktiviteter öppnar rätt matställe, besök
  eller medlemsprofil.
- Djuplänkade besök – aktivitetens ”registrerade besök” och besökskort på
  matställets sida öppnar samma besöksdetalj.
- Vyn ”Om Matrundan” med aktuellt versionsnummer, kort sammanfattning och
  fullständig versionshistorik.

### Förbättrat
- Tydligare informationshierarki för betyg: gruppens helhetsbetyg lyfts
  fram med snitt och antal betyg, medan smak, prisvärdhet och service
  samlas under ”Betygsdetaljer”.
- ”Nästa stopp”-kortet på hemfliken är nu en tillgänglig länk till
  matställets detaljsida, medan ”Registrera besök” förblir en separat
  primär handling.
- Rena URL:er: när en profil eller ett besök stängs försvinner tillhörande
  query-parameter helt.
- Svensk talformatering med decimalkomma används konsekvent för betyg.
- ”Passar för” har en gemensam kort hjälptext i stället för tooltips per
  kategori.

## [0.2.0] – 2026-07-23

### Nytt
- Registrering av besök med deltagare, tillfälle och valfria detaljbetyg.
- Gruppvyn med gänget, delade favoriter och aktivitet.
- Filter och sortering av matställeslistan bakom en tydlig filterpanel.

### Förbättrat
- Responsiva layouter: bottennavigation på mobil, topmeny på desktop.
- Tillgänglighet: aria-pressed på val, större träffytor och tydligare fokus.

## [0.1.0] – 2026-07-23

### Nytt
- Första Lovable-prototypen av Matrundan.
- Lokal demodata i `localStorage`.
- Grundläggande provider-arkitektur för framtida platssökning.
