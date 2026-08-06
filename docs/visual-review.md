# Visuell granskning

Det här dokumentet beskriver hur större visuella ändringar granskas innan merge.
Det kompletterar `docs/development-workflow.md` och ersätter inte tester eller CI.

## När krävs visuell granskning?

Visuell granskning krävs normalt när en ändring påverkar:

- layout, informationshierarki eller responsivitet;
- placering eller storlek på återkommande komponenter;
- huvudflöden på mobil eller desktop;
- tomlägen, långa texter eller innehåll som kan orsaka overflow;
- demo-, exempel- eller livevyer som riskerar att glida isär.

Den krävs normalt inte för ren intern logik, dokumentation, copy utan
layoutpåverkan eller osynliga tekniska ändringar. Motivera undantag i PR:n.

## Lovable: konsultation och implementation

Skilj mellan att konsultera Lovable och att låta Lovable skriva kod.

### Konsultation

När användaren uttryckligen ber att bolla UX med Lovable ska Lovable konsulteras
i Plan mode innan den visuella lösningen låses, om verktyget är tillgängligt.
Konsultationen får inte hoppas över tyst bara för att branch switching inte kan
styras automatiskt. Redovisa tydligt om konsultationen inte kunde genomföras.

### Implementation på PR-branchen

Lovables normala isolerade arbetsflöde är GitHub-featurebranch tillsammans med
GitHub branch switching i Lovable:

1. utgå från verifierad aktuell `main` och skapa en dedikerad featurebranch;
2. öppna eller förbered en draft-PR från samma branch;
3. välj exakt PR-branchen i Lovable;
4. verifiera branchens namn och aktuella head-SHA innan Lovable får skriva kod;
5. låt Lovable använda Agent mode när användaren uttryckligen har bett om
   Lovable-implementation och krediter finns;
6. granska Lovables diff och för därefter kandidaten genom normal PR- och
   verifieringsprocess.

Använd inte interna eller odokumenterade variantbegrepp som huvudflöde. Om rätt
branch inte kan väljas eller verifieras ska Lovable inte skriva kod. Pausa och
be användaren välja branchen i Lovable-editorn. Gå inte tyst över till egen full
UX-implementation när användaren uttryckligen bett Lovable implementera.

Samla iterationer till en sammanhållen kandidat och experimentera inte direkt på
`main`. En branch innebär inte automatiskt en isolerad databas.

## Previewgrind före merge

För större visuella ändringar är följande ett mergekrav:

- exakt PR-branch och aktuell head-SHA är dokumenterade;
- samma branch är vald i Lovable;
- Lovable-synken motsvarar PR-head eller en dokumenterad senare commit på samma
  PR-branch;
- en aktuell Lovable-previewlänk har lämnats till användaren i chatten;
- användaren har fått möjlighet att granska previewn före merge;
- användaren har uttryckligen godkänt merge efter previewgranskningen.

Om branch, synk eller preview inte kan verifieras ska PR:n förbli draft eller
inte markeras redo för merge. En previewlänk som har löpt ut ska förnyas före
granskningsbesked.

Preview är granskning, inte publicering. Den publika appen får inte användas som
ersättning för en branchspecifik preview.

## Preview och artefakter

Lovable-preview används för manuell produkt- och UX-granskning. GitHub-workflowen
**Visual review artifacts** verifierar först att produktionsbygget lyckas och
skapar därefter kompletterande fullsidesskärmbilder från samma commit i
Chromium. Själva bilderna fångas via repots verifierade lokala Vite-server,
eftersom Lovables Cloudflare-anpassade produktionsbundle inte är en fristående
lokal Node-preview.

Workflowen kan startas på två sätt:

- manuellt med **Run workflow** och valfri branch/ref;
- från en PR genom att markera `Skapa visuella granskningsbilder` i PR-mallen.

Standardmatrisen fångar följande demosökvägar:

- `/?demo=1`;
- `/matstallen?demo=1`;
- `/matstallen/p7?demo=1`.

Vid manuell körning kan andra komma- eller radseparerade sökvägar anges. Bilder
skapas för 360 × 800 och 1280 × 900 och laddas upp som en GitHub Actions-artifakt
i 14 dagar.

Skärmbilderna är granskningsunderlag, inte golden snapshots. Workflowen gör ingen
pixeljämförelse och ska inte användas för att låsa normal responsiv layout.

## Manuell kontroll

För en större layoutändring ska minst följande granskas och redovisas:

- 360 px mobil och desktop;
- kort och långt innehåll;
- relevant tomläge och komplett data;
- exempelgrupp eller demo;
- autentiserat live-läge när det är tillgängligt och relevant;
- horisontell overflow, tryckytor och naturlig svensk copy.

Kontrollera att previewn och artefakten verkligen motsvarar avsedd branch eller
commit. Grön CI bekräftar inte visuell kvalitet och en granskad preview bekräftar
inte att diffen eller CI är godkänd.

## Leveransgränser

Redovisa separat:

- PR-branch och head-SHA;
- PR och CI;
- vald Lovable-branch och verifierad synk;
- previewlänk och datum när den lämnades i chatten;
- användarens preview- och mergegodkännande;
- manuellt granskade vyer;
- ej verifierade lägen;
- databas och migration;
- publicering.

`.lovable/plan.md` och tillfällig diagnostik får inte följa med till en färdig PR
eller `main` utan uttryckligt godkännande.
