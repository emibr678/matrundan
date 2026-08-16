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

## [1.37.0] – 2026-08-16

### Nytt

- Gruppen kan ha flera enkla matställesförslag samtidigt och markera **Går gärna dit**
  på flera alternativ utan automatisk vinnare eller formell röstning.
- **Nästa stopp** kan bära en gemensam dag oberoende av ställe, med valfri
  klocktid först när gruppen faktiskt har bestämt den.
- En medlem kan markera **Kan inte då** på gruppens gemensamma dag utan att
  uteblivet svar tolkas som ett nej eller att Matrundan blir ett RSVP-flöde.
- En passerad planerad dag följs upp med **Blev det av?** så ett verkligt besök
  registreras uttryckligen i stället för att historik gissas fram.

### Förbättrat

- Ett nytt ställesförslag skriver inte längre över gruppens redan valda eller
  diskuterade nästa stopp. Ett verkligt originalbesök avslutar bara relevant
  nästa-stopp-flöde.
- När nästa stopp är valt fokuserar Hem på stället och nästa handling medan
  övriga förslag ligger kollapsade tills gruppen vill ändra valet.

## [1.36.0] – 2026-08-16

### Nytt

- Hem visar en diskret signal för aktuella deltagarbesök där ditt eget omdöme
  saknas och länkar direkt till samma gemensamma besök.
- Besök markerar samma aktuella besök med **Ditt omdöme saknas**, medan äldre
  obesvarade besök ligger kvar i historiken utan framträdande påminnelse.

### Förbättrat

- Påminnelsen följer faktisk deltagarstatus och existensen av ditt kanoniska
  omdöme, så den försvinner när du lämnar omdöme eller korrigerar att du inte
  var med.

## [1.35.1] – 2026-08-16

### Rättat

- Versionshistoriken i appen beskriver nu korrekt att den som registrerar ett
  nytt besök alltid räknas som faktisk deltagare och lämnar sitt eget omdöme.

## [1.35.0] – 2026-08-15

### Förbättrat

- Besöksdetaljen samlar gruppens betygssammanfattning och deltagarnas egna
  omdömen i samma **Gängets omdömen**-yta i stället för flera konkurrerande
  sektioner.
- Ditt omdöme ligger tillsammans med övriga deltagares omdömen, med en enda
  tydlig kompletteringsknapp när du ännu inte har svarat och kompakt redigering
  när omdömet finns.
- Flera omdömen visas kompakt med valfria detaljer. Normal
  deltagarkorrigering ligger sekundärt medan ett tidigare **Jag var inte med**
  fortfarande får ett tydligt återställningsläge.
- Ett befintligt besöksfoto kan inte längre ersättas av en annan deltagare.
  Uppladdaren behåller rätten att byta sin bild medan ägare och admin bara kan
  ta bort någon annans foto som modereringsåtgärd i väntan på flerfotostödet.
- Exempelgruppen innehåller ett 3-av-4-scenario och ett besök utan aktiva
  omdömen så flerpersons- och tomlägen kan granskas utan externa anrop.

## [1.34.0] – 2026-08-14

### Nytt

- Faktiska deltagare som saknar eget omdöme kan komplettera samma kanoniska
  besök med helhetsbetyg, smak, service, prisvärdhet och valfri kommentar utan
  att ett nytt besök skapas.
- En medlem som felaktigt lagts till som deltagare kan välja **Jag var inte med**
  och senare återställa **Jag var med**. Progression och synliga
  deltagaromdömen följer den korrigerade deltagarsanningen.

### Förbättrat

- Den som registrerar ett nytt besök räknas alltid som faktisk deltagare och
  lämnar sitt eget omdöme i samma flöde. Andra deltagare kan fortfarande
  korrigera sin närvaro utan att ett nytt besök skapas.

## [1.33.0] – 2026-08-13

### Förbättrat

- Matrundans egna varumärkesytor använder samma transparenta markering och
  ordmärke i landning, exempelgrupp och inloggat läge i stället för en generisk
  tallriksemoji.
- **Om Matrundan** återanvänder samma dialog och varumärkesmarkering oavsett var
  den öppnas.
- Installeringsikoner för PWA och favicon ligger kvar separat och används inte
  som inline-märke i appens gränssnitt.
- Grupp- och matställeemojis behåller sin innehållsbetydelse och påverkas inte
  av varumärkesändringen.

## [1.32.0] – 2026-08-13

### Förbättrat

- Gruppinställningarna är uppdelade i **Gruppen**, **Sökområden**, **Medlemmar
  och inbjudningar**, **Matställen**, **Besök och progression** samt
  **Gruppstatus** så varje sektion motsvarar en tydlig uppgift i gruppens
  administration.
- Gruppnamn och symbol sparas separat från sökområden och sökavstånd, så en
  ändring inte behöver skriva om den andra delen.
- Dolda sökträffar ligger kvar som gruppspecifikt matställeunderhåll, medan den
  tidigare informationen om en gruppspecifik rapportkö har tagits bort eftersom
  handläggningen sker globalt i **Platsunderhåll**.
- Sällan använda och destruktiva gruppåtgärder ligger samlade sist under
  **Gruppstatus** utan att ändra befintliga roller eller behörigheter.
- **Om Matrundan** med aktuell version och versionshistorik ligger i profil- och
  inloggningsmenyn i stället för bland gruppens inställningar.

## [1.31.0] – 2026-08-13

### Nytt

- Gruppinställningar har en egen sektion för **Besök och progression** där ägare
  och admin kan välja om delade besök ska räknas i gruppens progression.
- Gruppen kan sätta valfritt `@username` på sin öppna inbjudningslänk och dela
  den läsbara länken direkt från samma dialog.

### Förbättrat

- Nya grupper räknar delade besök mot progression som standard, medan äldre
  grupper behåller sitt tidigare beteende tills inställningen ändras.
- Inställningen för delade besök och valet av inbjudnings-username ligger kvar
  efter omladdning och skyddas av samma owner/admin-regler som gruppens övriga
  inställningar.

## [1.30.0] – 2026-08-13

### Nytt

- Profilmenyn visar Matrundans varumärke, aktuell appversion och en direktlänk
  till **Om Matrundan** med versionshistorik.
- **Om Matrundan** beskriver den privata gruppresan från matställen via
  gemensamma besök till nästa stopp och återanvänder samma versionshistorik som
  adminytan.

### Förbättrat

- Appmetadata beskriver Matrundan som en privat gruppcentrerad matresa i stället
  för en restaurangkatalog.

## [1.29.0] – 2026-08-12

### Nytt

- Besöksdelning kan nu koppla samma kanoniska besök till flera av användarens
  grupper utan att skapa dubbla historikposter.

### Förbättrat

- Delade besök visar bara grupprelevant information och räknas inte automatiskt
  i mottagargruppens progression innan gruppen uttryckligen valt det.

## [1.28.0] – 2026-08-12

### Nytt

- Gruppens dolda sökträffar kan återställas från gruppinställningarna.

### Förbättrat

- Dolda sökträffar och gruppens sökområden fortsätter vara privata för gruppen.

## [1.27.0] – 2026-08-11

### Nytt

- Platssökning kan återanvända ett manuellt tillagt kanoniskt ställe från en
  annan grupp utan att exponera ursprungsgrupp, medlemskap eller privata fält.

### Förbättrat

- Manuella ställen kan säkert länkas till en extern källa i efterhand utan att
  gruppens historik eller referenser bryts.
