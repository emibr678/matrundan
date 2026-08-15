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
gruppinställningarna** genomfördes i v1.32.0 via PR #190 och **#103 Central
Matrundan-symbol och konsekvent varumärkesanvändning** genomfördes i v1.33.0 via
PR #194. Paket A har därmed nått tillräcklig grundnivå för att nästa
kärnproduktproblem ska prioriteras före återstående symbolpolish i #105 och
#135.

**#189 Uppdatera guest-privacy-preflight efter v5h-wrappern** är genomfört.
Pågående kärnleverans är den första avgränsade delen av **#169 Bekräfta
deltagande och komplettera gemensamma besök**. Direkt därefter följer **#203
Samla deltagaromdömen i en tydlig besöksvy** och **#204 Synliggör besök som
väntar på ditt omdöme**. Först när den efterbesöksloopen är begriplig går
roadmapen vidare till **#106 Nästa stopp v2: alternativ för plats och tid utan
överskrivning**, därefter **#101 Privata kommentarer och reaktioner på besök**.
De känsligare cross-group-delarna av #169 och **#179 Dela besöksfoto uttryckligen
tillsammans med delat besök** kommer därefter. **#197 Renodla besökskontext med
Något att dricka och valfri Hämtmat-markering** är nästa överenskomna
besökskontextsteg efter dessa kärnleveranser. Det nya **Paket G – Gruppens
platskunskap och historikbaserad vägledning** ligger senare och bygger vidare på
stabil besöks- och reviewsemantik.

## Paket A – Grundplatta och konsekvens

**Prioritet:** `priority:later` för återstående delar

Paketet förbättrar produktens konsekvens och skapar bättre förutsättningar för
kommande funktioner. Efter #108 gick arbetet till Paket B. Paket B är nu
genomfört och #104 samt #103 är klara. #105 och #135 ligger kvar som värdefull
visuell polish men blockerar inte nästa kärnproduktsteg.

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
4. ✅ **#103 Central Matrundan-symbol och konsekvent varumärkesanvändning**  
   Använd en central varumärkeskomponent där symbolen representerar Matrundan,
   men behåll matsymboler där de representerar grupper eller matställen.
   Genomförd i v1.33.0 via PR #194.
5. **#105 Utökat emoji- och symbolstöd för grupper och matställen**  
   Utöka kurerade symbolval och stöd ett gruppspecifikt manuellt val.
   Bilduppladdning ingår uttryckligen inte i detta scope.
6. **#135 Härled representativa matställessymboler från kök och inriktning**  
   Ge ställen en stabil automatisk symbol från normaliserad inriktning, kök och
   kategori när ingen uttrycklig symbol finns. Manuellt gruppval ska ha
   företräde och breda eller motstridiga utbud ska få en neutral fallback.

## Paket C – Nästa stopp v2

**Prioritet:** `priority:next`, efter #203 och #204

- **#106 Nästa stopp v2: alternativ för plats och tid utan överskrivning**

Det här är nästa större planeringssteg efter att gruppens genomförda besök både
kan kompletteras korrekt av faktiska deltagare och presenteras med en tydlig
omdömes- och pendingloop. Gruppen ska kunna föreslå alternativa matställen och
flera tider utan att ett nytt förslag skriver över det som redan diskuteras.
Frågorna **vart** och **när** hålls separata, medan ett aktuellt nästa stopp
förblir tydligt.

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

**Prioritet:** `priority:now` för första delen av #169, därefter `priority:next`
för #203 och #204

Rekommenderad ordning:

1. **#169 Bekräfta deltagande och komplettera gemensamma besök – första
   leveransen**  
   Den som registrerar ett nytt besök är själv faktisk deltagare och lämnar sitt
   eget omdöme i registreringsflödet; registreringen ger ingen extra progression
   utöver vanlig deltagarprogression. Andra identifierade deltagare kan
   komplettera samma kanoniska besök med egna omdömen och självkorrigera **Jag
   var inte med** / **Jag var med**. Progression, statistik och aktivt
   deltagaromdöme följer den kanoniska deltagarsanningen, och samma identifierade
   deltagande återanvänds över gruppkontexter där användaren legitimt kan se
   samma besök. Befintlig historik skrivs inte om destruktivt när den nya
   registrerarinvarianten införs.
2. **#203 Samla deltagaromdömen i en tydlig besöksvy**  
   Gör besöksdetaljen begriplig när flera faktiska deltagare lämnar egna
   omdömen. Samla gruppens sammanfattning och individuella deltagaromdömen i en
   gemensam hierarki, håll redigering och synlighet nära det egna omdömet och gör
   deltagarkorrigeringen mer kompakt i normalfallet. Exempelgruppen ska visa ett
   realistiskt besök med minst tre deltagaromdömen.
3. **#204 Synliggör besök som väntar på ditt omdöme**  
   Ge identifierade faktiska deltagare en diskret pending-signal på hemvyn och i
   besökshistoriken när deras eget omdöme saknas. Signalen leder tillbaka till
   samma kanoniska besök, försvinner efter eget omdöme eller **Jag var inte med**
   och får inte bli en blockerande appstartmodal, pushkampanj eller cross-group
   informationskanal.
4. **#101 Privata kommentarer och reaktioner på besök**  
   Efter mellansteget #106: lägg privat gruppdiskussion och enkla reaktioner på
   gruppens besökslänk. Funktionen är `priority:next` och får inte ge progression
   eller exponera en annan grupps diskussion när besöket delas.
5. **#169 – fortsatta cross-group-identitetsfall**  
   Gäst→medlem-koppling kräver uttryckligt val och den utpekade personens
   bekräftelse. Namn är presentation, aldrig identitet; ingen fuzzy
   personmatchning eller cross-group-personkatalog får uppstå.
6. **#179 Dela besöksfoto uttryckligen tillsammans med delat besök**  
   Låt användaren uttryckligen välja om ett privat besöksfoto ska följa med till
   en viss målgrupp. Fotoåtkomsten ska vara serverstyrd per målgrupp och får inte
   exponera ursprungsgrupp eller ge mottagargruppen rätt att ändra originalfotot.
7. **#197 Renodla besökskontext med Något att dricka och valfri
   Hämtmat-markering**  
   Gör besökstillfället semantiskt konsekvent genom att ersätta `Kväll` med
   `Något att dricka` och låt Hämtmat vara en separat, valfri besöksegenskap där
   På plats är implicit normalfall. Progression och betydelsen av `besökt` får
   inte ändras tyst och ska verifieras i implementationsplanen.

Funktionerna ska vara förankrade i ett verkligt kanoniskt besök och stärka
gruppens gemensamma minne. #169 gäller sann deltagaridentitet och strukturerade
personliga omdömen på samma besök, #203 gör flerpersons-omdömena begripliga i
besöksvyn, #204 gör saknade egna omdömen upptäckbara utan nagging, #179 gäller
uttrycklig och behörighetsstyrd fotodelning, #101 gäller privat gruppdiskussion
kring besöket och #197 renodlar själva besökskontexten. Ingen av funktionerna får
skapa global feed, offentlig social graf, offentliga likes eller progression för
social aktivitet.

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

## Paket G – Gruppens platskunskap och historikbaserad vägledning

**Prioritet:** `priority:later`

Paketet ska skapa en lågfriktionsloop där gruppens verkliga erfarenheter både
förbättrar privat platsmetadata och senare hjälper gruppen välja nästa ställe.
Datan får vara rikare än UI:t: härledda signaler ska bara visas där de faktiskt
hjälper och får inte skapa context overload eller ett separat statistiksystem.

Rekommenderad ordning:

1. **#199 Tydliggör platsmetadata: Typ av ställe, Kök och inriktning och Passar
   för**  
   Gör skillnaden mellan verksamhetstyp, kök/inriktning och gruppens `Passar för`
   begriplig. Behåll datamodellens ansvar och justera bland annat hjälpcopyn för
   `Något extra`. Detta är ett litet hygienarbete som kan plockas tidigare om det
   passar mellan större kärnleveranser, utan att ändra paketets huvudprioritet.
2. **#200 Uppmuntra faktiska deltagare att komplettera saknad platsmetadata
   efter besök**  
   Låt en faktisk deltagare frivilligt komplettera saknat `Passar för` eller kök
   och inriktning efter att besöket redan sparats. Samordna med #169 så att
   efterbesöksflödet inte blir en serie konkurrerande prompts.
3. **#198 Härled filtrering och topplistor från verkliga besökstillfällen**  
   Använd verkliga besök och transparenta relevanta betyg för historikbaserade
   signaler som `Bäst för fika` och `Bra för hämtmat`. Synliga betyg ska förbli
   direkt begripliga från registrerade omdömen; evidensmängd får påverka när en
   signal kvalificerar eller prioriteras men får inte förvränga betygssiffran.
   Välj den minsta lämpliga presentationen – label, filter eller topplista – i
   stället för att exponera varje härledd dimension överallt.

#198 förutsätter stabil semantik för besökstillfällen och Hämtmat från #197 och
ska beakta reviewmodellen från #169. Paketet är därför senare än de närmaste
kärnleveranserna även om #199 kan genomföras fristående som mindre UX-hygien.

## Parallellt maintenance- och kvalitetsspår

Maintenance konkurrerar inte automatiskt med produktroadmapen. Små blockerande
eller tillitskritiska korrigeringar får göras mellan produktsteg; större DX- och
refaktoriseringsarbete prioriteras först när det ger konkret utvecklingsnytta.

- ✅ **#189 Uppdatera guest-privacy-preflight efter v5h-wrappern** är genomfört.
- **#127 DX2B: Konsolidera Playwright-fixtures och minska sköra layouttester**,
  **#128 DX2C: Inför ändringsfragment och separat release-PR**, **#129 DX2D1:
  Automatisera branchstädning och förbättra repohygien** och **#130 DX2D2:
  Åtgärda deprecated API:er, döda beroenden och byggvarningar** ligger kvar som
  underhållsskuld och ska tas evidensbaserat.
- **#143 Utred föräldralöst objekt i besöksfoto-bucketen** är ett separat
  driftfynd; ingen destruktiv åtgärd får göras utan uttryckligt godkännande.
- **#133 Samla rättning och komplettering av platsuppgifter i ett begripligt
  flöde** är den bredare framtida produktfrågan för platsdatakorrigering.
  **#132 Gör saknad säker gatuadress handlingsbar i kontrollflödet** behandlas
  som en lägre prioriterad delmängd tills #133 planeras.

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
