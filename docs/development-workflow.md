# Utvecklings- och leveransflöde

Det här dokumentet äger Matrundans arbets- och leveransprocess. Miljösetup och
exakta kommandon finns i [DEVELOPMENT.md](../DEVELOPMENT.md), produktordning i
[product-roadmap.md](./product-roadmap.md), arkitekturregler i
[architecture.md](./architecture.md) och renderad UX-granskning i
[visual-review.md](./visual-review.md).

Målet är spårbarhet och säkra gränser utan att varje uppgift behöver bära hela
processen som checklista.

## 1. Faser och godkännanden

Skilj alltid mellan:

1. **Produktdiskussion** — mål, användarbehov och avgränsning.
2. **Planering** — konkret teknisk/UX-lösning, risker och verifiering.
3. **Godkänd implementation** — ändringar inom uttryckligen godkänt scope.
4. **Verifiering** — tester, CI och manuell/renderad kontroll.
5. **Merge** — verifierad PR förs in i `main` efter separat godkännande.
6. **Lovable-synk och preview** — endast när användaren uttryckligen har begärt
   Lovable; vald branch/head synkas och granskas då separat.
7. **Databasdriftsättning** — godkända migrationer eller produktionsskrivningar
   genomförs separat.
8. **Publicering** — verifierad version görs publik separat.

Cloudflare branch-/PR-preview är normal verifieringsinfrastruktur och ska inte
blandas ihop med fas 6 ovan. En Cloudflare-preview är inte Lovable-synk och är
aldrig i sig en publicering.

En ny funktion eller större förändring får inte implementeras före uttryckligt
implementationsgodkännande. Implementation innebär inte godkännande för merge,
databas eller publicering. Bredda inte scope tyst.

Efter uttryckligt implementationsgodkännande ska agenten normalt fortsätta genom
allt agentägt arbete inom scopet tills en verklig användargrind nås. En push,
pågående CI, kvarvarande UX-review, väntande preview eller annan verifiering som
agenten själv kan utföra är inte en handoff. Verkliga användargrindar är främst
scopeutvidgning eller produktbeslut, uttryckligt användartest/val, merge,
databasdriftsättning, publicering eller en blockerare som agenten faktiskt inte
kan lösa med tillgängliga verktyg.

Korrigerande dokumentation och små maintenanceändringar får göras inom ett
uttryckligt granskningsuppdrag om de inte skapar nytt produktbeteende.

## 2. Innan arbete påbörjas

För en icke-trivial uppgift:

- kontrollera aktuell `main` och relevanta öppna PR:er för fil- och
  semantikkonflikter;
- läs relaterat Issue och endast de specialistdokument som uppgiften kräver;
- inspektera aktuell kod och berörda databasobjekt i stället för att anta att en
  äldre plan fortfarande beskriver implementationen;
- formulera mål, icke-mål, edge cases, integritets-/säkerhetsrisker och hur
  kandidaten ska falsifieras;
- bedöm exempelgrupp/demo/live när produktflöden påverkas;
- invänta implementationsgodkännande när det krävs.

GitHub Issues + labels är den operativa backloggen. Detaljerade definitioner av
`status:*`, `priority:*` och `order:*` finns i roadmapen och ska inte dupliceras
här. `status:ready` betyder att aktuell plan och implementation är godkända.

När implementation uttryckligen godkänns ska relevant Issue sättas till
`status:ready` i samma arbetsmoment, före eller samtidigt som
implementationsbranch/PR skapas. Om PR:n redan finns när godkännandet ges ska
statusen synkas innan implementationen fortsätter. En normal implementerande PR
ska alltså inte lämna sitt Issue i `status:inbox` eller `status:agreed`.

En implementerande PR ska referera eller stänga sitt Issue. I mänsklig
statusrapportering används **Issue #NNN — full titel** respektive
**PR #NNN — full titel** när numren annars kan blandas ihop.

Issue-titeln ska normalt beskriva användarutfallet eller det konkreta
underhållsresultatet så att värdet går att förstå direkt i backloggen. Interna
fasnamn, historiska versionsetiketter och implementationsteknik hör normalt i
Issue-bodyn när utfallet kan uttryckas tydligare. Tekniska termer är fortsatt
rimliga när de faktiskt är själva maintenanceutfallet. När scopet ändras
materiellt ska även titeln bedömas och vid behov uppdateras.

### Materiella beslut i Issues

När en produkt-/UX-diskussion materiellt ändrar scope, mental modell,
informationshierarki, copyprincip, integritet eller huvudflöde ska relevant
Issue-body uppdateras till aktuell sanning. Lägg dessutom en kort daterad
beslutskommentar när varför, ett ersatt antagande eller ett viktigt fynd har
framtida värde. Pixel- och spacingmikrobeslut behöver inte loggas.

Om beslutet uppstår i chatten ska den varaktiga sanningen synkas till GitHub;
chatthistoriken får inte vara enda permanenta källan. Återkommande UX- och
copylärdomar promoveras enligt [ux-principles.md](./ux-principles.md).

Roadmapen uppdateras när paket, prioritet, beslutad relativ ordning eller ett
varaktigt produktbeslut ändras — inte för varje commit eller implementation.

## 3. Branch, Git och PR

Arbeta normalt i en dedikerad branch från verifierad aktuell `main` och håll en
sammanhängande uppgift i en PR. Pusha granskbara checkpoints, inte varje lokal
iteration.

PR:n är draft medan implementation, diagnostik eller visuell iteration pågår.
Flytta tillbaka till draft om en kandidat behöver en ny större loop.

Pushed historik som kan ha synkats till Lovable får inte skrivas om med
force-push, rebase eller amend. GitHub Actions används för verifiering, inte för
att patcha, committa eller pusha produktkod tillbaka till en branch.

PR-mallen är ett evidenskvitto. Den ska beskriva vad som faktiskt ändrades,
vilken riskprofil som gäller, vad som verifierats och vad som återstår; den ska
inte återberätta hela detta dokument.

### Releaseunderlag och staging-first

En normal feature-PR med användarsynlig kod eller migration ska bära kort svensk
releasecopy i PR-mallens markerade **Releaseunderlag**, men ska normalt inte höja
appversionen eller materialisera en daterad post i `CHANGELOG.md`. Det minskar
konflikter mellan parallella features och speglar att flera ändringar kan mergas
och testas tillsammans i staging innan en faktisk release beslutas.

När en releasekandidat skapas materialiseras de relevanta mergade PR:ernas
releaseunderlag i en sammanhängande version: `CHANGELOG.md`,
`src/lib/matrundan/version.ts`, datum och in-app-historik ska då uppdateras och
fortsatt vara konsekventa. Produktionsgrindarna kräver samma strikta
versionskonsistens som tidigare.

Redan pågående feature-PR:er som före detta kontrakt materialiserat en full
version får slutföras enligt det äldre kontraktet så att verifierade kandidater
inte behöver skrivas om enbart av processkäl. Nya features ska normalt inte
kopiera det mönstret.

Dokumentations-, test- och verktygsändringar utan användarsynlig kod eller
migration använder fortsatt den explicita `Version: inte relevant`-markeringen i
PR-mallen. Featuremerge till `main`/staging är inte i sig en release eller
publicering.

### Exekveringslägen

Matrundan stödjer två normala agentlägen och de får inte låtsas ha samma
förmågor:

- **Checkout-läge** — agenten har en verifierad checkout, kan ändra flera filer
  lokalt och köra repots kanoniska kommandon före en sammanhållen push.
- **Connector-läge** — agenten arbetar direkt via GitHub API utan lokal checkout.
  Lokala kommandon får då inte påstås vara körda. Relaterade filändringar ska
  normalt batchas till en sammanhållen commit/ref-uppdatering i stället för en
  commit per fil, och PR:n hålls draft under API-iteration.

När connectorn exponerar Git Data API är normal flerfilsväg
`blobs → tree → commit → ref`. Om en nödvändig connectorförmåga saknas ska
agenten minimera antalet filvisa commits och redovisa begränsningen i PR:n; skapa
inte no-op-commits enbart för att trigga CI. Eftersom GitHub inte kan öppna en PR
utan branchdiff får första draft-PR:n i connector-läge skapas direkt efter den
första sammanhållna checkpointen.

Valet av exekveringsläge ändrar inte godkännandegränserna. Det ändrar endast hur
implementation och verifiering genomförs och vilken evidens agenten faktiskt kan
påstå sig ha.

### Cloudflare branch-preview och staging

När Cloudflare-runtime är aktiv för utvecklingsflödet gäller den låsta
miljömodellen i `docs/platform-migration-plan.md`:

- feature-/PR-brancher får automatiska preview-versioner av Worker `staging`;
- preview använder demo/fixtures eller Supabase **Matrundan Staging** och får
  aldrig produktions-service-role, produktionsdatabasens skrivprivilegier eller
  andra produktionshemligheter;
- `main` är staging-Workerns produktionsbranch i Cloudflare och en merge kan
  därför uppdatera den stabila `staging.matrundan.workers.dev`;
- PR-checken **Staging DB readiness** läser Supabase Stagings migrationshistorik
  och verifierar att samtliga repo-migrationer för exakt PR-head redan finns där;
  den gör inga databasskrivningar;
- migrationshistoriken är append-only relativt `main`: en PR får lägga till nya
  migrationsfiler men ska inte ändra, byta namn på eller radera redan mergade
  migrationer;
- om readiness är röd på grund av en saknad migration krävs separat uttryckligt
  godkännande för **Staging database apply**. Det flödet applicerar godkända
  saknade migrationer och triggar därefter om readiness för exakt PR-head;
- en migrationsbärande PR är inte mergeklar förrän både ordinarie CI och
  **Staging DB readiness** är gröna. Post-merge-kontrollen i stagingdeployen
  behålls som defense-in-depth; en saknad stagingmigration efter merge är ett
  processfel som ska stoppas, inte ett normalt mellanläge;
- den stagingdeploymenten är verifieringsmiljö, inte Matrundans publicerade
  produktion;
- Worker `app` och Wrangler-miljön `prod` får inte auto-promoveras enbart för att
  `main` ändras. Produktion kräver separat publiceringsgodkännande.

Exakta Wrangler-/Cloudflare-kommandon och dashboardinställningar hör hemma i
`DEVELOPMENT.md`, inte här.

## 4. Diagnostik och implementation

En icke-trivial bugg börjar med reproduktion och observerade data. Formulera en
falsifierbar hypotes innan upprepade kodändringar och använd minsta riktade
experiment som kan skilja hypoteserna åt. Ta bort tillfällig diagnostik när
rotorsaken är löst.

För godkänd implementation:

- gör minsta sammanhängande ändring som uppfyller scopet;
- undvik orelaterad refaktorering och kosmetiska massändringar;
- återanvänd etablerade domän- och UI-mönster;
- låt inte en providers bekvämlighet flytta domän-, integritets- eller
  behörighetsregler till fel lager;
- ändra inte produktionsdata från featurebranch utan separat godkännande och
  verifierad miljögräns.

Under iteration: börja med den smalaste kontroll som kan falsifiera kandidaten.
Bredda först när den stabiliserats.

## 5. Renderad UX och Lovable

Alla GUI-ändringar följer [visual-review.md](./visual-review.md) och den lokala
`src/AGENTS.md`:

- nivå 1 för alla renderade GUI-ändringar;
- nivå 2 när interaktion/användarresa ändras;
- nivå 3 för större layout-, hierarki- eller huvudflödesändringar.

Temporära screenshots och riktade states är standard under iteration. Breda
browsermatriser och GitHub-artifacts används först när risk eller färdig kandidat
motiverar dem.

**Lovable är opt-in.** Konsultera inte Lovable, låt inte Lovable skriva kod,
synka inte en branch till Lovable och skapa inte Lovable-preview om användaren
inte uttryckligen har bett om Lovable i den aktuella uppgiften. Nivå 3 i sig är
inte ett skäl att använda Lovable; normal renderad verifiering görs med repots
browser-/screenshotverktyg.

### Lovable-konsultation

När användaren uttryckligen ber att bolla UX med Lovable används Plan mode före
låst lösning när verktyget är tillgängligt. Om konsultationen inte kan
genomföras ska begränsningen redovisas; den ersätts inte tyst av ett annat
Lovable-flöde.

### Lovable-implementation

När användaren uttryckligen ber Lovable implementera UX:

1. utgå från verifierad featurebranch/PR;
2. välj exakt PR-branch i Lovable;
3. verifiera branchnamn och aktuell head-SHA innan Lovable skriver kod;
4. låt Lovable fokusera på visuell hierarki, layout, spacing, responsivitet och
   interaktionspolish;
5. granska diffen och kör normal repo-verifiering efteråt.

Om rätt branch/head inte kan verifieras ska Lovable inte skriva kod. En branch
innebär inte en isolerad databas.

### Nivå 3-grind

För nivå 3/större visuella ändringar krävs före merge:

- exakt PR-branch och aktuell head-SHA;
- 360 px och desktop granskade;
- relevanta states samt demo/exempel och live jämförda när relevant och möjligt;
- persona-/UX-fynd och konkreta korrigeringar redovisade;
- ett tydligt granskningsunderlag och manuella teststeg lämnade i chatten;
- användarens uttryckliga mergegodkännande efter granskningen.

När användaren uttryckligen har begärt Lovable tillkommer verifierad
Lovable-branch/synk och aktuell previewlänk. Om Lovable inte har begärts ska
kandidaten inte blockeras av Lovable; använd repots browserkontroller,
temporära screenshots och vid behov GitHub-artifact som granskningsunderlag.

Preview är granskning, inte publicering, och ersätter inte diff, tester,
browserkontroller eller CI.

Backend-, dokumentations- och andra osynliga ändringar kräver normalt inte
renderad granskning; motivera kort varför.

## 6. Verifiering och CI

Kanoniska kommandon och aktuell runnerinformation finns i `package.json` och
[DEVELOPMENT.md](../DEVELOPMENT.md). Hårdkoda inte en parallell kommandolista i
processdokumentation.

Verifieringsprincipen är:

1. riktad kontroll under iteration;
2. relevant domän-/browserkontroll för kandidatens faktiska risk;
3. repoets ordinarie kandidat-/CI-kontroller före merge.

I checkout-läge görs steg 1–2 normalt i checkouten före push. I connector-läge
används en GitHub-baserad riktad verifieringsväg när repot exponerar en sådan;
om den saknas hålls PR:n draft genom implementationen och full CI startas först
när den sammanhängande kandidaten är värd en bred körning. Connector-läge får
inte ersätta saknad verifiering med påstådd lokal evidens.

GUI-kandidater redovisar reviewnivå, states och viewportar enligt
`visual-review.md`. Databas/RPC-kandidater granskar minst autentisering,
medlemskap/roller, `SECURITY DEFINER`/`search_path`, grants, gruppisolering och
databevarande där detta är relevant.

Påstå aldrig att ett test eller en smoke har körts om det inte finns ett faktiskt
resultat. Saknad live-session, browser, runner eller annan verifieringsförmåga
redovisas som en begränsning — den ersätts inte av en gissning.

Draft-iteration ska inte förbruka CI/artifacts utan nytta. När kandidaten är redo
ska relevant ordinarie CI vara grön före merge. Hosted och self-hosted runner är
likvärdiga endast när samma avsedda verifieringskontrakt faktiskt passerar.

## 7. Merge

Merge får ske först när:

- godkänt scope är uppfyllt och slutdiffen är granskad;
- aktuell `main` och öppna PR:er har kontrollerats igen för konflikt/mergeordning;
- relevant verifiering och CI är grön;
- renderad UX-/nivå-3-grind är uppfylld där den krävs;
- eventuell uttryckligen begärd Lovable-granskning är uppfylld;
- dokumentation, roadmap och releaseunderlag/releasehistorik är konsekventa där
  ändringen kräver det;
- inga kända blockerare återstår;
- användaren har uttryckligen godkänt merge.

Merge betyder inte att databasen är driftsatt, att Lovable visar senaste `main`
eller att den publika appen är publicerad. Om Cloudflare staging följer `main`
kan merge däremot automatiskt uppdatera staging; det räknas fortfarande som
verifieringsmiljö och inte publicering.

Efter merge, bekräfta att rätt Issue stängdes och att stängda issues inte ligger
kvar med operativa `status:ready`/`order:*`-etiketter. För en PR som använder
`Refs #NNN` i stället för `Closes #NNN` krävs dessutom en uttrycklig
**completion sweep** av det refererade Issue: om inget konkret levererbart scope
återstår ska det stängas; om bara ett smalare restarbete återstår ska det brytas
ut till ett tydligt uppföljningsissue och den färdiga parenten stängas. Ett öppet
parent-Issue ska inte användas som historiskt arkiv. Om stängning medvetet skjuts
upp ska Issue-kommentaren ange exakt vilket levererbart arbete och vilken nästa
grind som återstår.

Kontrollera roadmapen när den faktiska produktordningen, paketstatusen eller en
roadmap-refererad Issue-titel påverkas.

## 8. Databasdriftsättning och publicering

Databasdriftsättning och publicering är separata handlingar med separata
uttryckliga godkännanden.

Vid databasarbete ska migrations-/preflightkontraktet i arkitekturen och repots
SQL-/kontraktskontroller följas. Skriv inte att en migration, schema-cache reload
eller autentiserad smoke är genomförd utan faktisk bekräftelse.

För Cloudflare betyder publicering att en uttryckligen godkänd kandidat promoveras
eller deployas till Worker `app` via Wrangler-miljön `prod`. En PR-preview eller
en automatisk deployment av `main` till Worker `staging` är inte publicering.

När en faktisk releasekandidat beslutas ska relevanta mergade feature-PR:ers
releaseunderlag materialiseras till en daterad release. Då ska appversion,
in-app-historik och `CHANGELOG.md` vara konsekventa innan produktionspreflight
och publicering. En featuremerge till staging behöver däremot inte låtsas vara en
egen produktionsrelease.

En dokumentations- eller maintenance-PR behöver inte publiceras bara för att den
mergas.

## 9. Mobil handoff i chatten

Chatten är användarens mobila kontrollpanel, inte den fullständiga revisionsloggen.
PR:n och Actions behåller den tekniska evidensen. Agenten ska därför inte skicka
ett leveranskvitto medan inget krävs från användaren och agentägt arbete kan
fortsätta.

När en verklig handoff nås:

- använd en tydlig statusrubrik med en konsekvent symbol: **✅ Redo att testa**,
  **✅ Klar för beslut**, **⏳ Väntar** eller **⛔ Blockerad**;
- börja med läget i användarspråk och om användaren behöver göra något;
- visa högst den aktuella blockeraren eller beslutspunkten, inte flera interna
  delsteg som likvärdiga problem;
- visa alltid fältet **Preview:**. För en GUI-kandidat ska det vara en klickbar,
  verifierad länk för exakt kandidat. För en kandidat utan relevant renderad yta
  skrivs i stället **Inte relevant** med ett kort skäl;
- gruppera verifiering på en kort rad, exempelvis **CI + mobil browser: ✅**, och
  skilj väntande från godkänt visuellt i stället för att gömma läget i brödtext;
- håll SHA, tree-hash, runnerdetaljer, migrationsfilnamn och rå workflowstatus i
  PR/Actions om de inte behövs för själva beslutet;
- lista inte allt som inte har gjorts om det inte finns konkret risk att blanda
  ihop merge, databas, Lovable eller publicering;
- avsluta med **Nästa från dig: ...** när användarinput faktiskt krävs.

En normal testhandoff återanvänder samma visuella struktur även när innehållet
varierar:

```markdown
## ✅ Redo att testa

**Preview:** [Öppna appen →](https://...)
**Verifierat:** CI ✅ · Mobil browser ✅
**Testa främst:** A, B, C
**Nästa från dig:** säg vad som känns fel eller om kandidaten ser bra ut.
```

En docs/backend-kandidat använder samma fält men skriver exempelvis
**Preview: Inte relevant – endast dokumentation**. En GUI-kandidat får inte
beskrivas som redo för användartest om det maskinella PR-kvittot för aktuell head
saknar en exakt verifierad preview. Efter merge redovisas endast de separata
statusar som är relevanta för att undvika sammanblandning, exempelvis om
databasen fortfarande inte är driftsatt eller publicering inte har skett.

När ordinarie CI blir grön på en redo-PR skapar eller uppdaterar workflowet
`Mobile PR handoff` ett kanoniskt PR-kvitto. GUI-kandidater får en framträdande
länk först efter att Cloudflares commit-preview svarat på `/api/health` med exakt
head-SHA. Kandidater utan GUI-diff får ett uttryckligt **Preview: Inte relevant**.
Agenten ska läsa det aktuella kvittot före handoff i chatten och anpassa
**Testa främst** och **Nästa från dig** till uppgiften; den automatiska kommentaren
är verifierat underlag, inte en ersättning för relevant mänsklig sammanfattning.

PR-mallen är fortsatt GitHubs fullständigare evidenskvitto. Chattens handoff ska
vara den minsta status användaren behöver för att tryggt granska och fatta nästa
beslut, inte en kopia av PR-mallen.

## 10. Dokumentägarskap

- `README.md` — kort mänsklig projektöversikt.
- `AGENTS.md` — permanent agentkonstitution + router.
- `docs/product-roadmap.md` — produktpaket, riktning, prioritet och backlogmodell.
- GitHub Issues + labels — konkret scope och operativ status/ordning.
- `docs/architecture.md` + specialistdokument — varaktig arkitektur, integritet
  och säkerhet.
- `DEVELOPMENT.md` — miljösetup, tooling och exakta kommandon.
- detta dokument — arbets- och leveransprocess.
- `docs/ux-principles.md` — varaktiga produkt-UX-, interaktions- och
  copyprinciper.
- `docs/visual-review.md` — renderad UX och villkorad Lovable-granskning.
- `CHANGELOG.md` + in-app-version — materialiserad användarsynlig releasehistorik;
  feature-PR:ers tillfälliga releaseunderlag hör hemma i PR-metadata fram till
  releasekandidat.
- `docs/archive/` — historik som fortfarande har ett faktiskt referensvärde.

Skapa inte parallella sanningskällor. Kortlivade implementationsplaner och
leveransstatus hör normalt i Issue/PR; när arbetet är klart flyttas endast
varaktiga beslut till deras naturliga ägare.
