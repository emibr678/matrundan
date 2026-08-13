# Produktroadmap och backlog

Det här dokumentet är den kanoniska översikten över Matrundans beslutade produktinriktning, prioriterade paket och aktiva feature-issues. GitHub Issues bär detaljerat scope; aktuell kod, databas och arkitektur visar vad som faktiskt är implementerat.

## Produktprincip

Matrundan är en privat, gruppcentrerad app för vänner och familjer som vill upptäcka, välja, besöka och minnas matställen tillsammans. Roadmapen prioriterar därför gruppens kärnloop: samla ställen → bestäm nästa stopp → registrera faktiska deltagare och besök → bygg ett gemensamt privat minne → använd historiken till nästa upplevelse.

Sökning, kartor, statistik, rekommendationer, personalisering och gamification är stöd. De får inte göra Matrundan till en offentlig restaurangkatalog, individuell matdagbok, social feed eller global ranking.

## Backlogflöde

- `status:inbox` – ny idé.
- `status:agreed` – produktinriktning och huvudscope är överenskomna.
- `status:ready` – aktuell plan finns och implementationen är uttryckligen godkänd.
- `status:blocked` – ett beskrivet hinder stoppar arbetet.
- `priority:now` – närmast prioriterade arbete.
- `priority:next` – nästa större produktsteg.
- `priority:later` – överenskommen riktning som väntar.

En implementerande PR refererar eller stänger sitt issue. Merge, databasdriftsättning och publicering är separata steg. En chatt får aldrig vara enda källan till ett varaktigt produktbeslut.

## Aktuellt arbete

**Paket B – Sök och geografi** är genomfört; sista steget #149 genomfördes i v1.31.0 via PR #180.

**Paket A – Grundplatta och konsekvens** har nått tillräcklig grundnivå för att gå vidare i kärnprodukten. **#104 Tydligare informationsarkitektur i gruppinställningarna** genomfördes i v1.32.0 via PR #190 och **#103 Central Matrundan-symbol och konsekvent varumärkesanvändning** i v1.33.0 via PR #194. #105 och #135 ligger kvar som senare symbolpolish.

Närmaste ordning är:

1. **#189 Uppdatera guest-privacy-preflight efter v5h-wrappern** – litet maintenance-steg så driftpreflighten åter blir tillförlitlig.
2. **#169 Bekräfta deltagande och komplettera gemensamma besök** – första avgränsade leveransen med eget omdöme för identifierade deltagare, självkorrigering av deltagande och korrekt kanonisk deltagarsanning.
3. **#106 Nästa stopp v2: alternativ för plats och tid utan överskrivning** – nästa större planeringssteg i kärnloopen.
4. **#101 Privata kommentarer och reaktioner på besök** – privat socialt lager kring gruppens verkliga besöksminnen.
5. Fortsatt #169 för känsligare cross-group-identitetsfall och därefter **#179 Dela besöksfoto uttryckligen tillsammans med delat besök**.

## Paket A – Grundplatta och konsekvens

**Prioritet:** `priority:later` för återstående delar

- ✅ **#107 Levande exempelgrupp med scenariokontrakt** – v1.26.3 via PR #138.
- ✅ **#108 Gemensamt visuellt språk för platskandidater och tillagda matställen** – v1.27.0 via PR #151.
- ✅ **#104 Tydligare informationsarkitektur i gruppinställningarna** – v1.32.0 via PR #190.
- ✅ **#103 Central Matrundan-symbol och konsekvent varumärkesanvändning** – v1.33.0 via PR #194.
- **#105 Utökat emoji- och symbolstöd för grupper och matställen** – kurerade symbolval och gruppspecifikt manuellt val; ingen bilduppladdning.
- **#135 Härled representativa matställessymboler från kök och inriktning** – automatisk fallback från normaliserad inriktning, kök och kategori; ligger i inbox tills scope blir aktuellt igen.

## Paket E – Gemensamma besöksminnen

**Prioritet:** `priority:now` för första delen av #169

Paketet stärker steget efter ett verkligt besök: vilka var faktiskt med, vad tyckte var och en och hur blir händelsen ett gemensamt privat minne.

### #169 Bekräfta deltagande och komplettera gemensamma besök

Första prioriterade leveransen:

- identifierad faktisk deltagare kan lägga sitt eget omdöme på samma kanoniska besök;
- deltagaren kan välja **Jag var inte med** och senare återställa **Jag var med**;
- progression, statistik och aktivt deltagaromdöme följer korrigerad deltagarsanning;
- samma identifierade deltagande återanvänds när samma kanoniska besök visas i flera grupper där användaren redan är medlem;
- registreraren får inte ett aktivt deltagaromdöme om hen själv inte var deltagare;
- dubblettskydd är konservativt och får bara använda besök som aktuell användare legitimt får känna till.

Gäst→medlem-koppling över gruppgräns, mottagarens bekräftelse och mer avancerad deduplicering kommer senare. Namn är presentation, aldrig identitet.

### #101 Privata kommentarer och reaktioner på besök

**Prioritet:** `priority:next`, efter #106

Kommentarer och enkla reaktioner hör till **gruppens besökslänk**, inte till det kanoniska besöket globalt. Delade besök får aldrig föra med ursprungsgruppens diskussion. Ingen progression, offentlig feed eller globala likes.

### #179 Dela besöksfoto uttryckligen tillsammans med delat besök

**Prioritet:** `priority:later`

Fotoåtkomst ska vara uttrycklig och serverstyrd per målgrupp. Mottagargruppen får inte ursprungsgruppens identitet eller rätt att ändra originalfotot. Arbetet görs efter att #169:s besöks- och deltagarsemanik är stabil.

## Paket C – Nästa stopp v2

**Prioritet:** `priority:next`, efter första leveransen av #169

- **#106 Nästa stopp v2: alternativ för plats och tid utan överskrivning**

Gruppen ska kunna föreslå alternativa matställen och flera tider utan att ett nytt förslag skriver över det som redan diskuteras. Frågorna **vart** och **när** hålls separata. Stor plats × datum-matris och automatisk majoritetsvinnare är icke-mål.

## Paket D – Personlig inspiration

**Prioritet:** `priority:later`

1. **#109 Personlig yta med Min matresa och Mina favoriter**.
2. **#102 Genererade personliga avatarer**.

Personliga funktioner får inte skapa offentlig profil, global ranking eller en individuell matdagbok som konkurrerar med gruppens gemensamma matresa.

## Paket F – Kanonisk platsidentitet och återanvändning

**Prioritet:** `priority:later`

1. **#157 Lägg ett befintligt matställe i en annan av mina grupper utan att dela besök** – återanvänd samma kanoniska `place_id`; privata gruppuppgifter och besök följer inte med.
2. **#158 Stöd platsalias och säker sammanföring av kanoniska matställesdubletter** – konservativa alias/dubblettkandidater och explicit administrativ merge; ingen fuzzy automatisk massmerge.

## Parallellt maintenance- och kvalitetsspår

Maintenance konkurrerar inte automatiskt med produktroadmapen. Små tillitskritiska korrigeringar får göras mellan produktsteg; större DX-arbete prioriteras när det ger konkret utvecklingsnytta.

- **#189 Uppdatera guest-privacy-preflight efter v5h-wrappern** ligger närmast.
- **#127 DX2B**, **#128 DX2C**, **#129 DX2D1** och **#130 DX2D2** ligger kvar som underhållsskuld.
- **#143 Utred föräldralöst objekt i besöksfoto-bucketen** är separat driftfynd; ingen destruktiv åtgärd utan uttryckligt godkännande.
- **#133 Samla rättning och komplettering av platsuppgifter i ett begripligt flöde** är den bredare framtida platsdatafrågan. **#132 Gör saknad säker gatuadress handlingsbar i kontrollflödet** behandlas som en lägre prioriterad delmängd tills #133 planeras.

## Genomförda paket

- ✅ **Paket B – Sök och geografi** – #147, #148, #156, #155, #163 och #149; v1.27.1–v1.31.0, sista steget via PR #180.

## Exempelgruppen som permanent kontrakt

Varje större feature-issue och PR ska bedöma om exempelgruppen eller scenariokontraktet behöver uppdateras. Ett nej ska motiveras när ändringen påverkar ett användarflöde.

## Löpande prioritering

När nästa arbete väljs bedöms produktvärde för den gemensamma matresan, problemets vikt, beroenden/integritetsrisk, paketplacering och roadmapbehov. Ett paket flyttas inte automatiskt till `priority:now`; ändrad prioritering ska synkas mellan roadmap och issues.

## När roadmapen uppdateras

Uppdatera dokumentet när paket/prioritet eller ett varaktigt produktbeslut ändras, ett övergripande issue delas upp/ersätts eller en större funktion/paket markeras genomfört. Uppdatera inte för varje commit, liten buggrättning eller ren implementationdetalj.
