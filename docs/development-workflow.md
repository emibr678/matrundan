# Utvecklings- och leveransflöde

Det här dokumentet är den kanoniska processen för produktdiskussion, planering,
godkänd implementation, verifiering, merge, Lovable-synk och publicering.

Miljösetup, låst Bun-version och exakta kommandon finns i
[DEVELOPMENT.md](../DEVELOPMENT.md). Arkitektur- och säkerhetsregler finns i
[architecture.md](./architecture.md). Beslutad produktinriktning, paket och
backlogflöde finns i [product-roadmap.md](./product-roadmap.md).

## 1. Faser

Arbetet ska alltid kunna beskrivas som en av följande faser:

1. **Produktdiskussion** – mål, användarbehov och avgränsning.
2. **Planering** – konkret lösning, risker, datamodell och tester.
3. **Godkänd implementation** – kod och migrationer inom uttryckligen godkänt
   scope.
4. **Verifiering** – statiska kontroller, tester, CI och manuell kontroll.
5. **Merge** – en verifierad ändring förs in i `main`.
6. **Publicering** – databasdriftsättning och publik release.

En ny funktion eller större förändring kräver uttryckligt
godkännande innan implementation. Publicering kräver ett separat uttryckligt
godkännande även när implementationen redan är mergad.

Korrigerande dokumentation och små underhållsändringar får göras inom ett
uttryckligt granskningsuppdrag, men får inte användas för att smyga in nytt
produktbeteende.

## 2. Scope och planering

Innan en icke-trivial implementation:

1. inspektera aktuell kod, migrationer och dokumentation;
2. identifiera vilken källa som faktiskt är kanonisk;
3. formulera mål, avgränsningar, edge cases och verifiering;
4. skilj produktbeslut från tekniskt genomförande;
5. invänta implementationsgodkännande när ändringen är en ny funktion eller
   större förändring.

Ett godkänt scope ska genomföras som minsta sammanhängande lösning. Bredda inte
uppgiften tyst och blanda inte in orelaterad refaktorering.

### Roadmap och GitHub Issues

`docs/product-roadmap.md` är den kanoniska översikten över beslutade paket,
prioriteringar och varaktiga produktavgränsningar. GitHub Issues är den konkreta
backloggen.

- Nya idéer registreras normalt med `status:inbox`.
- Efter produktdiskussion dokumenteras användarbehov, överenskommet scope,
  icke-mål, integritet och öppna beslut i issuen och status sätts till
  `status:agreed`.
- En aktuell teknisk plan tas fram först när funktionen närmar sig genomförande,
  eftersom kod och databas kan ha ändrats sedan produktbeslutet.
- Efter uttryckligt implementationsgodkännande sätts `status:ready`.
- En implementerande PR ska referera eller stänga sitt issue.

Redan dokumenterade produktbeslut ska inte behöva diskuteras om från början i
en ny chatt. Om aktuell kod, nya fakta eller ett tydligt produktproblem kräver
en ändring ska issuen och vid behov roadmapen uppdateras innan scope breddas.

Varje större feature-plan och PR ska bedöma om exempelgruppen eller dess
scenariokontrakt behöver uppdateras. Ett nej ska motiveras när ändringen påverkar
ett användarflöde.

## 3. Arbetsyta och Git

Återanvänd en verifierad checkout. Klona endast när miljön är ny, checkouten
saknas eller dess tillstånd inte kan återställas säkert.

En ny godkänd uppgift får normalt en branch från aktuell `main`:

```bash
git fetch origin --prune
git switch main
git pull --ff-only
git switch -c agent/<beskrivande-namn>
```

Använd en branch och en PR per sammanhängande uppgift. Skapa inte nya branches,
PR:er eller commits för varje felsökningshypotes.

Historik som redan har pushats och synkats till Lovable får inte skrivas om med
force-push, rebase eller amend. En PR med många arbetscommits kan squash-mergas
av GitHub när det inte skriver om den publicerade feature-branchens historik.

## 4. Diagnostik före fix

En icke-trivial bugg ska börja med reproduktion och bevis:

1. reproducera felet i relevant miljö;
2. samla runtime-data som skiljer fungerande och trasigt beteende;
3. klassificera felet, exempelvis data, layout, renderering, nätverk,
   behörighet, miljö eller integration;
4. formulera en falsifierbar hypotes;
5. gör minsta riktade diagnostik eller ändring;
6. kontrollera resultatet innan nästa hypotes;
7. implementera slutlig fix när grundorsaken stöds av observerade data;
8. ta bort tillfällig diagnostik som inte ska vara permanent.

För kartproblem bör diagnostik i första hand visa containerns och canvasens
mått, MapLibre-källor och lager, resursstatus, WebGL/workerstatus och skillnaden
mellan isolerad komponent och produktflöde.

## 5. Implementation och lokal iteration

Flera små iterationer ska göras i samma arbetsyta före push:

```text
reproducera
→ diagnostik
→ lokal ändring
→ riktad kontroll
→ lokal justering
→ sammanhängande commit
→ push
```

Pusha när det finns en granskbar kandidat, en preview behövs för verklig
enhetstestning eller en viktig checkpoint måste bevaras. Pusha inte varje
experiment och skapa inte commits enbart för att trigga CI.

GitHub Actions verifierar kod. Workflows får inte användas som en fjärrstyrd
editor som patchar, committar eller pushar produktkod tillbaka till branchen.

## 6. Verifiering

Använd kommandona som definieras i `package.json` och beskrivs i
[DEVELOPMENT.md](../DEVELOPMENT.md).

Under iteration:

```bash
bun run doctor
bun run verify:changed
```

När UI eller huvudflöden har ändrats:

```bash
bun run verify:agent
```

För en färdig releasekandidat:

```bash
bun run verify:full
```

Kör även fokuserade tester för berörd domän, exempelvis en enhetstestfil eller
kartsviten. Ett test får bara rapporteras som utfört när det faktiskt har körts.
En saknad autentiserad live-session ska redovisas som en begränsning, inte döljas
bakom grön demo-CI.

Databas- och RPC-ändringar kräver dessutom manuell granskning av:

- autentisering, medlemskap och rollkrav;
- `SECURITY DEFINER` och låst `search_path`;
- grants för `PUBLIC`, `anon`, `authenticated` och `service_role`;
- isolering mellan grupper;
- bevarande av befintliga produktionsrader.

## 7. CI-nivåer

Draft-PR kör den snabba men kompletta kodkedjan:

- miljökontroll och verktygsskydd;
- shellsyntax;
- Prettier och ESLint på ändrade filer;
- alla enhetstester under `src`;
- TypeScript;
- produktionsbygge.

När en PR markeras redo, när `main` uppdateras eller vid manuell fullkörning
läggs relevanta browserkontroller till:

- mobil Chromium för UI-ändringar;
- WebKit/iPhone och desktop Chromium för kartrelaterade ändringar.

Ändringsklassificeringen i `scripts/repo-tools.mjs` ska hållas uppdaterad när nya
centrala UI- eller kartfiler tillkommer.

## 8. PR och merge

En PR ska vara draft medan implementation eller diagnostik pågår.

Innan den markeras redo ska följande vara tydligt:

- relaterat GitHub Issue och godkänt scope;
- motivering eller verifierad grundorsak;
- viktigaste ändringar;
- databas- och integritetskonsekvenser;
- om exempelgruppen eller scenariokontraktet ändrades, redan täcker behovet eller
  inte är relevant;
- om roadmapen behöver markera en färdig funktion, avsluta ett paket eller
  ändra nästa prioritet;
- utförda kontroller;
- manuella teststeg;
- sådant som inte kunde verifieras;
- om publicering ingår eller inte.

Merge får ske när scope är uppfyllt, diffen är granskad, relevant CI är grön och
inga kända blockerare återstår. Merge innebär inte automatiskt att databasen är
driftsatt, att Lovable-previewn har synkat eller att den publika appen är
publicerad.

### Efter merge: backlog- och roadmapkvitto

Efter merge av en implementerande PR ska följande kontrolleras och redovisas:

1. bekräfta att `Closes #...` stängde rätt issue;
2. ta bort `status:ready` om etiketten ligger kvar på ett stängt issue;
3. behåll typ- och prioritetslabel när de hjälper historisk sökning;
4. kontrollera att roadmapen fortfarande beskriver aktivt och kommande arbete;
5. markera en färdig issue kort med `✅` om dess paket fortfarande pågår;
6. om paketets sista issue stängdes, flytta paketet till **Genomförda paket**;
7. gör en kort produktbedömning innan nästa paket eller issue får
   `priority:now` och uppdatera både roadmap och berörda labels;
8. redovisa changelog/version, arkitektur, databas, Lovable-synk, preview och
   publicering separat.

Roadmap- och labeländringar görs helst i den avslutande implementations-PR:n när
det är tydligt att funktionen eller paketet blir klart. Om det inte är lämpligt
ska en omedelbart följande docs-only PR skapas. GitHub Actions får verifiera
reglerna men ska inte automatiskt skriva om roadmapen eller välja prioritet.

## 9. Lovable, preview och publicering

Projektets previeworigin är:

`https://id-preview--d389634e-227c-4689-85ed-8714fdc602f7.lovable.app`

Den publika appen är:

`https://matrundan.lovable.app`

Skilj alltid mellan:

- commit pushad;
- PR mergad;
- Lovable har synkat aktuell commit;
- previewn har laddats;
- funktionen har verifierats i preview;
- databasmigrationen är applicerad;
- funktionen är verifierad på verklig mobil enhet;
- den publika appen är publicerad.

Skriv inte att synk, driftsättning eller publicering är klar utan faktisk
bekräftelse.

## 10. Leveranskvitto

Efter en push eller merge som är avsedd att testas ska status redovisas med de
fält som är relevanta:

```text
Fas:
Branch:
Commit:
PR:
CI:
Issue:
Issue stängd:
Roadmap:
Exempelgrupp:
Changelog/version:
Arkitektur:
Lovable-synk:
Preview:
Testa:
Ej verifierat:
Databas:
Publicering:
Nästa rekommenderade issue:
```

## 11. Dokumentationsansvar

Varje typ av information ska ha en tydlig källa:

- `README.md` – kort, aktuell projektöversikt och startpunkt;
- `CHANGELOG.md` – släppta och ännu inte publicerade användarförändringar;
- `docs/product-roadmap.md` – beslutade produktpaket, prioritering och
  backlogprocess;
- GitHub Issues – detaljerat scope och status för konkreta funktioner och
  buggar;
- `docs/architecture.md` – varaktiga arkitektur- och säkerhetsbeslut;
- `DEVELOPMENT.md` – miljösetup och kanoniska kommandon;
- detta dokument – arbets- och leveransprocess;
- `AGENTS.md` – bindande instruktioner för kodande agenter;
- `docs/archive/` – historiska dokument som inte längre är kanoniska.

README ska inte duplicera en lång releasehistorik eller fungera som en parallell
backlog. Avslutade implementationsplaner ska tas bort eller arkiveras när deras
varaktiga beslut har flyttats till arkitektur, roadmap och changelog.

## 12. Antimönster

Undvik:

- upprepade kloner i samma beständiga arbetsyta;
- nya branches eller PR:er för varje hypotes;
- generiska commitmeddelanden som `Changes`, `x` eller `Work in progress`;
- commits som endast triggar workflows;
- självmodifierande GitHub Actions-workflows;
- full browsermatris efter varje liten diagnostikändring;
- global skrivande formattering när bara några filer ändrats;
- parallella verktyg för samma kontroll, exempelvis både `tsgo` och `tsc`;
- att blanda produktfunktion, CI-ombyggnad och publicering i samma PR;
- att förlita sig på en gammal chatt som enda källa till ett produktbeslut;
- att använda README, `.lovable/plan.md` eller lösa TODO-listor som parallell
  backlog;
- att lämna ett stängt issue med `status:ready` eller en aktiv roadmap som visar
  ett redan avslutat paket som pågående;
- flera dokument som gör anspråk på att vara kanoniska för samma sak.
