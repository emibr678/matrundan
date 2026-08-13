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
- **GitHub Issues** beskriver användarbehov, överenskommet scope, icke-mål,
  öppna beslut, integritet, exempeldata och verifiering för en konkret funktion.
- **`docs/architecture.md`** beskriver varaktiga arkitektur- och
  säkerhetsbeslut.
- **`docs/development-workflow.md`** beskriver planering, godkännande,
  implementation, verifiering och publicering.
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

### Typetiketter

- `type:feature`
- `type:bug`
- `type:maintenance`

### Från idé till release

1. Registrera idén som ett issue med `status:inbox`.
2. Produktbedöm idén mot den gemensamma matresan.
3. Dokumentera överenskommet scope och icke-mål i issuen och sätt
   `status:agreed`.
4. Inspektera aktuell kod, databas och dokumentation när funktionen närmar sig
   implementation.
5. Lägg en konkret implementationsplan i issuen.
6. Invänta uttryckligt implementationsgodkännande och sätt därefter
   `status:ready`.
7. Implementera i en avgränsad branch och PR som refererar eller stänger
   issuen.
8. Verifiera och merge enligt utvecklingsflödet.
9. Bekräfta efter merge att rätt issue stängdes och ta bort `status:ready` om
   etiketten ligger kvar.
10. Driftsätt databas och publicera endast efter separat uttryckligt
    godkännande.

Redan överenskomna produktbeslut ska inte diskuteras om från början i en ny
chatt. De får omprövas när aktuell kod, nya fakta eller ett tydligt
produktproblem visar att beslutet behöver ändras.

## Aktuellt arbete

Driftgrinderna **#142 Nygenererad öppen inbjudningslänk behandlas som redan
använd** och **#137 Återställ produktionsvakter för sökområden och besöksfoton**
har genomförts i v1.26.5 respektive v1.26.4. **#108 Gemensamt visuellt språk för
platskandidater och tillagda matställen** genomfördes i v1.27.0.

**Paket B – Sök och geografi** är genomfört. Det sista steget, **#149 Stöd
geografiska boundaries och visualisera sökområden på kartan**, genomfördes i
v1.31.0 via PR #180.

Efter den planerade avstickaren till Paket B återupptogs **Paket A – Grundplatta
och konsekvens**. **#104 Tydligare informationsarkitektur i
gruppinställningarna** genomfördes i v1.32.0 via PR #190. Nästa roadmap-issue är
**#103 Central Matrundan-symbol och konsekvent varumärkesanvändning**. **Paket C
– Nästa stopp v2** förblir nästa större kärnproduktsteg efter de återstående
prioriterade delarna av Paket A.

## Paket A – Grundplatta och konsekvens

**Prioritet:** `priority:now`

Paketet förbättrar produktens konsekvens och skapar bättre förutsättningar för
kommande funktioner. Varje issue genomförs normalt i en egen branch och PR.
Efter #108 gick arbetet till Paket B. Paket B är nu genomfört, #104 är klar och
Paket A fortsätter med #103.

Intern ordning när Paket A återupptas:

1. ✅ **#107 Levande exempelgrupp med scenariokontrakt**  
   Gör exempelgruppen till en liten, representativ och löpande underhållen
   produktfixture. Genomförd i v1.26.3 via #138. Nya större funktioner ska
   bedöma behovet av nya exempeldata och regressionsscenarier.
2. ✅ **#108 Gemensamt visuellt språk för platskandidater och tillagda
   matställen**  
   Återanvänd platsidentitet och visuell hierarki utan att göra sökresultat och
   detaljvy innehållsmässigt identiska. Genomförd i v1.27.0 via #151.
3. ✅ **#104 Tydligare informationsarkitektur i gruppinställningarna**  
   Organisera gruppytan efter konkreta uppgifter och separera gruppspecifikt
   innehåll från personliga app- och kontoinställningar. Genomförd i v1.32.0 via
   PR #190.
4. **#103 Central Matrundan-symbol och konsekvent varumärkesanvändning**  
   Använd en central varumärkeskomponent där symbolen representerar Matrundan,
   men behåll matsymboler där de representerar grupper eller matställen.
5. **#105 Utökat emoji- och symbolstöd för grupper och matställen**  
   Utöka kurerade symbolval och stöd ett gruppspecifikt manuellt val.
   Bilduppladdning ingår uttryckligen inte i detta scope.
6. **#135 Härled representativa matställessymboler från kök och inriktning**  
   Ge ställen en stabil automatisk symbol från normaliserad inriktning, kök och
   kategori när ingen uttrycklig symbol finns. Manuellt gruppval ska ha
   företräde och breda eller motstridiga utbud ska få en neutral fallback.

## Paket C – Nästa stopp v2

**Prioritet:** `priority:next`, efter återstående prioriterade delar av Paket A

- **#106 Nästa stopp v2: alternativ för plats och tid utan överskrivning**

Det här är nästa större kärnproduktsteg efter grundplattan. Gruppen ska kunna
föreslå alternativa matställen och flera tider utan att ett nytt förslag skriver
över det som redan diskuteras. Frågorna **vart** och **när** hålls separata,
medan ett aktuellt nästa stopp förblir tydligt.

Det övergripande issuen får delas i mindre underissues efter en aktuell
arkitektur- och implementationsplan. En stor plats × datum-matris och automatisk
majoritetsvinnare är uttryckliga icke-mål.

## Paket D – Personlig inspiration

**Prioritet:** `priority:later`, efter Paket C

Rekommenderad ordning:

1. **#109 Personlig yta med Min matresa och Mina favoriter**  
   Börja med en tydlig personlig yta och Mina favoriter. Lägg därefter till
   deduplicerad privat statistik över användarens faktiska deltagande i flera
   grupper. Gruppspecifika profiler, progression och privat innehåll förblir
   isolerade.
2. **#102 Genererade personliga avatarer**  
   Lägg till enkel lokal eller integritetssäker avatargenerering med seed och
   möjlighet att slumpa om. Ingen avancerad avatarbyggare eller uppladdning av
   egna profilbilder ingår.

Personliga funktioner får inte skapa offentlig profil, global ranking eller en
individuell matdagbok som konkurrerar med gruppens gemensamma matresa.

## Paket E – Gemensamma besöksminnen

**Prioritet:** `priority:later`

Rekommenderad ordning fastställs när paketet prioriteras. Tre separata behov är
redan överenskomna:

- **#169 Bekräfta deltagande och komplettera gemensamma besök**  
  Låt faktiska deltagare självkorrigera felaktig deltagarstatus och komplettera
  samma kanoniska besök med eget omdöme. Vid delning får en fri gäst endast
  kopplas till en medlem i målgruppen genom ett uttryckligt val följt av den
  utpekade personens bekräftelse. Namn är presentation, aldrig identitet; ingen
  fuzzy personmatchning, besöksdublett eller cross-group exponering får uppstå.
- **#179 Dela besöksfoto uttryckligen tillsammans med delat besök**  
  Låt användaren uttryckligen välja om ett privat besöksfoto ska följa med till
  en viss målgrupp när samma kanoniska besök delas. Fotoåtkomsten ska vara
  serverstyrd per målgrupp och får inte exponera ursprungsgrupp eller ge
  mottagargruppen rätt att ändra originalfotot.
- **#101 Privata kommentarer och reaktioner på besök**  
  Lägg privat gruppdiskussion och enkla reaktioner på gruppens besökslänk.

Funktionerna ska vara förankrade i ett verkligt kanoniskt besök och stärka
gruppens gemensamma minne. #169 gäller sann deltagaridentitet och strukturerade
personliga omdömen på samma besök, #179 gäller uttrycklig och behörighetsstyrd
fotodelning och #101 gäller privat gruppdiskussion kring besöket. Ingen av
funktionerna får skapa global feed, offentlig social graf, offentliga likes eller
progression för social aktivitet.

## Paket F – Kanonisk platsidentitet och återanvändning

**Prioritet:** `priority:later`

Rekommenderad ordning:

1. **#157 Lägg ett befintligt matställe i en annan av mina grupper utan att dela
   besök**  
   Gör återanvändning av samma kanoniska `place_id` explicit från en redan känd
   plats. Endast målgruppens `group_places`-relation skapas eller återaktiveras;
   besök, anteckningar, favoriter och annan privat gruppdata följer inte med.
2. **#158 Stöd platsalias och säker sammanföring av kanoniska
   matställesdubletter**  
   Lägg senare till konservativa alias och dubblettkandidater samt en explicit,
   administrativt granskad och transaktionell merge för bekräftade historiska
   dubbletter. Ingen fuzzy automatisk massmerge ingår.

Paket F bygger vidare på den serverprincip som etablerats i #156 och ska stärka
kanonisk identitet utan att skapa en publik katalog eller exponera vilka andra
grupper som använder samma plats.

## Genomförda paket

När ett pakets sista issue är mergat flyttas paketet från den aktiva delen hit
som en kort historisk post med paketnamn, datum eller version och länk till de
stängda issues som bär detaljerna.

Roadmapen ska inte återge full implementation eller releasehistorik. Den finns i
stängda issues, mergade PR:er, `CHANGELOG.md` och vid behov
`docs/architecture.md`.

- ✅ **Paket B – Sök och geografi**  
  Genomfört genom #147, #148, #156, #155, #163 och #149. Paketet löpte från
  v1.27.1 till v1.31.0; sista steget #149 mergades via PR #180.

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
`priority:now` utan en kort produktbedömning. Om prioriteringen ändras ska både
roadmapen och berörda öppna issues uppdateras i samma PR eller i en omedelbart
följande docs-only PR.

GitHub Projects införs först om issues, labels och roadmapen inte längre ger en
tydlig överblick, exempelvis vid många parallella utvecklare eller ett betydligt
större antal aktiva backlogposter.

## När roadmapen uppdateras

Uppdatera dokumentet när:

- ett paket eller en prioritering ändras;
- ett varaktigt produktbeslut tillkommer eller tas bort;
- ett övergripande feature-issue delas upp eller ersätts;
- en funktion är genomförd och ska markeras som klar inom ett pågående paket;
- ett pakets sista issue är genomfört och paketet flyttas till historik.

Roadmapen ska normalt **inte** uppdateras för:

- varje commit eller patchversion;
- små buggrättningar som inte ändrar produktens riktning;
- tekniska implementationdetaljer som redan hör hemma i kod, PR eller
  arkitekturdokumentation.