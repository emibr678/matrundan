# Personabaserade UX-tester

Det här paketet kompletterar Matrundans deterministiska Playwright-tester med öppna uppdrag där en testare eller browseragent försöker förstå gränssnittet utan steg-för-steg-instruktioner.

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

Blanda inte lager 2 och 3. En agent som redan har läst komponenter, test-id:n eller befintliga E2E-tester simulerar inte längre en ny användare.

## Förutsättningar

För en visuell black-box-runda behövs en browsermiljö som kan:

- visa skärmbilder för modellen;
- klicka, scrolla och skriva;
- behålla en separat browserkontext per persona;
- spara skärmbilder och gärna video eller Playwright-trace;
- återställa testdata mellan körningar.

Computer Use eller ett motsvarande visuellt browserverktyg är därför lämpligare än rena Playwright-selectors. Codex Cloud kan köra appen och Playwright lokalt eftersom projektets setup installerar Chromium, men terminalåtkomst ensam ger inte modellen visuell input.

## Black-box-regler

Personaagenten ska:

- få en persona och ett uppdrag, inte en klickinstruktion;
- börja från angiven URL och beskriva sin första tolkning innan första klicket;
- använda synlig text, position och visuell hierarki;
- inte läsa produktkod, routes eller befintliga tester under rundan;
- inte använda DOM-inspektion eller test-id:n som genväg;
- inte ändra repo, databasstruktur eller produktionsdata;
- dokumentera felklick, backningar, tvekan och varför nästa handling valdes;
- stoppa vid uppdragets slutvillkor eller när personans ge-upp-gräns nåtts.

En separat felsökningsagent får därefter läsa kod och tekniska artefakter.

## Körning

1. Välj en fil under `personas/`.
2. Välj en fil under `missions/` som passar personan.
3. Starta en ny browserkontext i exempelgruppen eller en isolerad staginggrupp.
4. Ge agenten endast persona, uppdrag, start-URL och rapportformat.
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

Personaagenter ska inte skriva mot produktion.

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
4. inte bygger på en enskild agents smakbedömning.

Personatester ska initialt köras manuellt eller vid särskilda UX-rundor. De ska inte blockera merge förrän stabilitet, kostnad och falskpositivnivå är kända.

## Codex-agenter

Projektets `.codex/agents/` innehåller read-only roller som motsvarar personorna. Modellval anges inte i projektfilerna, eftersom den effektiva modellen kan bero på den aktuella Codex-miljön. Orkestratorn ska verifiera faktisk runtime och ge varje agent en separat, begränsad uppgift.

För en genuint visuell runda ska agenten köras med ett browserverktyg som kan ge skärmbilder tillbaka till modellen. Utan ett sådant verktyg ska agenten endast förbereda uppdrag eller analysera redan insamlade artefakter, inte påstå att den har genomfört ett visuellt användartest.
