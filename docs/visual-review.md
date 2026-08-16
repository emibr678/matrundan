# Visuell och UX-granskning

Det här dokumentet beskriver hur renderade GUI-ändringar granskas innan de rapporteras som färdiga eller mergas. Det kompletterar `docs/development-workflow.md` och ersätter inte kodgranskning, tester, CI eller användarens previewgrind.

Målet är att uppenbara problem som dubletter, rörig hierarki, spacing, felplacerade knappar, trunkering och overflow ska upptäckas av agenten **före** användarens manuella previewgranskning, utan att varje liten ändring blir en tung eller dyr testkörning.

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
- Lovable-konsultation i Plan mode när användaren uttryckligen har bett om UX-konsultation;
- strukturerad persona-/perspektivgranskning;
- aktuell Lovable-preview och användarens uttryckliga mergegodkännande enligt previewgrinden nedan.

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
- vilken korrigering som rekommenderas före previewgrinden.

## Kostnad, lagring och körtid

GitHub Free-kvoter och runnerkapacitet är en faktisk projektbegränsning. Visuell kvalitet ska därför inte lösas genom att lagra varje iterations screenshots eller köra hela browsermatrisen efter varje liten ändring.

Följ dessa principer:

- temporära lokala/Codex-screenshots är förstahandsval under implementation;
- katalogen `visual-review/` är git-ignorerad och fungerar som tillfällig arbetsyta;
- **Visual review artifacts** är opt-in och reserveras främst för färdigare kandidater och större visuella ändringar där beständigt granskningsunderlag ger värde;
- behåll kort artifact-retention;
- spara inte traces eller videos som standard;
- börja med en eller ett fåtal berörda routes/states;
- kör bredare verifiering först när kandidaten stabiliserats;
- använd inte en full cross-browser-matris för en lokal visuell korrigering utan konkret risk.

Det snabbaste testet som kan falsifiera den aktuella visuella hypotesen ska köras först. En screenshot som visar att en knapp fortfarande ligger fel är mer värdefull i den iterationen än att först vänta på hela verifieringspaketet.

## När krävs full previewgrind?

Full nivå 3 och previewgrind krävs normalt när en ändring påverkar:

- layout, informationshierarki eller responsivitet på en större yta;
- placering eller storlek på återkommande komponenter;
- huvudflöden på mobil eller desktop;
- tomlägen, långa texter eller innehåll som kan orsaka overflow i centrala flöden;
- demo-, exempel- eller livevyer som riskerar att glida isär.

Den krävs normalt inte för ren intern logik, dokumentation, copy utan layoutpåverkan eller osynliga tekniska ändringar. Små GUI-ändringar undantas däremot **inte** från nivå 1.

## Lovable: konsultation och implementation

Skilj mellan att konsultera Lovable och att låta Lovable skriva kod.

### Konsultation

När användaren uttryckligen ber att bolla UX med Lovable ska Lovable konsulteras i Plan mode innan den visuella lösningen låses, om verktyget är tillgängligt. Konsultationen får inte hoppas över tyst bara för att branch switching inte kan styras automatiskt. Redovisa tydligt om konsultationen inte kunde genomföras.

### Implementation på PR-branchen

Lovables normala isolerade arbetsflöde är GitHub-featurebranch tillsammans med GitHub branch switching i Lovable:

1. utgå från verifierad aktuell `main` och skapa en dedikerad featurebranch;
2. öppna eller förbered en draft-PR från samma branch;
3. välj exakt PR-branchen i Lovable;
4. verifiera branchens namn och aktuella head-SHA innan Lovable får skriva kod;
5. låt Lovable använda Agent mode när användaren uttryckligen har bett om Lovable-implementation och krediter finns;
6. granska Lovables diff och för därefter kandidaten genom normal PR- och verifieringsprocess.

Använd inte interna eller odokumenterade variantbegrepp som huvudflöde. Om rätt branch inte kan väljas eller verifieras ska Lovable inte skriva kod. Pausa och be användaren välja branchen i Lovable-editorn. Gå inte tyst över till egen full UX-implementation när användaren uttryckligen bett Lovable implementera.

Samla iterationer till en sammanhållen kandidat och experimentera inte direkt på `main`. En branch innebär inte automatiskt en isolerad databas.

## Previewgrind före merge

För nivå 3/större visuella ändringar är följande ett mergekrav:

- exakt PR-branch och aktuell head-SHA är dokumenterade;
- samma PR-branch är vald i Lovable;
- Lovable-synken motsvarar PR-head eller en dokumenterad senare commit på samma PR-branch;
- en aktuell Lovable-previewlänk har lämnats till användaren i chatten;
- användaren har fått möjlighet att granska previewn före merge;
- 360 px mobil och desktop är granskade;
- demo/exempelgrupp och live är jämförda när relevant;
- persona-/UX-fynd är redovisade för det större huvudflödet;
- användaren har uttryckligen godkänt merge efter previewgranskningen.

Om branch, synk eller preview inte kan verifieras ska PR:n förbli draft eller inte markeras redo för merge. En previewlänk som har löpt ut ska förnyas före granskningsbesked.

Preview är granskning, inte publicering. Den publika appen får inte användas som ersättning för en branchspecifik preview.

## Preview och GitHub-artifacts

Lovable-preview används för manuell produkt- och UX-granskning. GitHub-workflowen **Visual review artifacts** verifierar först att produktionsbygget lyckas och skapar därefter kompletterande fullsidesskärmbilder från samma commit i Chromium. Själva bilderna fångas via repots verifierade lokala Vite-server, eftersom Lovables Cloudflare-anpassade produktionsbundle inte är en fristående lokal Node-preview.

Workflowen kan startas på två sätt:

- manuellt med **Run workflow** och valfri branch/ref;
- från en icke-draft PR genom att markera `Skapa visuella granskningsbilder` i PR-mallen.

Den automatiska PR-körningen sker när en PR öppnas, återöppnas eller markeras redo med checkboxen redan markerad, eller när checkboxen ändras från omarkerad till markerad. Vanliga nya pushar till PR-branchen skapar inte en ny screenshot-artifact. Om koden ändras efter den senaste bildkörningen ska en ny artifact begäras uttryckligen med **Run workflow** eller genom att avmarkera och markera checkboxen igen.

Under draft används i första hand `bun run test:visual-smoke -- <routes>` för små iterationer. Den fulla lokala kandidatkontrollen är:

```bash
bun run test:visual-review
```

Workflowen använder samma runner-val som ordinarie CI. Repository-variabeln `MATRUNDAN_CI_RUNNER=matrundan-self-hosted` gör därför även visuella artifacts möjliga när GitHub-hostad kapacitet är otillgänglig; utan variabel används `ubuntu-24.04`.

Standardmatrisen fångar följande demosökvägar:

- `/?demo=1`;
- `/matstallen?demo=1`;
- `/matstallen/p7?demo=1`;
- `/platsunderhall?demo=1`.

Vid manuell körning kan andra komma- eller radseparerade sökvägar anges. Bilder skapas för 360 × 800 och 1280 × 900 och laddas upp som en GitHub Actions-artifact i 5 dagar.

Skärmbilderna är granskningsunderlag, inte golden snapshots. Workflowen gör ingen pixeljämförelse och ska inte användas för att låsa normal responsiv layout.

## Manuell och agentbaserad kontroll

För varje GUI-ändring ska reviewkvittot minst ange:

- reviewnivå 1, 2 eller 3;
- vilka routes/states som faktiskt renderades;
- vilka viewportar som granskades;
- om screenshots var temporära eller uppladdade som artifact;
- konkreta visuella/UX-fynd och eventuella korrigeringar;
- vad som inte kunde verifieras.

För nivå 3 läggs även persona-resultat, Lovable-status, previewlänk och användarens granskningsbesked till.

Kontrollera att previewn och eventuella artifacts verkligen motsvarar avsedd branch eller commit. Grön CI bekräftar inte visuell kvalitet och en granskad preview bekräftar inte att diffen eller CI är godkänd.

## Leveransgränser

Redovisa separat:

- PR-branch och head-SHA;
- PR och CI samt runnerläge;
- reviewnivå och granskade routes/states/viewportar;
- temporära screenshots respektive GitHub-artifact;
- konkreta UX-fynd och persona-resultat när nivå 3 används;
- vald Lovable-branch och verifierad synk;
- previewlänk och datum när den lämnades i chatten;
- användarens preview- och mergegodkännande;
- ej verifierade lägen;
- databas och migration;
- publicering.

`.lovable/plan.md` och tillfällig diagnostik får inte följa med till en färdig PR eller `main` utan uttryckligt godkännande.
