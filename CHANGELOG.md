# Changelog

Alla noterbara ändringar i Matrundan listas här. Formatet är inspirerat av
[Keep a Changelog](https://keepachangelog.com/sv/1.1.0/) och versionerna
följer [semantisk versionshantering](https://semver.org/lang/sv/).

Tidigare historik är bevarad i:

- [v1.6.1–v1.15.0](./docs/archive/changelog-v1.6.1-through-v1.15.md)
- [historiken till och med v1.6.0](./docs/archive/changelog-through-v1.6.md)

## [Unreleased]

Inga ändringar ännu.

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
