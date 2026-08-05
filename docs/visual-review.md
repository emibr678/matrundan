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

## Isolerad arbetsyta

1. Utgå från en verifierad fullständig commit-SHA.
2. Använd i första hand en Lovable-variant när funktionen finns.
3. Använd annars en dedikerad GitHub-featurebranch och välj den i Lovable när
   branch switching finns.
4. Om rätt variant, branch eller commit inte kan verifieras ska Lovable inte
   användas för implementationen.
5. Samla iterationer till en sammanhållen kandidat. Experimentera inte direkt
   på `main`.

En variant eller branch innebär inte automatiskt en isolerad databas.

## Preview och artefakter

Lovable-preview används för manuell produkt- och UX-granskning. GitHub-workflowen
**Visual review artifacts** skapar kompletterande fullsidesskärmbilder från en
produktionsbuild i Chromium.

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

- branch och commit;
- PR och CI;
- Lovable-synk och verifierad preview;
- manuellt granskade vyer;
- ej verifierade lägen;
- databas och migration;
- publicering.

`.lovable/plan.md` och tillfällig diagnostik får inte följa med till en färdig PR
eller `main` utan uttryckligt godkännande.
