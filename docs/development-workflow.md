# Utvecklings- och leveransflöde

Det här dokumentet är den kanoniska processen för produktdiskussion, planering,
godkänd implementation, verifiering, merge, Lovable-synk, databasdriftsättning
och publicering.

Miljösetup och kanoniska kommandon finns i [DEVELOPMENT.md](../DEVELOPMENT.md).
Arkitektur- och säkerhetsregler finns i [architecture.md](./architecture.md).
Produktpaket och backlog finns i [product-roadmap.md](./product-roadmap.md).
Visuell granskning beskrivs i [visual-review.md](./visual-review.md).

## 1. Faser

Arbetet ska alltid kunna beskrivas som en av följande faser:

1. **Produktdiskussion** – mål, användarbehov och avgränsning.
2. **Planering** – konkret lösning, risker, datamodell och tester.
3. **Godkänd implementation** – kod och migrationer inom uttryckligen godkänt scope.
4. **Verifiering** – statiska kontroller, tester, CI och manuell kontroll.
5. **Merge** – en verifierad ändring förs in i `main`.
6. **Lovable-synk och preview** – rätt PR-branch synkas och granskas.
7. **Databasdriftsättning** – godkända migrationer appliceras separat.
8. **Publicering** – en verifierad version publiceras till användarna.

En ny funktion eller större förändring kräver uttryckligt godkännande före
implementation. Ett implementationsgodkännande är inte ett godkännande för
merge, databas eller publicering. Dessa steg kräver separata godkännanden.

Korrigerande dokumentation och små underhållsändringar får göras inom ett
uttryckligt granskningsuppdrag, men får inte införa nytt produktbeteende.

## 2. Scope, roadmap och issues

Innan en icke-trivial implementation:

1. inspektera aktuell kod, migrationer och dokumentation;
2. identifiera kanonisk källa;
3. formulera mål, avgränsningar, edge cases och verifiering;
4. skilj produktbeslut från tekniskt genomförande;
5. bedöm om exempelgruppen eller scenariokontraktet måste ändras;
6. invänta implementationsgodkännande när det krävs.

`docs/product-roadmap.md` är översikten över beslutade paket, prioriteringar och
varaktiga produktavgränsningar. GitHub Issues är den konkreta backloggen.

- Nya idéer börjar normalt som `status:inbox`.
- Överenskommet användarbehov, scope och icke-mål dokumenteras i issuen och får
  `status:agreed`.
- En aktuell teknisk plan tas fram när arbetet närmar sig implementation.
- Efter uttryckligt implementationsgodkännande används `status:ready`.
- En implementerande PR ska referera eller stänga sitt issue.
- Uppdatera roadmapen när paket, prioritet eller varaktigt produktbeslut ändras,
  inte för varje implementation eller commit.

Chatten får inte vara enda källan till ett varaktigt produktbeslut. Redan
dokumenterade beslut ska inte diskuteras om från början utan nya fakta eller ett
tydligt produktproblem.

## 3. Arbetsyta och Git

Återanvänd en verifierad checkout. Klona endast när miljön är ny, checkouten
saknas eller dess tillstånd inte kan återställas säkert.

En godkänd uppgift får normalt en branch från verifierad aktuell `main`:

```bash
git fetch origin --prune
git switch main
git pull --ff-only
git rev-parse HEAD
git switch -c agent/<beskrivande-namn>
```

Använd en branch och en PR per sammanhängande uppgift. Skapa inte en ny branch
eller PR för varje felsökningshypotes.

Historik som redan har pushats eller synkats till Lovable får inte skrivas om med
force-push, rebase eller amend. GitHub får squash-merga en färdig PR eftersom det
inte skriver om featurebranchens publicerade historik.

## 4. Diagnostik före fix

En icke-trivial bugg ska börja med reproduktion och bevis:

1. reproducera felet i relevant miljö;
2. samla runtime-data som skiljer fungerande och trasigt beteende;
3. klassificera felet, exempelvis data, layout, renderering, nätverk,
   behörighet, miljö eller integration;
4. formulera en falsifierbar hypotes;
5. gör minsta riktade diagnostik eller ändring;
6. kontrollera resultatet före nästa hypotes;
7. implementera slutlig fix när grundorsaken stöds av observerade data;
8. ta bort tillfällig diagnostik.

För kartproblem bör diagnostik i första hand visa container- och canvasmått,
MapLibre-källor och lager, resursstatus, WebGL/workerstatus och skillnaden mellan
isolerad komponent och produktflöde.

## 5. Implementation och lokal iteration

Gör flera små iterationer i samma arbetsyta före push:

```text
reproducera
→ diagnostik
→ lokal ändring
→ riktad kontroll
→ lokal justering
→ sammanhängande commit
→ push
```

Pusha när det finns en granskbar kandidat, en preview behövs eller en viktig
checkpoint måste bevaras. Pusha inte varje experiment och skapa inte commits
bara för att trigga CI.

PR:n ska vara draft medan implementation, visuell justering eller diagnostik
pågår. Flytta tillbaka en redo-PR till draft om fler designloopar eller hypoteser
krävs.

GitHub Actions verifierar kod. Workflows får inte patcha, committa eller pusha
produktkod tillbaka till branchen.

## 6. Lovable: konsultation, implementation och preview

Skilj mellan att konsultera Lovable och att låta Lovable skriva kod.

### 6.1 Konsultation

När användaren uttryckligen ber att bolla UX med Lovable ska Lovable konsulteras
i Plan mode före den visuella lösningen låses, om verktyget är tillgängligt.
Konsultationen får inte hoppas över tyst för att branch switching inte kan styras
automatiskt. Redovisa begränsningen om konsultationen inte kan genomföras.

### 6.2 Implementation på PR-branchen

Lovables normala isolerade arbetsflöde är GitHub-featurebranch tillsammans med
GitHub branch switching i Lovable:

1. skapa featurebranchen från verifierad aktuell `main`;
2. öppna eller förbered en draft-PR från samma branch;
3. välj exakt PR-branchen i Lovable;
4. verifiera branchens namn och aktuella head-SHA innan Lovable får skriva kod;
5. använd Agent mode när användaren uttryckligen har bett Lovable implementera
   UX och krediter finns;
6. granska Lovables diff och fortsätt genom normal PR- och verifieringsprocess.

Använd inte interna eller odokumenterade variantbegrepp som huvudflöde. Om rätt
branch inte kan väljas eller verifieras ska Lovable inte skriva kod. Pausa och
be användaren välja branchen i Lovable-editorn. Gå inte tyst över till egen full
UX-implementation när användaren uttryckligen bett Lovable implementera.

Codex/ChatGPT ansvarar fortsatt för arkitektur, säkerhet, datagränser,
teststrategi och slutlig kodgranskning. Lovable används främst för visuell
hierarki, layout, spacing, responsivitet och interaktionshelhet.

Samla visuella iterationer till en sammanhållen kandidat. Gör inte experiment
direkt på `main`. En branch innebär inte en isolerad databas.

### 6.3 Previewgrind före merge

För större ändringar av layout, informationshierarki, responsivitet eller
huvudflöde måste följande vara uppfyllt före merge:

- exakt PR-branch och aktuell head-SHA är dokumenterade;
- samma PR-branch är vald i Lovable;
- Lovable-synken motsvarar aktuell PR-head eller en dokumenterad senare commit
  på samma PR-branch;
- en aktuell Lovable-previewlänk har lämnats till användaren i chatten;
- previewn har granskats vid minst 360 px och desktop;
- demo/exempelgrupp och autentiserat live-läge har jämförts när relevant;
- användaren har uttryckligen godkänt merge efter previewgranskningen.

Om branch, synk eller preview inte kan verifieras ska PR:n förbli draft eller
inte markeras redo. En utgången previewlänk ska förnyas.

För rena backend-, dokumentations- eller osynliga teknikändringar är preview
normalt inte ett mergekrav. Motivera detta i PR:n.

Preview är granskning, inte publicering. Preview, GitHub-diff, browserkontroller,
screenshot-artifacts och CI är separata bevis och ersätter inte varandra.

`.lovable/plan.md` är tillfällig och får inte följa med till färdig PR eller
`main` utan uttryckligt godkännande.

## 7. Verifiering

Använd kommandona i `package.json` och [DEVELOPMENT.md](../DEVELOPMENT.md).

Under iteration:

```bash
bun run doctor
bun run verify:changed
```

När UI eller huvudflöden har ändrats:

```bash
bun run verify:agent
```

Snabb preliminär browserfeedback:

```bash
bun run test:mobile:changed -- --only-changed=origin/main
```

`--only-changed` är en heuristik och ersätter inte full relevant
browserverifiering för en färdig kandidat.

Visuella granskningsbilder:

```bash
bun run test:visual-review
```

Releasekandidat:

```bash
bun run verify:full
```

Kör fokuserade tester för berörd domän. Ett test får bara rapporteras som utfört
när det faktiskt har körts. En saknad autentiserad live-session ska redovisas
som en begränsning.

Exakta pixelgränser i E2E-test ska endast användas när pixelmåttet är ett
avsiktligt stabilt kontrakt. För normal responsiv UX ska tester i första hand
skydda ordning, overflow, minsta tryckyta, synlighet och robusta relativa
relationer.

Databas- och RPC-ändringar kräver manuell granskning av:

- autentisering, medlemskap och rollkrav;
- `SECURITY DEFINER` och låst `search_path`;
- grants för `PUBLIC`, `anon`, `authenticated` och `service_role`;
- isolering mellan grupper;
- bevarande av befintliga produktionsrader.

## 8. CI-nivåer och runnerläge

GitHub Actions används som mergekvitto, men runnerkapacitet ska inte förbrukas
under normal draft-iteration.

Draft-PR startar inga CI-runnerjobb. Under draft körs i stället den smalaste
relevanta verifieringen i den verifierade arbetsytan, normalt `bun run
verify:changed` och för UI `bun run verify:agent`. Pusha sammanhängande
checkpoints, men förvänta dig inte hosted CI förrän PR:n är redo.

När PR:n markeras redo, när en redan redo PR uppdateras, när `main` uppdateras
eller vid manuell körning kör CI full verifiering. Relevanta browserkontroller är:

- hela mobil Chromium-sviten för UI-ändringar;
- WebKit/iPhone och desktop Chromium för kartrelaterade ändringar.

Workflowen väljer runner via repository-variabeln `MATRUNDAN_CI_RUNNER`.
Variabeln är valfri:

- utan variabel används `ubuntu-24.04` på GitHub-hostad runner;
- värdet `self-hosted` flyttar samma CI-jobb till en registrerad, betrodd
  repository-runner.

Self-hosted-läget är projektets fallback när GitHub-hostade minuter, billing eller
runnerkapacitet gör hosted CI otillgängligt. Det sänker inte verifieringskraven:
samma workflow och checknamn ska bli gröna före merge. Runnern ska vara
repository-scopad, endast användas för betrodd kod och ha projektets låsta Bun-
version, beroenden och Playwright-systemberoenden tillgängliga enligt
`DEVELOPMENT.md`.

När hosted kapacitet åter finns kan `MATRUNDAN_CI_RUNNER` tas bort eller sättas
till `ubuntu-24.04` utan kodändring.

Workflowen **Visual review artifacts** använder samma runner-val. Automatisk
artifact-körning sker bara för en icke-draft PR där checkboxen är markerad;
under draft används lokal `bun run test:visual-review` när sådana bilder behövs.
Workflowen gör ingen pixeljämförelse. Ett misslyckat bygge eller screenshot-test
ska utredas innan artefakten används som granskningsunderlag.

## 9. PR och merge

En PR ska vara draft medan implementation eller diagnostik pågår.

Innan den markeras redo ska följande vara tydligt:

- relaterat issue och godkänt scope;
- motivering eller verifierad grundorsak;
- viktigaste ändringar;
- databas- och integritetskonsekvenser;
- exempelgruppens status;
- Lovable-konsultation eller Lovable-implementation när användaren begärt det;
- om visuell granskning krävs;
- PR-branch, head-SHA, vald Lovable-branch, verifierad synk och previewlänk;
- användarens preview- och mergebesked när previewgrinden gäller;
- roadmapbehov;
- utförda kontroller och manuella teststeg;
- ej verifierade delar;
- om databas eller publicering ingår.

Merge får ske när scope är uppfyllt, diffen är granskad, relevant CI är grön,
krävd visuell granskning och användargranskning är dokumenterad och inga kända
blockerare återstår. CI kan vara GitHub-hostad eller self-hosted, men runnerläget
ska framgå av PR-kvittot.

Merge innebär inte automatiskt att databasen är driftsatt, att `main` har
synkat i Lovable eller att den publika appen är publicerad.

### Efter merge: backlog- och roadmapkvitto

Efter merge av en implementerande PR:

1. bekräfta att `Closes #...` stängde rätt issue;
2. ta bort `status:ready` om etiketten ligger kvar på ett stängt issue;
3. kontrollera att roadmapen beskriver aktivt och kommande arbete;
4. markera en färdig issue kort med `✅` om paketet fortfarande pågår;
5. flytta paketet till **Genomförda paket** när dess sista issue är klart;
6. bedöm nästa `priority:now` innan prioritet ändras;
7. redovisa changelog/version, arkitektur, databas, Lovable-synk, preview och
   publicering separat.

Roadmap- och labeländringar görs helst i den avslutande PR:n. Annars skapas en
omedelbart följande docs-only PR. GitHub Actions får inte välja prioritet eller
skriva om roadmapen automatiskt.

## 10. Lovable-synk, databas och publicering

Projektets previeworigin är:

`https://id-preview--d389634e-227c-4689-85ed-8714fdc602f7.lovable.app`

Den publika appen är:

`https://matrundan.lovable.app`

Skilj alltid mellan:

- commit pushad till PR-branchen;
- PR-branch vald i Lovable;
- Lovable har synkat aktuell PR-head;
- en aktuell previewlänk har skapats och lämnats i chatten;
- användaren har granskat previewn;
- PR mergad;
- `main` synkad i Lovable;
- databasmigration applicerad;
- funktionen verifierad på verklig mobil enhet;
- den publika appen publicerad.

Skriv inte att synk, driftsättning eller publicering är klar utan faktisk
bekräftelse. Databasändringar och produktionsskrivningar får inte göras från en
featurebranch utan verifierad miljöisolering och separat godkännande.

## 11. Leveranskvitto

Efter en push eller merge som är avsedd att testas ska relevanta fält redovisas:

```text
Fas:
Branch:
Commit:
PR:
CI:
CI-runner:
Issue:
Issue stängd:
Roadmap:
Exempelgrupp:
Changelog/version:
Arkitektur:
Lovable-konsultation:
Vald Lovable-branch:
Lovable-synk:
Previewlänk:
Preview lämnad i chatten:
Preview granskad av användaren:
Visuell artifact:
Manuellt granskade vyer:
Testa:
Ej verifierat:
Databas:
Publicering:
Nästa rekommenderade issue:
```

## 12. Dokumentationsansvar

- `README.md` – kort, aktuell projektöversikt;
- `CHANGELOG.md` – släppta och ännu inte publicerade användarförändringar;
- `docs/product-roadmap.md` – paket, prioritering och backlogprocess;
- GitHub Issues – detaljerat scope och status;
- `docs/architecture.md` – varaktiga arkitektur- och säkerhetsbeslut;
- `DEVELOPMENT.md` – miljösetup och kanoniska kommandon;
- detta dokument – arbets- och leveransprocess;
- `docs/visual-review.md` – Lovable-branch, preview och screenshot-granskning;
- `AGENTS.md` – bindande instruktioner för kodande agenter;
- `docs/archive/` – historiska dokument.

README ska inte fungera som parallell backlog eller lång releasehistorik.
Avslutade planer ska tas bort eller arkiveras när varaktiga beslut har flyttats
till roadmap, arkitektur och changelog.

## 13. Antimönster

Undvik:

- upprepade kloner i samma beständiga arbetsyta;
- nya branches eller PR:er för varje hypotes;
- generiska commitmeddelanden;
- commits som endast triggar workflows;
- självmodifierande GitHub Actions-workflows;
- full browsermatris efter varje liten diagnostikändring;
- att lämna PR:n redo medan visuella hypoteser fortfarande testas;
- visuella experiment direkt på `main`;
- att använda interna eller odokumenterade variantbegrepp som huvudflöde;
- att hoppa över uttryckligen begärd Lovable-konsultation utan att redovisa det;
- att tyst ersätta begärd Lovable-implementation med egen full UX-implementation;
- att anta att Lovable-previewn visar PR-branchen utan verifiering;
- att mergea en större visuell ändring utan previewlänk och användarens
  granskningsbesked;
- att behandla preview, screenshot-artifact eller grön CI som ersättning för de
  andra;
- pixelassertioner som låser normal responsiv layout utan designkontrakt;
- global formattering när bara några filer ändrats;
- parallella verktyg för samma kontroll;
- att blanda produktfunktion, CI-ombyggnad och publicering i samma PR;
- att använda en gammal chatt som enda källa till ett produktbeslut;
- att använda README, `.lovable/plan.md` eller lösa TODO-listor som parallell
  backlog;
- att lämna ett stängt issue med `status:ready`;
- flera dokument som gör anspråk på att vara kanoniska för samma sak.
