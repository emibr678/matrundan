from pathlib import Path

VERSION = Path("src/lib/matrundan/version.ts")
README = Path("README.md")
CHANGELOG = Path("CHANGELOG.md")

version_text = VERSION.read_text(encoding="utf-8")
version_text = version_text.replace(
    'export const APP_VERSION = "0.12.1";',
    'export const APP_VERSION = "0.13.0";',
    1,
)
version_text = version_text.replace("SECURITY DEFININER", "SECURITY DEFINER")
old_history_start = '''export const CHANGELOG: ChangelogEntry[] = [
  {
    version: APP_VERSION,
    date: APP_VERSION_DATE,
    summary:
      "Fredagsgänget går nu att prova fullt ut – ändringar sparas tillfälligt i den aktuella fliken och kan återställas när som helst.",'''
new_history_start = '''export const CHANGELOG: ChangelogEntry[] = [
  {
    version: APP_VERSION,
    date: APP_VERSION_DATE,
    summary:
      "Lägg till flera matställen i samma sökomgång utan att förlora sökning, karta eller position.",
    sections: [
      {
        kind: "Förbättrat",
        items: [
          "Sökdialogen ligger kvar efter varje tillägg och bekräftelsen öppnas ovanpå den befintliga resultatvyn.",
          "Söktext, plats, radie, list- eller kartläge, valt resultat och scrollposition bevaras när nästa ställe läggs till.",
          "Resultat visar Tillagd, Finns redan eller Lägg tillbaka beroende på gruppens befintliga relation till stället.",
          "En diskret räknare summerar omgången och knappen Klar avslutar när gruppen samlat färdigt.",
          "Manuellt tillägg behåller sitt tidigare enstaka sparflöde, och kanonisk dubblett- och återaktiveringslogik är oförändrad.",
        ],
      },
      {
        kind: "Rättat",
        items: [
          "Ett lyckat söktillägg skickar inte längre användaren tillbaka till början av matställesflödet.",
        ],
      },
    ],
  },
  {
    version: "0.12.1",
    date: "2026-07-28",
    summary:
      "Fredagsgänget går nu att prova fullt ut – ändringar sparas tillfälligt i den aktuella fliken och kan återställas när som helst.",'''
if old_history_start not in version_text:
    raise SystemExit("Kunde inte hitta versionshistorikens start")
version_text = version_text.replace(old_history_start, new_history_start, 1)
VERSION.write_text(version_text, encoding="utf-8")

readme_text = README.read_text(encoding="utf-8")
old_readme = '''## Status – v0.12.1

Paket 5A och 5A.1 skiljer tydligt mellan en publik start, en interaktiv'''
new_readme = '''## Status – v0.13.0

Paket 5B gör det möjligt att lägga till flera sökträffar i samma omgång.
Sökdialogen, radien, list- eller kartläget, det valda resultatet och positionen
bevaras efter varje tillägg. Resultat märks Tillagd, Finns redan eller Lägg
tillbaka, en räknare summerar omgången och Klar avslutar uttryckligt. Manuellt
tillägg och den kanoniska dubblett- och återaktiveringslogiken är oförändrade.

Paket 5A och 5A.1 skiljer tydligt mellan en publik start, en interaktiv'''
if old_readme not in readme_text:
    raise SystemExit("Kunde inte hitta README-statusen")
README.write_text(readme_text.replace(old_readme, new_readme, 1), encoding="utf-8")

changelog_text = CHANGELOG.read_text(encoding="utf-8")
marker = "## [0.12.1] – 2026-07-28"
entry = '''## [0.13.0] – 2026-07-28

### Förbättrat

- **Flera ställen i samma sökomgång.** Sökdialogen stannar kvar efter varje
  tillägg och bekräftelsen öppnas ovanpå den befintliga resultatvyn.
- Söktext, plats, radie, list- eller kartläge, valt resultat och scrollposition
  bevaras när nästa ställe läggs till.
- Resultat märks **Tillagd**, **Finns redan** eller **Lägg tillbaka** beroende
  på gruppens befintliga relation till stället.
- En diskret räknare summerar omgången och **Klar** avslutar uttryckligt.
- Manuellt tillägg behåller sitt tidigare enstaka sparflöde. Kanonisk
  dubblettkontroll och återaktivering av borttagna gruppkopplingar är
  oförändrade.

### Rättat

- Ett lyckat söktillägg stänger inte längre dialogen eller skickar användaren
  tillbaka till början av matställesflödet.
- 360 px-regressionen verifierar tre sekventiella tillägg, bevarat kartläge,
  omgångsräknare, Tillagd/Finns redan och explicit avslut med Klar.

'''
if marker not in changelog_text:
    raise SystemExit("Kunde inte hitta CHANGELOG-markören")
CHANGELOG.write_text(changelog_text.replace(marker, entry + marker, 1), encoding="utf-8")
