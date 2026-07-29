# Changelog

Alla noterbara ändringar i Matrundan listas här. Formatet är inspirerat av
[Keep a Changelog](https://keepachangelog.com/sv/1.1.0/) och versionerna
följer [semantisk versionshantering](https://semver.org/lang/sv/).

Den fullständiga historiken till och med version 0.14.0 är bevarad i
[docs/archive/changelog-through-v0.14.md](./docs/archive/changelog-through-v0.14.md).

## [0.16.1] – 2026-07-29

### Förbättrat

- **Tydligare Google Maps.** Adressen är åter vanlig information och kompletteras
  av den tydliga länken **Öppna i Google Maps**.
- **Bättre placerad administration.** **Hantera ställe** ligger nu diskret intill
  **Om stället** i stället för ensam längst ned i huvudkortet.

## [0.16.0] – 2026-07-29

### Förbättrat

- **Tydligare ansvar för huvudvyerna.** Hem fokuserar på nästa stopp och
  progression. Gruppen äger aktivitet och visar inte längre nästa stopp en gång
  till.
- **Tydligare Matställen.** Sidan förklarar att listan innehåller vad gänget vill
  prova och har provat, sökningen kommer före topplistan och handlingen heter
  konsekvent **Lägg till ställe**.
- **Tydligare handlingar på matställets detaljsida.** Nästa stopp skiljer på
  handling och status, personlig favorit heter **Favorit** och Maps nås via
  adressen i stället för en likvärdig åtgärdsknapp.
- Flaggan ersätter glittersymbolen för nästa stopp.
- Medlemsraderna på Gruppen har färre överflödiga etiketter.

### Rättat

- Huvudvyerna och matställets detaljsida har ett riktat mobiltest som verifierar
  informationsplacering, copy och avsaknad av horisontell overflow vid 360 px.

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
