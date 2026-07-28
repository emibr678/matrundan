# Changelog

Alla noterbara ändringar i Matrundan listas här. Formatet är inspirerat av
[Keep a Changelog](https://keepachangelog.com/sv/1.1.0/) och versionerna
följer [semantisk versionshantering](https://semver.org/lang/sv/).

Den fullständiga historiken till och med version 0.14.0 är bevarad i
[docs/archive/changelog-through-v0.14.md](./docs/archive/changelog-through-v0.14.md).

## [0.15.0] – 2026-07-28

### Nytt

- **Datumförslag för nästa stopp.** En aktiv gruppmedlem kan föreslå en dag och
  en valfri tid direkt på kortet för gruppens aktuella nästa stopp.
- Varje aktiv medlem kan svara **Passar**, **Passar inte** eller **Osäker** och
  ändra sitt svar så länge förslaget är öppet.
- Gruppen ser både antal och namn för de aktuella svaren.

### Förbättrat

- Förslagsställaren, gruppens ägare eller admin kan bekräfta eller ta bort
  datumet. Det sker ingen automatisk bekräftelse utifrån majoritet.
- Ett öppet eller bekräftat datumförslag stängs automatiskt när nästa stopp
  byts, tas bort från gruppen eller registreras som besökt.
- Datumförslag och svar är privata för gruppen. Direkt tabellåtkomst är
  återkallad och skrivningar går genom medlems- och rollvaliderade
  `SECURITY DEFINER`-RPC:er.
- Läsmodellen räknar endast svar från aktiva medlemmar.
- Fredagsgänget använder samma gränssnitt och sparar planeringen tillfälligt i
  den lokala webbläsarsessionen utan live-skrivningar.

### Rättat

- 360 px-regressionen verifierar att gruppen kan föreslå, svara, bekräfta,
  ladda om och ta bort datumet utan horisontell overflow.
