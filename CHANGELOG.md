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

## [1.38.11] – 2026-09-10

### Nytt

- En namngiven gäst på ett delat besök kan kopplas till en medlem i en grupp där
  besöket redan finns. Den utpekade medlemmen bekräftar själv innan deltagandet
  räknas.
- När ett besök registreras och delas samtidigt kan gästkopplingen fortsätta
  direkt efter sparandet utan att besöket behöver letas upp igen.

### Förbättrat

- Gästnamn stannar i originalgruppen. Mottagaren ser bara sin egen
  bekräftelsefråga, och bekräftat deltagande kopplas till samma besök utan
  dubbelräkning.

## [1.38.10] – 2026-09-08

### Nytt

- Vid registrering och delning varnar Matrundan när samma matställe, datum och
  tillfälle ser ut att vara samma verkliga besök. Användaren kan återanvända det
  befintliga besöket eller uttryckligen ange att det var ett annat besök.

### Förbättrat

- Dubblettkontrollen återanvänder kanoniska besök utan att exponera
  ursprungsgrupp, andra medlemskap eller privata kommentarer.

## [1.38.9] – 2026-09-08

### Rättat

- Kommentarer som läggs till i efterhand på ett besök går nu att reagera på i de
  grupper där kommentaren faktiskt är synlig.

## [1.38.8] – 2026-09-07

### Förbättrat

- Alla nya databasändringar verifieras nu i en tom produktionslik databas innan
  de kan mergas.
- Databasmigrationer använder en gemensam verifieringsväg lokalt och i CI.

## [1.38.7] – 2026-09-07

### Förbättrat

- CI städar nu bort överspelade browser- och formatteringsartifakter automatiskt
  så att GitHub-lagringen inte fylls av gamla felsökningstillfällen.

## [1.38.6] – 2026-09-06

### Förbättrat

- Matrundans plattforms- och migrationsdokumentation speglar nu den faktiska
  Cloudflare- och Supabase-driften efter Lovable-migreringen.

## [1.38.5] – 2026-09-06

### Förbättrat

- Repot har städats från verifierat oanvända beroenden och äldre scaffoldrester.

## [1.38.4] – 2026-09-05

### Förbättrat

- Kommentarer och reaktioner på besök har fått tydligare integritetsregler över
  gruppgränser.

## [1.38.3] – 2026-09-04

### Förbättrat

- Plattformens hälsokontroller och återställningsunderlag har anpassats till den
  nya driftsmiljön.

## [1.38.2] – 2026-09-03

### Förbättrat

- Besöks- och gruppflöden har fått ytterligare robusthet efter
  plattformsmigreringen.

## [1.38.1] – 2026-09-02

### Förbättrat

- Produktions- och stagingmiljöerna har separerats tydligare efter migrationen
  från Lovable Cloud.

## [1.38.0] – 2026-09-01

### Nytt

- Matrundan kör nu på den nya plattformsmiljön med Cloudflare och Supabase.

## [1.37.0] – 2026-08-31

### Förbättrat

- Plattformsmigreringen har förberetts med säkrare verifiering och driftflöden.

## [1.36.0] – 2026-08-29

### Nytt

- Besök där du ännu inte lämnat omdöme samlas och lyfts i relevanta vyer.

## [1.35.0] – 2026-08-28

### Nytt

- Flera deltagare kan lämna egna omdömen på samma gemensamma besök.

## [1.34.0] – 2026-08-27

### Förbättrat

- Besökshistoriken och delade minnen har fått tydligare struktur.

## [1.33.0] – 2026-08-26

### Nytt

- Omdömen kan reageras på privat inom gruppen.

## [1.32.0] – 2026-08-25

### Förbättrat

- Matrundans grupp- och platsflöden har fått en sammanhållen UX-genomgång.

## [1.31.0] – 2026-08-24

### Nytt

- Sparade sökområden kan använda geografiska gränser utan att begränsa
  sökningen till området.

## [1.30.0] – 2026-08-23

### Förbättrat

- Matrundans platsdata och manuella fallbackflöden har härdats inför
  plattformsmigreringen.

## [1.29.0] – 2026-08-22

### Förbättrat

- Manuellt tillagda ställen återanvänder kanonisk identitet när en extern källa
  senare kopplas.

## [1.28.0] – 2026-08-21

### Förbättrat

- Gruppens praktiska platsinformation kan synkas utan att exponera privat
  gruppdata.

## [1.27.0] – 2026-08-20

### Förbättrat

- Besök, gäster och historik visas tydligare och mer konsekvent i gruppen.

## [1.26.2] – 2026-08-19

### Rättat

- Mindre korrigeringar efter föregående release.
