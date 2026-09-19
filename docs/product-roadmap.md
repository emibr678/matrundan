# Produktroadmap och backlog

Det här dokumentet är den kanoniska översikten över Matrundans beslutade
produktinriktning, prioriterade paket och aktiva feature-issues.

Roadmapen ska göra det möjligt att fortsätta arbetet i en ny chatt eller
arbetsmiljö utan att tidigare produktdiskussioner behöver återberättas.
GitHub Issues innehåller det detaljerade scopet för varje funktion. Aktuell kod,
databas och arkitekturdokumentation är fortfarande källan till sanningen för hur
produkten faktiskt är implementerad.

## Produktprincip

Matrundan är en privat, gruppcentrerad app för vänner och familjer som vill
upptäcka, välja, besöka och minnas matställen tillsammans.

En roadmapfunktion ska i första hand hjälpa gruppen att:

1. hitta och samla intressanta matställen;
2. bestämma nästa gemensamma stopp;
3. dokumentera verkliga besök och faktiska deltagare;
4. förstå och fortsätta sin gemensamma mathistorik.

Sökning, kartor, statistik, rekommendationer, personalisering och gamification är
stöd för den gemensamma matresan. De får inte göra Matrundan till en offentlig
restaurangkatalog, individuell matdagbok, social feed eller global ranking.

## Källor och ansvar

- **Det här dokumentet** beskriver paket, prioritering och varaktiga
  produktbeslut.
- **GitHub Issues och deras labels** är den operativa backloggen: de beskriver
  användarbehov, överenskommet scope, status, prioritet och beslutad relativ
  arbetsordning för en konkret funktion.
- **GitHub Project** är den människovänliga översikten över samma issues och
  labels. Projektet får även innehålla buggar, maintenance och andra issues som
  inte hör hemma i produktroadmapen, men ska inte skapa en parallell
  prioriteringssanning.
- **`docs/architecture.md`** beskriver varaktiga arkitektur- och
  säkerhetsbeslut.
- **`docs/development-workflow.md`** beskriver planering, godkännande,
  implementation, verifiering, merge och publicering.
- **Kod och migrationer på `main`** visar vad som faktiskt är implementerat.

En chatt är aldrig den enda källan till ett produktbeslut. När en diskussion är
klar ska slutsatserna föras in i relevant issue och vid behov i roadmapen.

## Backlogflöde

### Statusetiketter

- `status:inbox` – ny idé som ännu inte har produktbedömts.
- `status:agreed` – produktinriktning och huvudscope är överenskomna.
- `status:ready` – aktuell implementationsplan finns och implementationen är
  uttryckligen godkänd.
- `status:blocked` – arbetet kan inte fortsätta innan ett beskrivet hinder är
  löst.

En PR visar normalt att arbetet pågår. När en PR mergas kan dess issue stängas.
Merge innebär inte att databas, Lovable-preview eller publik app är driftsatt.
Ett stängt issue är den kanoniska signalen för att arbetet är genomfört; en
separat `status:done`-etikett behövs därför inte.

### Prioritetsetiketter

- `priority:now` – grundplatta eller närmast prioriterade arbete.
- `priority:next` – nästa större produktsteg när pågående paket är klart.
- `priority:later` – överenskommen riktning som väntar på tidigare beroenden.

Prioritet beskriver **horisont**, inte en fullständig sortering. När en exakt
relativ arbetsordning är beslutad används `order:*`.

### Ordningsetiketter

- `order:010`, `order:020`, `order:030` och så vidare anger den beslutade
  relativa ordningen i den operativa arbetskön.
- Ett öppet issue får ha högst en `order:*`-label.
- Endast arbete som faktiskt har en beslutad plats i kön ska få `order:*`.
  Avsaknad av `order:*` betyder **inte exakt sekvenserad**, inte bortglömd.
- Inbox och större delen av `priority:later` ska normalt lämnas oordnade tills
  deras inbördes plats faktiskt spelar roll. Undvik falsk precision.
- Tiosteg används för att göra det möjligt att infoga nytt arbete mellan två
  befintliga steg utan att rutinmässigt numrera om hela kön.
- Ett parent-/epic-issue som spänner över flera leveranser ska normalt inte ha en
  egen `order:*`; de konkreta levererbara delarna rangordnas i stället.
- För issues som ingår i roadmapen får `order:*` och roadmapens relativa ordning
  inte motsäga varandra.

### Typetiketter

- `type:feature`
- `type:bug`
- `type:maintenance`

### Från idé till release

1. Registrera idén som ett issue med `status:inbox`.
2. Produktbedöm idén mot den gemensamma matresan.
3. Dokumentera överenskommet scope och icke-mål och sätt `status:agreed`.
4. Ge `order:*` först när den relativa platsen i den aktiva kön faktiskt är
   beslutad.
5. Inspektera aktuell kod, databas och dokumentation när funktionen närmar sig
   implementation.
6. Lägg en konkret implementationsplan i issuen.
7. Invänta uttryckligt implementationsgodkännande och sätt därefter
   `status:ready`.
8. Implementera i avgränsad branch/PR och verifiera enligt utvecklingsflödet.
9. Merge, databasdriftsättning och publicering kräver sina respektive separata
   godkännanden.

Redan överenskomna produktbeslut ska inte diskuteras om från början i en ny
chatt. De får omprövas när aktuell kod, nya fakta eller ett tydligt
produktproblem visar att beslutet behöver ändras.

## Aktuell produktstatus och närmaste horisont

Under augusti–september 2026 har flera tidigare beroenden försvunnit:

- Paket B – Sök och geografi är genomfört.
- Nästa stopp v2 är genomfört.
- Paket E:s grund för kanoniska besök, faktisk deltagarstatus, flera deltagares
  omdömen, dubblettskydd och gäst→medlem-bekräftelse är genomförd.
- #197 har stabiliserat besökskontext med `Något att dricka` och separat
  `Hämtmat`.
- #307 har etablerat den historiskt frysta reviewmodellen och transparent härlett
  helhetsbetyg.
- #331 / PR #334 har tydliggjort Matställen-vyn, `Passar för`-topplistan och
  gruppens ställen.
- #309 / PR #347 har gjort datum, besökskontext och faktiska deltagare
  korrigerbara på samma kanoniska besök.
- #198 / PR #354 har gjort topplistan filtrerbar på verkliga besökstillfällen,
  `Passar för` och Hämtmat med gruppens relevanta historik som betygsunderlag.

Backloggen revaliderades därför 2026-09-16 mot aktuell `main`. Två tidigare
issues togs ur aktiva kön:

- **#200 Uppmuntra faktiska deltagare att komplettera saknad platsmetadata efter
  besök** stängdes som överspelad i sin föreslagna form. #307 löser redan saknat
  `Passar för` där det behövs inför ett scorebart besök; generell
  efterbesöks-nagging ska inte införas.
- **#132 Gör saknad säker gatuadress handlingsbar i kontrollflödet** stängdes som
  absorberad av det bredare #133.

### Genomförd gruppskalning

**#318 Skala gruppbyte, igenkänning och grupphantering när användaren tillhör
många grupper** är genomförd via PR #343.

Den beslutade modellen behåller direktväxling när grupperna är få och använder
nuvarande + senast använda grupper samt **Alla grupper** när de blir fler.
Grupper kan ha en kort privat beskrivning; i **Alla grupper** används annars
andra medlemmars namn som igenkänningsfallback. Lösningen inför ingen
grupphierarki, implicit cross-group-historik eller tung workspace-administration.

Sökning, personlig pinning/döljning och ytterligare separation mellan konto- och
gruppnavigation tas endast upp som nya avgränsade issues om verkligt användande
visar behov.

### Senast genomförda kärnleveranser

**#309 Redigera besöksuppgifter och deltagare i efterhand** är genomförd via
PR #347, **#198 Filtrera topplistor efter besökstillfälle och hämtmat** via
PR #354 och **#199 Tydliggör platsmetadata: Typ av ställe, Kök och inriktning
och Passar för** via PR #346.

Tillsammans gör de den kanoniska besökshistoriken både korrigerbar och direkt
användbar när gruppen väljer nästa ställe, samtidigt som platsens olika
metadata-dimensioner har ett begripligt användarspråk.

### Nästa produktblock – gemensamma besöksbilder

Efter #309, #198 och #199 är **Paket E:s besöksbilder nästa beslutade
produktblock**. De två leveranserna planeras tillsammans men genomförs separat:

1. **#338 Stöd flera deltagares foton på samma kanoniska besök** –
   `status:ready`, `priority:next`. Högst en aktiv bild per faktisk deltagare,
   individuellt ägarskap och ett kompakt gemensamt galleri på besöket.
2. **#179 Dela besöksfoto uttryckligen tillsammans med delat besök** –
   `status:agreed`, `priority:next`. Bygger därefter uttrycklig, serverstyrd
   cross-group-synlighet ovanpå samma mediaobjekt och ägarskap.

Ingen `order:*`-label behövs för att uttrycka mer precision än så: #338
levereras först och #179 följer inom samma produktblock. **#157 Lägg ett
befintligt matställe i en annan av mina grupper utan att dela besök** är fortsatt
relevant men återgår till den senare produktkön efter detta block.

## Paket A – Grundplatta och konsekvens

Grundnivån är genomförd genom #107, #108, #104 och #103. Återstående arbete är
polish och får inte tränga undan kärnflödet.

- **#105 Utökat emoji- och symbolstöd för grupper och matställen** –
  `status:agreed`, `priority:later`. Följ #318:s beslut om gruppigenkänning när
  relevant.
- **#135 Härled representativa matställessymboler från kök och inriktning** –
  `status:inbox`, `priority:later`. #199 är genomförd och blockerar inte längre;
  revalidera när neutral platsidentitet eller symbolval visar sig vara ett konkret
  problem.

## Paket D – Personlig inspiration

**Prioritet:** senare, efter gruppskalning och de närmaste kärnleveranserna.

1. **#109 Personlig yta med Min matresa och Mina favoriter** – fortsatt giltig,
   men ska inte själv designa `Mina grupper` eller gruppnavigation. Den delen
   följer #318. Första framtida leverans bör sannolikt börja med personlig yta +
   Mina favoriter före full statistik.
2. **#102 Genererade personliga avatarer** – varm personlig polish med lokal
   eller integritetssäker seedad avatar; ingen offentlig profil eller avancerad
   avatarbyggare.

Personliga funktioner får inte skapa global progression, offentlig profil eller
en individuell matdagbok som konkurrerar med gruppens gemensamma matresa.

## Paket E – Gemensamma besöksminnen

**#169 Bekräfta deltagande och komplettera gemensamma besök** ligger kvar som
parent och varaktigt produkt-/integritetskontrakt, inte som egen leverans i kön.
Parenten bär bland annat invariants för faktisk närvaro, ett identifierat
deltagande per `(visit, user)`, ett aktivt eget omdöme per `(visit, user)` och
cross-group-minimering.

Genomförda delar omfattar #203, #204, #101, #213, #214, #197, #307 och #309.

Kvarvarande närliggande leveranser, i beslutad arbetsföljd:

1. **#338 Stöd flera deltagares foton på samma kanoniska besök** –
   `status:ready`, `priority:next`; en privat deltagarbild var och kompakt
   gemensamt besöksgalleri.
2. **#179 Dela besöksfoto uttryckligen tillsammans med delat besök** –
   `status:agreed`, `priority:next`; avgränsad cross-group-mediaåtkomst som
   byggs efter #338.

Alla funktioner i paketet ska vara förankrade i verkliga kanoniska besök och får
inte skapa global feed, offentlig social graf eller progression för social
aktivitet.

## Paket F – Kanonisk platsidentitet och återanvändning

**Prioritet:** senare.

1. **#157 Lägg ett befintligt matställe i en annan av mina grupper utan att dela
   besök** – närmaste produktvärdet i paketet. #156 är redan genomfört och
   blockerar inte längre. Gruppväljaren ska återanvända #318:s mönster.
2. **#158 Stöd platsalias och säker sammanföring av kanoniska
   matställesdubletter** – fortsatt relevant men tungt historiskt
   datakvalitetsarbete. Flytta fram först när faktiska dubbletter motiverar
   migrations- och integritetsrisken.

Paketet ska stärka kanonisk identitet utan offentlig platskatalog eller läckage
av vilka andra grupper som använder samma plats.

## Paket G – Gruppens platskunskap och historikbaserad vägledning

**#198 Filtrera topplistor efter besökstillfälle och hämtmat** är genomförd via
PR #354. Den befintliga `Passar för`-topplistan kan nu kombineras med verkliga
besökstillfällen och Hämtmat, och det synliga betyget härleds från relevanta
besök/reviews utan dold statistisk score.

**#199 Tydliggör platsmetadata: Typ av ställe, Kök och inriktning och Passar
för** är genomförd via PR #346. **#200** är stängt som överspelat. Saknat `Passar för` hanteras redan i relevant
platscentrerad kontext inför scorebara besök; generell efterbesöks-prompt för
metadata ska inte återinföras utan nytt konkret behov.

Datan får vara rikare än UI:t. Härledda signaler ska bara visas där de hjälper
gruppen välja nästa ställe och får inte skapa ett separat statistiksystem.

## Platsrättning och datakvalitet i användarflödet

**#133 Samla rättning och komplettering av platsuppgifter i ett begripligt
flöde** ligger fortsatt `priority:later` som den bredare framtida produktfrågan
för adress, webbplats och öppettider.

**#132** är stängt som absorberat av #133. Saknad säker adress ska alltså lösas i
det sammanhållna flödet i stället för genom en separat specialväg.

## Parallellt maintenance- och kvalitetsspår

Maintenance konkurrerar inte automatiskt med produktroadmapen. Små blockerande
eller tillitskritiska korrigeringar får göras mellan produktsteg; större DX- och
refaktoriseringsarbete prioriteras först när det ger konkret utvecklingsnytta.

- **#207 Frikoppla drift från Lovable Cloud och etablera portabel plattform** har
  genomfört kärnmigrationen och är fortsatt separat plattformsspår för sista
  legacy-avvecklingen.
- **#127 DX2B: Konsolidera Playwright-fixtures och minska sköra layouttester** och
  **#128 DX2C: Inför ändringsfragment och separat release-PR** ligger kvar som
  oordnad maintenance-inbox.
- **#296 Slutför public-repo polish och kosmetisk kodhygien** är kosmetisk
  maintenance och ska inte tränga undan produktkön.
- **#143 Utred föräldralöst objekt i besöksfoto-bucketen** är ett separat
  driftfynd; ingen destruktiv åtgärd får göras utan uttryckligt godkännande.

## Genomförda paket

Roadmapen ska inte återge full releasehistorik. Den finns i stängda issues,
mergade PR:er, `CHANGELOG.md` och vid behov `docs/architecture.md`.

- ✅ **Paket B – Sök och geografi** – genomfört genom #147, #148, #156, #155,
  #163 och #149; sista steget mergades via PR #180.
- ✅ **Paket C – Nästa stopp v2** – genomfört genom #106 via PR #223.
- ✅ **Paket A:s grundnivå** – #107, #108, #104 och #103 är genomförda;
  kvarvarande #105/#135 är senare polish.

## Exempelgruppen som permanent kontrakt

Exempelgruppen ska hållas aktuell med produktens bredd utan att växa till
produktionslik volym. Varje större feature-issue och PR ska besvara:

> Behöver exempelgruppen eller dess scenariokontrakt uppdateras för att visa och
> verifiera den här funktionen?

Ett nej ska motiveras när ändringen påverkar ett användarflöde men exempeldata
inte uppdateras.

## Löpande prioritering

Nya idéer läggs först i inboxen. De ska inte automatiskt bredda ett pågående
paket. När nästa arbete väljs bedöms:

1. om idén stärker den gemensamma matresan;
2. om den löser ett viktigare problem än nuvarande prioritering;
3. vilka beroenden och integritetsrisker som finns;
4. om den hör till ett befintligt paket eller ett nytt framtida paket;
5. om roadmapen behöver uppdateras.

När ett paket avslutas ska nästa paket inte automatiskt flyttas till
`priority:now`. Om prioriteringen ändras ska roadmap och berörda issues hållas
synkade utan att skapa artificiell `order:*`-precision.

GitHub Project används som den operativa, människovänliga översikten över öppna
issues. Vyer och sortering ska i första hand bygga på issue-state och labels
(`status:*`, `priority:*`, `type:*`, `order:*`). Project-only metadata får inte
vara den enda källan till status, prioritet eller ordning.

## När roadmapen uppdateras

Uppdatera dokumentet när:

- ett paket eller en prioritering ändras;
- den relativa `order:*`-ordningen mellan roadmap-issues ändras;
- ett varaktigt produktbeslut tillkommer eller tas bort;
- ett övergripande feature-issue delas upp eller ersätts;
- en funktion är genomförd och påverkar den kvarvarande produktkön;
- en backloggrevision visar att tidigare beroenden eller scope inte längre är
  aktuella.

Roadmapen ska normalt **inte** uppdateras för varje commit, liten buggrättning
eller teknisk implementationdetalj som redan hör hemma i kod, PR eller
arkitekturdokumentation.
