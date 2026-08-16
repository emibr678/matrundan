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
6. **Lovable-synk och preview** — vald branch/head synkas och granskas när relevant.
7. **Databasdriftsättning** — godkända migrationer eller produktionsskrivningar
   genomförs separat.
8. **Publicering** — verifierad version görs publik separat.

En ny funktion eller större förändring får inte implementeras före uttryckligt
implementationsgodkännande. Implementation innebär inte godkännande för merge,
databas eller publicering. Bredda inte scope tyst.

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

En implementerande PR ska referera eller stänga sitt Issue. I mänsklig
statusrapportering används **Issue #NNN — full titel** respektive
**PR #NNN — full titel** när numren annars kan blandas ihop.

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

### Lovable-konsultation

När användaren uttryckligen ber att bolla UX med Lovable används Plan mode före
låst lösning när verktyget är tillgängligt. Om konsultationen inte kan
så genomföras ska begränsningen redovisas; den ersätts inte tyst av ett annat
arbetsflöde.

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

### Previewgrind

För nivå 3/större visuella ändringar krävs före merge:

- exakt PR-branch och aktuell head-SHA;
- samma branch vald i Lovable och verifierad synk;
- aktuell previewlänk i chatten;
- 360 px och desktop granskade;
- demo/exempel och live jämförda när relevant;
- användarens uttryckliga mergegodkännande efter preview.

Om branch, synk eller preview inte kan verifieras är kandidaten inte redo för
merge. Preview är granskning, inte publicering, och ersätter inte diff, tester,
browserkontroller eller CI.

Backend-, dokumentations- och andra osynliga ändringar kräver normalt inte
preview; motivera kort varför.

## 6. Verifiering och CI

Kanoniska kommandon och aktuell runnerinformation finns i `package.json` och
[DEVELOPMENT.md](../DEVELOPMENT.md). Hårdkoda inte en parallell kommandolista i
processdokumentation.

Verifieringsprincipen är:

1. riktad kontroll under iteration;
2. relevant domän-/browserkontroll för kandidatens faktiska risk;
3. repoets ordinarie kandidat-/CI-kontroller före merge.

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
- renderad UX/previewgrind är uppfylld där den krävs;
- dokumentation, roadmap och releasehistorik är konsekventa där ändringen kräver
  det;
- inga kända blockerare återstår;
- användaren har uttryckligen godkänt merge.

Merge betyder inte att databasen är driftsatt, att Lovable visar senaste `main`
eller att den publika appen är publicerad.

Efter merge, bekräfta att rätt Issue stängdes och att stängda issues inte ligger
kvar med operativa `status:ready`/`order:*`-etiketter. Kontrollera roadmapen bara
när den faktiska produktordningen eller paketstatusen påverkas.

## 8. Databasdriftsättning och publicering

Databasdriftsättning och publicering är separata handlingar med separata
uttryckliga godkännanden.

Vid databasarbete ska migrations-/preflightkontraktet i arkitekturen och repots
SQL-/kontraktskontroller följas. Skriv inte att en migration, schema-cache reload
eller autentiserad smoke är genomförd utan faktisk bekräftelse.

Publicering kräver konsekvent version, in-app-historik och `CHANGELOG.md` när
ändringen är releasepliktig. En dokumentations- eller maintenance-PR behöver
inte publiceras bara för att den mergas.

## 9. Leveranskvitto

Efter en kandidat eller merge redovisas endast relevanta fält, men håll följande
statusar separata:

- branch och commit/head;
- **Issue #NNN — titel** och **PR #NNN — titel**;
- CI och faktisk verifiering;
- renderad reviewnivå, states, viewportar och konkreta UX-fynd;
- Lovable-konsultation, vald branch, synk och preview;
- exempelgrupp och roadmap påverkan;
- databas/migration;
- sådant som inte verifierats;
- publicering.

En kompakt korrekt leveransrapport är bättre än en lång checklista som fyllts i
mekaniskt.

## 10. Dokumentägarskap

- `README.md` — kort mänsklig projektöversikt.
- `AGENTS.md` — permanent agentkonstitution + router.
- `docs/product-roadmap.md` — produktpaket, riktning, prioritet och backlogmodell.
- GitHub Issues + labels — konkret scope och operativ status/ordning.
- `docs/architecture.md` + specialistdokument — varaktig arkitektur, integritet
  och säkerhet.
- `DEVELOPMENT.md` — miljösetup, tooling och exakta kommandon.
- detta dokument — arbets- och leveransprocess.
- `docs/visual-review.md` — renderad UX, Lovable och preview.
- `CHANGELOG.md` + in-app-version — användarsynlig releasehistorik.
- `docs/archive/` — historik som fortfarande har ett faktiskt referensvärde.

Skapa inte parallella sanningskällor. Kortlivade implementationsplaner och
leveransstatus hör normalt i Issue/PR; när arbetet är klart flyttas endast
varaktiga beslut till deras naturliga ägare.
