# Produktinriktning och backlogmodell

Det här dokumentet är Matrundans kanoniska översikt över långsiktig
produktinriktning och hur den operativa backloggen ska tolkas.

Det är medvetet **inte** en lista över aktuella Issues, deras status eller exakt
arbetsordning. Den levande kön finns i GitHub Issues och labels. GitHub Project
är en människovänlig vy av samma data.

## Produktprincip

Matrundan är en privat, gruppcentrerad app för vänner och familjer som vill
upptäcka, välja, besöka och minnas matställen tillsammans.

Kärnflödet är:

1. samla ställen gruppen är nyfiken på;
2. bestäm nästa gemensamma stopp;
3. registrera verkliga besök och faktiska deltagare;
4. bygg en privat gemensam historik;
5. använd historiken som inspiration till nästa gemensamma upplevelse.

Sökning, kartor, statistik, rekommendationer, personalisering och gamification är
stöd för den gemensamma matresan. De får inte göra Matrundan till en offentlig
restaurangkatalog, individuell matdagbok, social feed, global ranking eller
generisk karttjänst.

## Strategiska teman

De här temana beskriver riktningen utan att skapa fasta paket eller en parallell
Issue-hierarki.

### Upptäcka och samla

Det ska vara enkelt för gruppen att hitta, förstå och spara verkliga matställen.
Sökning, geografi och platsmetadata ska hjälpa valet utan att bli en offentlig
katalog.

### Välja nästa gemensamma stopp

Gruppen ska kunna gå från sparade idéer och tidigare erfarenheter till ett
konkret nästa stopp. Planering och historikbaserad vägledning ska vara tydliga
stöd, inte automatiska beslut åt gruppen.

### Besöka och minnas tillsammans

Verkliga kanoniska besök, faktiska deltagare, omdömen, bilder och gemensam
historik är produktens minne. Data ska kunna korrigeras utan att historiken
förlorar sin betydelse.

### Grupper, återanvändning och privat delning

Gruppen är den primära produkt- och integritetsgränsen. Kanoniska platser och
besök får återanvändas eller delas säkert mellan grupper, men privata kommentarer,
medlemskap, ursprungsgrupp och annan gruppintern data får inte följa med
implicit.

### Personligt stöd utan individuell huvudprodukt

Favoriter, personlig igenkänning, avatarer och liknande får hjälpa användaren i
den gemensamma matresan. De får inte flytta tyngdpunkten från gruppen till en
individuell matdagbok, offentlig profil eller global progression.

### Tillförlitlig platsdata och hållbar plattform

Platsidentitet, datakvalitet, integritet, testbarhet och en portabel driftmodell
är förutsättningar för produktens tillit. Maintenance får löpa parallellt när det
skyddar leveransförmåga eller data, men ska inte skapa en separat produktagenda.

## Operativ backlog: GitHub är källan

GitHub Issues + labels är den enda operativa källan för:

- konkret scope och aktuella icke-mål;
- status för beslut och implementation;
- prioriteringshorisont;
- exakt relativ arbetsordning när en sådan faktiskt är beslutad.

GitHub Project får visualisera och filtrera samma information men ska inte vara
en separat sanningskälla.

Roadmapen ska därför inte innehålla:

- en aktuell lista över öppna eller stängda Issues;
- kopior av `status:*`, `priority:*` eller `order:*`;
- genomförandelistor med PR-nummer;
- löpande merge-, release- eller leveransstatus.

## Labelmodell

Håll modellen liten. Lägg inte till kategorier som `area:*`, `ux` eller `backend`
bara för att klassificera allt. Nya labeldimensioner införs först när de löser ett
konkret återkommande problem med att hitta, prioritera eller styra arbete.

### Status

- `status:inbox` – ny idé som ännu inte har produktbedömts.
- `status:agreed` – produktinriktning och huvudscope är överenskomna.
- `status:ready` – aktuell implementationsplan finns och implementationen är
  uttryckligen godkänd.

En öppen PR visar normalt att arbete pågår. Ett stängt Issue är den kanoniska
signalen för att leveransen är genomförd; en separat `status:done` behövs inte.

### Prioritet

- `priority:now` – arbete som är aktivt eller behöver hanteras i närtid.
- `priority:next` – nästa produktsteg efter det aktiva arbetet.
- `priority:later` – överenskommen eller möjlig riktning som väntar.

Prioritet beskriver horisont, inte exakt sortering.

### Ordning

`order:*` används bara när en konkret relativ arbetsordning verkligen är
beslutad, exempelvis `order:010`, `order:020` och `order:030`.

- Ett öppet Issue får ha högst en `order:*`-label.
- Avsaknad av `order:*` betyder att arbetet inte är exakt sekvenserat.
- Använd tiosteg så att nytt arbete kan infogas utan massomnumrering.
- Parent-/epic-Issues ska normalt inte få egen ordning när konkreta leveranser
  kan rangordnas i stället.
- Stängda Issues ska inte ligga kvar som operativa köposter.

### Genomförandeform

- `execution:work` – används sparsamt när ett Issue bedöms vinna tydligt på Work,
  exempelvis för tvärgående arbete över flera domäner/lager, längre sammanhängande
  analys/implementation eller förändringar där konsekvensen av en felaktig modell är
  hög.
- Avsaknad av `execution:work` betyder vanlig Chat som standard. Skapa inte en
  separat `execution:chat`-label.
- Genomförandeformen ändrar inte `status:*`, `priority:*` eller `order:*` och
  innebär inte implementations-, merge-, databas- eller publiceringsgodkännande.
- `execution:work` innebär inte automatiskt Lovable; Lovable är fortsatt separat
  opt-in enligt det ordinarie arbetsflödet.

### Typ

- `type:feature`
- `type:bug`
- `type:maintenance`

Typ beskriver arbetets natur och ersätter inte status eller prioritet.

## Från idé till leverans

1. Registrera idén som ett Issue med `status:inbox`.
2. Produktbedöm den mot Matrundans kärnflöde och principer.
3. Dokumentera överenskommet scope och icke-mål och sätt `status:agreed`.
4. Sätt `priority:*` efter faktisk horisont.
5. Lägg till `order:*` endast när exakt relativ ordning behöver beslutas.
6. När arbetet närmar sig implementation: inspektera aktuell kod, datamodell,
   dokumentation och relevanta öppna PR:er.
7. Dokumentera en konkret implementationsplan i Issuet.
8. Efter uttryckligt implementationsgodkännande: sätt `status:ready` och arbeta i
   en avgränsad branch/PR.
9. Merge, databasdriftsättning och publicering följer sina separata
   godkännandegrindar.

Detaljerat leveransflöde finns i
[development-workflow.md](./development-workflow.md).

## Exempelgruppen som kontrakt

Exempelgruppen ska fortsätta visa produktens viktiga huvudflöden utan att växa
till produktionslik volym. Större produktändringar ska därför uttryckligen bedöma
om exempeldata eller scenariokontrakt behöver uppdateras.

Demo och autentiserat live-läge ska vara begripliga parallellt och får inte
använda olika produktlogik för samma domänregel.

## När det här dokumentet ska ändras

Uppdatera roadmapen när:

- produktvisionen eller kärnflödet ändras;
- ett strategiskt tema tillkommer, tas bort eller ändras materiellt;
- backlog-/labelmodellen ändras;
- ett varaktigt tvärgående produktbeslut behöver synas i den strategiska
  riktningen.

Uppdatera **inte** roadmapen enbart för att:

- ett Issue skapas, omprioriteras, får nytt `order:*` eller stängs;
- en PR öppnas eller mergas;
- en funktion blir klar;
- en release publiceras;
- maintenance genomförs utan att produktstrategin ändras.

Det gör att roadmapen kan vara stabil över tid medan GitHub alltid visar den
aktuella arbetskön.
