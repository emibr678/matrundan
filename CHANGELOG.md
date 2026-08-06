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
