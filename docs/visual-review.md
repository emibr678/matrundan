# Visuell och UX-granskning

Det här dokumentet beskriver hur renderade GUI-ändringar granskas innan de rapporteras som färdiga eller mergas. Det kompletterar `docs/development-workflow.md` och ersätter inte kodgranskning, tester, CI eller användarens granskningsbeslut.

Produktnära UX-, interaktions- och copyprinciper finns i [ux-principles.md](./ux-principles.md) och används som granskningsgrund för besluten som bedöms här.

Målet är att uppenbara problem som dubletter, rörig hierarki, spacing, felplacerade knappar, trunkering och overflow ska upptäckas av agenten **före** användarens manuella granskning, utan att varje liten ändring blir en tung eller dyr testkörning.

## Grundprincip: proportionerlig granskning

Alla ändringar som påverkar renderat GUI ska få någon form av renderad kontroll. Omfattningen beror på ändringens risk.

### Nivå 1 – visuell smoke check

Används för **alla GUI-ändringar**, även små visuella korrigeringar.

Minimikrav:

- rendera den eller de berörda states/routes som faktiskt ändrats;
- kontrollera minst relevant 360 px-vy;
- lägg till desktop när layout, hierarki eller komponentplacering påverkas där;
- granska uttryckligen dubletter, informationshierarki, spacing, alignment, knappplacering, trunkering, overflow, naturlig svensk copy och visuellt brus;
- använd temporära screenshots under iteration i stället för GitHub Actions-artifacts.

Snabbkommandot kör endast den generiska route-capture-specen och hoppar över den extra produktionsbuilden:

```bash
bun run test:visual-smoke -- /matstallen?demo=1
```

Flera berörda routes kan anges. Lägg till desktop när relevant:

```bash
bun run test:visual-smoke -- /matstallen?demo=1 /matstallen/p7?demo=1 --desktop
```

Kör inte hela visual-review-matrisen bara för att en enda knapp, rad eller lokal komponent har ändrats.

### Nivå 2 – UX-flödeskontroll

Används när ändringen påverkar **interaktion eller en användarresa**, exempelvis dialoger, sheets, formulär, navigering eller val som ändrar nästa state.

Nivå 2 innehåller nivå 1 och dessutom:

- klicka igenom just det ändrade flödet med Playwright eller motsvarande browserkontroll;
- kontrollera relevanta mellanlägen, öppna/stäng, tillbaka, fokus och viktiga fel-/tomlägen;
- kontrollera att primär och sekundär handling är begriplig och att användaren inte tappar kontext;
- ta riktade screenshots av states där en visuell bedömning behövs;
- kör fokuserade E2E-tester före bred browsermatris.

Riktade screenshots får skapas inne i det fokuserade testet eller med den generiska route-capture-specen när state kan nås direkt. De behöver inte sparas som GitHub-artifact.

### Nivå 3 – full UX-review av större huvudflöde

Används för större ändringar av layout, informationshierarki, responsivitet eller huvudflöde.

Nivå 3 innehåller nivå 1–2 och dessutom:

- 360 px och desktop;
- kort och långt innehåll samt relevanta tom-/fulla states;
- demo/exempelgrupp och autentiserat live-läge när det är tillgängligt och relevant;
- strukturerad persona-/perspektivgranskning;
- tydligt granskningsunderlag i chatten och användarens uttryckliga mergegodkännande;
- Lovable-konsultation, Lovable-synk eller Lovable-preview **endast** när användaren uttryckligen har begärt Lovable.

Nivå 3 är alltså inte ett skäl att använda Lovable. Repots browserkontroller, temporära screenshots och vid behov GitHub-artifacts är standardvägen.

## Persona-/perspektivgranskning

Personor används som ett **analyslager på samma kandidat**, inte för att skapa tre alternativa designer. De ska ge konkreta observationer och konflikter mellan behov, inte generisk persona-prosa.

För större huvudflöden används normalt minst följande perspektiv:

1. **Ny användare** – förstår personen vad vyn handlar om, vad som är viktigast och nästa naturliga handling utan förkunskap?
2. **Van gruppmedlem** – går den vanligaste gemensamma uppgiften snabbt, tydligt och utan onödiga steg, upprepningar eller konkurrerande CTA:er?
3. **Engagerad/power user** – fungerar vyn med mer historik, fler ställen och mer data utan informationsöverlast, ineffektivitet eller tappad överblick?

Persona-review ska avslutas med konkreta fynd, till exempel:

- vad som var självklart respektive oklart;
- var information eller handlingar dubblerades;
- om någon CTA konkurrerade med huvuduppgiften;
- om mer data gjorde vyn rörig;
- vilken korrigering som rekommenderas före användargranskning.

## Kostnad, lagring och körtid

GitHub Free-kvoter, runnerkapacitet och externa verktygskrediter är faktiska projektbegränsningar. Visuell kvalitet ska därför inte lösas genom att lagra varje iterations screenshots, köra hela browsermatrisen efter varje liten ändring eller använda Lovable utan uttrycklig begäran.

Följ dessa principer:

- temporära lokala/Codex-screenshots är förstahandsval under implementation;
- katalogen `visual-review/` är git-ignorerad och fungerar som tillfällig arbetsyta;
- **Visual review artifacts** är opt-in och reserveras främst för färdigare kandidater och större visuella ändringar där beständigt granskningsunderlag ger värde;
- behåll kort artifact-retention;
- spara inte traces eller videos som standard;
- börja med en eller ett fåtal berörda routes/states;
- kör bredare verifiering först när kandidaten stabiliserats;
- använd inte en full cross-browser-matris för en lokal visuell korrigering utan konkret risk;
- använd inte Lovable för konsultation, implementation, synk eller preview om användaren inte uttryckligen har bett om det.

Det snabbaste testet som kan falsifiera den aktuella visuella hypotesen ska köras först. En screenshot som visar att en knapp fortfarande ligger fel är mer värdefull i den iterationen än att först vänta på hela verifieringspaketet.

## När krävs full nivå 3-grind?

Full nivå 3-grind krävs normalt när en ändring påverkar:

- layout, informationshierarki eller responsivitet på en större yta;
- placering eller storlek på återkommande komponenter;
- huvudflöden på mobil eller desktop;
- tomlägen, långa texter eller innehåll som kan orsaka overflow i centrala flöden;
- demo-, exempel- eller livevyer som riskerar att glida isär.

Den krävs normalt inte för ren intern logik, dokumentation, copy utan layoutpåverkan eller osynliga tekniska ändringar. Små GUI-ändringar undantas däremot **inte** från nivå 1.

Nivå 3-grinden är oberoende av Lovable. Om Lovable inte uttryckligen har begärts ska ingen Lovable-kredit förbrukas och ingen Lovable-preview krävas.

## Lovable är opt-in

Lovable får endast användas när användaren uttryckligen ber om Lovable i den aktuella uppgiften. Det gäller samtliga användningssätt: konsultation, Agent mode/implementation, branch-synk och preview.

En formulering som "gör UX-review", "visa mig kandidaten" eller att en ändring råkar vara nivå 3 är inte i sig ett Lovable-godkännande. Använd då repots ordinarie browser-/screenshotflöde.

### Konsultation

När användaren uttryckligen ber att bolla UX med Lovable ska Lovable konsulteras i Plan mode innan den visuella lösningen låses, om verktyget är tillgängligt. Redovisa tydligt om konsultationen inte kunde genomföras.

### Implementation på PR-branchen

När användaren uttryckligen ber Lovable implementera visuell UX:

1. utgå från verifierad aktuell `main` och skapa en dedikerad featurebranch;
2. öppna eller förbered en draft-PR från samma branch;
3. välj exakt PR-branchen i Lovable;
4. verifiera branchens namn och aktuella head-SHA innan Lovable får skriva kod;
5. låt Lovable använda Agent mode endast inom det godkända visuella scopet;
6. granska Lovables diff och för därefter kandidaten genom normal PR- och verifieringsprocess.

Använd inte interna eller odokumenterade variantbegrepp som huvudflöde. Om rätt branch inte kan väljas eller verifieras ska Lovable inte skriva kod. Gå inte tyst över till egen full UX-implementation när användaren uttryckligen bett Lovable implementera.

Samla iterationer till en sammanhållen kandidat och experimentera inte direkt på `main`. En branch innebär inte automatiskt en isolerad databas.

## Nivå 3-grind före merge

För nivå 3/större visuella ändringar är följande mergekrav:

- exakt PR-branch och aktuell head-SHA är dokumenterade;
- 360 px mobil och desktop är granskade;
- relevanta states samt demo/exempelgrupp och live är jämförda när relevant och möjligt;
- persona-/UX-fynd är redovisade;
- användaren har fått ett tydligt granskningsunderlag och konkreta manuella teststeg i chatten;
- användaren har uttryckligen godkänt merge efter granskningen.

När användaren uttryckligen har begärt Lovable tillkommer:

- samma PR-branch vald i Lovable;
- Lovable-synken verifierad mot aktuell PR-head;
- aktuell Lovable-previewlänk lämnad i chatten;
- användaren har fått möjlighet att granska just den previewn före merge.

Om Lovable har begärts men branch, synk eller preview inte kan verifieras ska kandidaten inte markeras redo för merge på basis av Lovable-granskningen. Om Lovable inte har begärts används repots browserkontroller och screenshots/artifacts i stället och Lovable är inte en blockerare.

Preview och screenshots är granskningsunderlag, inte publicering. De ersätter inte diff, tester, browserkontroller eller CI.

## Browsergranskning och GitHub-artifacts

Repots browserkontroller är standardvägen för renderad granskning. GitHub-workflowen **Visual review artifacts** verifierar först att produktionsbygget lyckas och skapar därefter kompletterande fullsidesskärmbilder från samma commit i Chromium. Själva bilderna fångas via repots verifierade lokala Vite-server, eftersom Lovables Cloudflare-anpassade produktionsbundle inte är en fristående lokal Node-preview.

Workflowen kan startas på två sätt:

- manuellt med **Run workflow** och valfri branch/ref;
- från en icke-draft PR genom att markera `Skapa visuella granskningsbilder` i PR-mallen.

Den automatiska PR-körningen sker när en PR öppnas, återöppnas eller markeras redo med checkboxen redan markerad, eller när checkboxen ändras från omarkerad till markerad. Vanliga nya pushar till PR-branchen skapar inte en ny screenshot-artifact. Om koden ändras efter den senaste bildkörningen ska en ny artifact begäras uttryckligen med **Run workflow** eller genom att avmarkera och markera checkboxen igen.

Under draft används i första hand `bun run test:visual-smoke -- <routes>` för små iterationer. Den fulla lokala kandidatkontrollen är:

```bash
bun run test:visual-review
```

**Visual review artifacts** kör explicit på GitHub-hostad `ubuntu-24.04` och påverkas inte av den lokala `MATRUNDAN_CI_RUNNER`-override:n. Det håller granskningsgrinden tillgänglig även när den valfria self-hosted-runnern är offline, i linje med ordinarie CI:s runnerkontrakt.

Standardmatrisen fångar följande demosökvägar:

- `/?demo=1`;
- `/matstallen?demo=1`;
- `/matstallen/p7?demo=1`;
- `/platsunderhall?demo=1`.

Vid manuell körning kan andra komma- eller radseparerade sökvägar anges. Bilder skapas för 360 × 800 och 1280 × 900 och laddas upp som en GitHub Actions-artifact i 5 dagar.

Skärmbilderna är granskningsunderlag, inte golden snapshots. Workflowen gör ingen pixeljämförelse och ska inte användas för att låsa normal responsiv layout.

Om användaren uttryckligen begär Lovable-preview kan den användas som ytterligare manuellt produkt-/UX-underlag enligt opt-in-reglerna ovan. Den ersätter inte browsergranskningen eller CI.

## Manuell och agentbaserad kontroll

För varje GUI-ändring ska reviewkvittot minst ange:

- reviewnivå 1, 2 eller 3;
- vilka routes/states som faktiskt renderades;
- vilka viewportar som granskades;
- om screenshots var temporära eller uppladdade som artifact;
- konkreta visuella/UX-fynd och eventuella korrigeringar;
- vad som inte kunde verifieras.

För nivå 3 läggs även persona-resultat och användarens gransknings-/mergebesked till. Lovable-status, branch/synk och previewlänk läggs endast till när Lovable uttryckligen har begärts; annars anges kort `Lovable: inte begärt`.

Kontrollera att screenshots, artifacts och eventuell Lovable-preview verkligen motsvarar avsedd branch eller commit. Grön CI bekräftar inte visuell kvalitet och ett granskat visuellt underlag bekräftar inte att diffen eller CI är godkänd.

## Leveransgränser

Redovisa separat:

- PR-branch och head-SHA;
- PR och CI samt runnerläge;
- reviewnivå och granskade routes/states/viewportar;
- temporära screenshots respektive GitHub-artifact;
- konkreta UX-fynd och persona-resultat när nivå 3 används;
- Lovable begärt eller inte begärt;
- vald Lovable-branch, verifierad synk och previewlänk endast när Lovable begärts;
- användarens gransknings- och mergegodkännande;
- ej verifierade lägen;
- databas och migration;
- publicering.

`.lovable/plan.md` och tillfällig diagnostik får inte följa med till en färdig PR eller `main` utan uttryckligt godkännande.
