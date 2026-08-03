# Personabaserade UX-tester

Det här paketet kompletterar Matrundans deterministiska Playwright-tester med öppna uppdrag där en mänsklig testare eller ett visuellt browserverktyg försöker förstå gränssnittet utan steg-för-steg-instruktioner.

## Syfte

Personatesterna ska hitta friktion som vanliga regressionstester har svårt att upptäcka:

- otydlig produktförståelse;
- oväntade första klick;
- handlingar som är tekniskt möjliga men svåra att hitta;
- copy som misstolkas;
- bristande förtroende kring gruppdata, delning eller externa tjänster;
- mobilflöden där användaren backar, tvekar eller ger upp.

De ersätter inte riktiga användartester. De skapar hypoteser och reproducerbar evidens som kan tas vidare till människor och deterministiska regressionstester.

## Tre lager

1. **Deterministisk regression** i `tests/e2e/` verifierar kända krav och är mergegrind.
2. **Visuell black-box-runda** använder en persona, ett uppdrag och endast det renderade gränssnittet.
3. **Kodmedveten analys** får efter rundan läsa trace, loggar och kod för att förklara ett observerat problem.

Blanda inte lager 2 och 3. En testare eller agent som redan har läst komponenter, test-id:n eller befintliga E2E-tester simulerar inte längre en ny användare.

## Förutsättningar

För en visuell black-box-runda behövs en browsermiljö som kan:

- visa skärmbilder för testaren eller modellen;
- klicka, scrolla och skriva;
- behålla en separat browserkontext per persona;
- spara skärmbilder och gärna video eller Playwright-trace;
- återställa testdata mellan körningar.

Computer Use eller ett motsvarande visuellt browserverktyg är därför lämpligare än rena Playwright-selectors. Codex Cloud kan köra appen och Playwright lokalt eftersom projektets setup installerar Chromium, men terminalåtkomst ensam ger inte modellen visuell input.

## Black-box-regler

Testaren eller verktyget ska:

- få en persona och ett uppdrag, inte en klickinstruktion;
- börja från angiven URL och beskriva sin första tolkning innan första klicket;
- använda synlig text, position och visuell hierarki;
- inte läsa produktkod, routes eller befintliga tester under rundan;
- inte använda DOM-inspektion eller test-id:n som genväg;
- inte ändra repo, databasstruktur eller produktionsdata;
- dokumentera felklick, backningar, tvekan och varför nästa handling valdes;
- stoppa vid uppdragets slutvillkor eller när personans ge-upp-gräns nåtts.

En separat felsökningsfas får därefter läsa kod och tekniska artefakter.

## Körning

1. Välj en fil under `personas/`.
2. Välj en fil under `missions/` som passar personan.
3. Starta en ny browserkontext i exempelgruppen eller en isolerad staginggrupp.
4. Ge testaren eller verktyget endast persona, uppdrag, start-URL och rapportformat.
5. Spara en skärmbild före varje viktigt beslut och efter slutläget.
6. Validera rapporten mot `report-schema.md`.
7. Kör samma uppdrag med minst två andra relevanta personor innan ett generellt UX-problem antas.

## Testmiljöer

### Exempelgruppen

Används först eftersom data är fiktiv, ändringar är sessionsbaserade och gruppen kan återställas. Varje persona ska få en egen browserkontext.

### Autentiserade flöden

Inbjudan, roller och gruppisolering kräver senare en separat testmiljö med:

- dedikerade testkonton för ägare, admin och medlem;
- deterministisk seed och reset;
- unik grupp per körning;
- blockerad extern publicering till exempelvis OpenStreetMap;
- automatisk städning.

Personatester ska inte skriva mot produktion.

## Evidens

Varje rapport ska innehålla:

- persona och uppdrag;
- miljö, viewport och start-URL;
- slutfört eller inte slutfört;
- första tolkning av varje viktig vy;
- valda handlingar och förväntat resultat;
- faktiskt resultat;
- felklick, backningar och hjälpsökning;
- observation skild från analytisk inferens;
- allvarlighetsgrad och säkerhet i fyndet;
- skärmbilder, video, trace eller loggreferenser.

## Från fynd till regressionstest

Flytta ett fynd till `tests/e2e/` när det:

1. är reproducerbart;
2. påverkar en viktig del av gruppens gemensamma matresa;
3. kan uttryckas som ett entydigt krav;
4. inte bygger på en enskild testares eller agents smakbedömning.

Personatester ska initialt köras manuellt eller vid särskilda UX-rundor. De ska inte blockera merge förrän stabilitet, kostnad och falskpositivnivå är kända.

## Verktygsneutralitet och ägarskap

Det här repot versionshanterar Matrundans egna personor, uppdrag, rapportkontrakt och deterministiska regressionstester. Det innehåller inte repobundna roller för Codex eller någon annan specifik agentplattform och påstår inte att en automatiserad visuell testmotor finns.

Ett mänskligt testupplägg, Computer Use eller ett framtida agentramverk kan läsa samma underlag. Om en generell testmotor senare byggs för flera appar bör den ligga i ett separat repo, medan Matrundans produktnära personor och uppdrag stannar här. En appnära adapter eller körkonfiguration kan då läggas under `tests/ux-agent/` i Matrundan först när det finns en faktisk, reproducerbar motor att anropa.

Utan ett verktyg som faktiskt ger skärmbilder tillbaka till testaren eller modellen får en körning endast förbereda uppdrag eller analysera redan insamlade artefakter, inte påstå att ett visuellt användartest har genomförts.
