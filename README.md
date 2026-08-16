# Matrundan

Matrundan är en privat, gruppcentrerad webbapp för vänner och familjer som vill
upptäcka, välja, besöka och minnas matställen tillsammans.

Kärnan är gruppens gemensamma matresa:

1. samla ställen gruppen är nyfiken på;
2. bestäm nästa gemensamma stopp;
3. registrera verkliga besök och faktiska deltagare;
4. bevara privata omdömen, favoriter, foton och historik;
5. använda historiken som inspiration till nästa upplevelse.

Matrundan är inte en offentlig restaurangkatalog, publik recensionsplattform,
individuell matdagbok, social feed eller global ranking.

## Viktigaste funktionerna

- Privata grupper med ägare, administratörer, medlemmar och tokenbaserade
  inbjudningar.
- Gruppens egen lista över matställen att prova och redan besökta favoriter.
- Geoapify-sökning från upp till fem verifierade sökområden med en gemensam
  radie på 1, 2, 3, 5, 10, 25 eller 50 km.
- Alla sparade sökområden är förvalda i sökningen och kan slås av eller på som
  mobilvänliga valbrickor. En tillfällig annan plats kan användas utan att
  gruppinställningen ändras.
- Deduplicerade sökresultat i lista och karta. Nya och tidigare borttagna
  ställen visas som möjliga att lägga till, medan aktiva gruppställen samlas i
  den stängda sektionen **Redan i gruppen**.
- Matställets egen webbplats och Google Maps visas konsekvent före och efter
  tillägg när en säker länk finns. Geoapify- och OpenStreetMap-identiteter
  bevaras separat så platsdata kan följas över tid utan att äldre besök skrivs
  om.
- Matställen med en aktiv Geoapify-källa kan visa **Öppettider idag** och ett
  utfällbart veckoschema på detaljsidan. Tiderna visas som kartdata med
  hämtningstid och reservation för specialdagar eller inaktuella uppgifter;
  Matrundan ger inte ett osäkert **Öppet nu**-besked.
- Alla aktiva medlemmar kan lägga till eller rätta gruppens webbplats och
  öppettider med en privat källänk eller observation. Ändringen används direkt
  i gruppen och skapar vid behov ett privat granskningsunderlag för admin; inget
  publiceras automatiskt till OpenStreetMap.
- Gruppens praktiska information har ändringshistorik och kan återställas till
  kartdatan. Senaste Geoapify/OSM-data kan hämtas på nytt utan att en aktiv
  gruppöverstyrning skrivs över tyst.
- En källstödd ändring av webbplats eller öppettider kan visas som ett anonymt,
  fältvist förslag i andra grupper som redan använder samma kanoniska
  matställe. Varje grupp väljer själv om förslaget ska användas. Motstridiga
  uppgifter visas som osäkra och ingen gruppuppgift skrivs över automatiskt.
- Manuella matställen kan få en verifierad kartposition och ett privat neutralt
  underlag om att en extern källa behöver kontrolleras eller länkas. Inget
  publiceras automatiskt.
- När en senare Geoapify- eller OSM-träff säkert motsvarar ett providerlöst
  manuellt ställe kan källan länkas till det befintliga stället utan att skapa
  en dubblett eller skriva om gruppens historik.
- Flera nya sökträffar kan markeras och läggas till i samma omgång. Providerdata
  används där den finns och osäkra gruppuppgifter kan kompletteras senare.
- Filter för **Saknar uppgifter** hjälper gruppen hitta ställen utan kök och
  inriktning eller Passar för.
- Alla aktiva medlemmar kan komplettera gruppens platsuppgifter. Ägare och
  administratörer behåller ansvar för borttagning, återställning och dolda
  sökträffar.
- Ägare och administratörer kan dölja en felaktig eller inaktuell providerträff
  enbart för den aktuella gruppen. Dolda träffar kan öppnas under
  gruppinställningarna för kontroll, rapportering och återställning.
- Alla aktiva medlemmar kan rapportera felaktig platsinformation privat både
  från matställets detaljsida och från en sökträff innan den läggs till.
  Rapporten behåller sin gruppbundna data, medan strukturerad feltyp och säker
  neutral platsinformation kan projiceras till den globala arbetsytan
  **Platsunderhåll**.
- **Platsunderhåll** samlar rapporterade platsfel och neutrala
  förbättringskandidater i en gemensam arbetskö för särskilt behöriga
  platsunderhållare. Ursprunglig grupp, rapportör, medlemskap och historisk
  privat rapporttext visas inte där.
- Rapportering och döljning är separata handlingar. Rapportering skapar ett
  privat underlag för datakvalitetsarbete, medan döljning bara påverkar den
  aktuella gruppens sökningar och kan ångras när som helst.
- Ärenden i Platsunderhåll kan markeras för manuellt OSM-arbete. Matrundan gör
  ingen automatisk OSM-publicering eller redigering i det globala
  underhållsflödet; befintlig offentlig OSM Note-historik bevaras när sådan redan
  finns.
- Anonyma och åldrande platsdatasignaler kan varna om att ett ställe kan ha
  stängt permanent utan att ursprungsgrupp, medlem, rapporttext, antal eller
  interna identifierare lämnas ut. Den aktuella gruppens privata underlag
  används inte som signal tillbaka till vanliga medlemmar i samma grupp.
- Aktiva live-medlemmar kan lämna en enkel med- eller motbekräftelse utan
  fritext. Motstridiga uppgifter visas som osäkra och nyliga verkliga besök kan
  fungera som anonym motbevisning.
- **Begränsad platsinformation** visas separat när både webbplats och
  öppettider uttryckligen saknas i providerträffen. Det betyder inte att
  verksamheten har stängt.
- Nästa stopp kan föreslås manuellt eller slumpas.
- Gruppen kan föreslå datum och valfri tid, svara **Passar**, **Passar inte**
  eller **Osäker** och bekräfta planen utan automatisk majoritetslogik.
- Besök registreras med datum, måltid, faktiska deltagare, omdömen och ett
  valfritt privat foto. Den som registrerar ett nytt besök räknas alltid som
  faktisk deltagare och lämnar sitt eget omdöme; namngivna besöksgäster kan
  läggas till utan att bli gruppmedlemmar eller få progression och visas vid
  delning endast som ett anonymt antal.
- En annan faktisk deltagare kan komplettera samma kanoniska besök med sitt eget
  omdöme. Den som felaktigt lagts till kan välja **Jag var inte med** och senare
  återställa **Jag var med**; progression och aktiva deltagaromdömen följer den
  korrigerade närvaron. Registreraren kan inte korrigera bort sin egen närvaro
  på ett besök hen själv skapat.
- Gruppens gemensamma besökshistorik nås via **Visa alla besök** på Hem och visar
  det senaste först med samma privata besöksdetaljer som matställesvyn.
- **Passar för** kan lämnas tomt eller anges med upp till två likvärdiga val. Ett
  ställe med två val kan visas i båda gruppens privata topplistor.
- Kanoniska platser och besök kan delas mellan användarens grupper utan att
  dupliceras eller avslöja ursprungsgrupp, privata kommentarer, gästnamn eller
  medlemskap.
- Personliga favoriter, privata topplistor, medlemsprofiler och diskret
  gamification som räknar verkligt deltagande och återbesök.
- Push-notiser, installation på hemskärmen, publik integritetssida och
  självbetjänad kontoradering med anonymiserad gemensam historik.

Se [CHANGELOG.md](./CHANGELOG.md) för släppta och ännu inte publicerade
ändringar.

## Körlägen

### Publik landning

Utloggade användare möts av produktens publika start utan att gruppdata laddas.
Här går det att skapa konto, öppna en privat inbjudan eller prova
exempelgruppen.

### Exempelgrupp (`/exempel`)

En interaktiv, helt fiktiv grupp som återanvänder produktens vanliga gränssnitt.
Ändringar sparas endast i den aktuella flikens `sessionStorage` och gör inga
live-skrivningar. Externa OSM-skrivningar görs inte.

### Intern testsandbox (`?demo=1`)

En separat skrivbar sandbox för utveckling och regressionstester. Den använder
lokal testdata och är inte en publik onboardingväg. Platsunderhåll har en
separat deterministisk fixture med rapporter och förbättringskandidater utan
provider-, databas- eller OSM-skrivningar.

### Live-läge

Aktiveras efter inloggning. Läsning och skrivning går mot Supabase genom
gruppscopade read-models, serverfunktioner och validerade RPC-anrop. Globalt
Platsunderhåll kräver dessutom en separat databasstyrd `place_maintainer`-roll.

## Arkitektur och integritet

Gruppen är den primära produkt- och integritetsgränsen.

- `places` representerar kanoniska verkliga matställen och kan innehålla en
  normaliserad kanonisk webbplats.
- `place_sources` kopplar externa Geoapify- och OpenStreetMap-identiteter till
  ett matställe och bevarar observationstid samt aktiv eller ersatt koppling.
  En bekräftad källkoppling är kanonisk och kan därför hjälpa andra grupper som
  redan länkar samma verkliga ställe, men får aldrig innehålla ursprungsgrupp,
  medlemskap eller privata gruppfält.
- Öppettidsdetaljer hämtas genom en autentiserad serverfunktion. Databasen
  verifierar aktivt medlemskap, gruppens platskoppling och en aktiv
  Geoapify-källa. Klienten får bara ett normaliserat veckoschema, säker
  webbplats, hämtningstid och källangivelse; rå providerpayload och interna
  kopplingar stannar på servern.
- `place_external_info_snapshots` innehåller den senaste normaliserade externa
  ögonblicksbilden för ett kanoniskt matställe. Tabellen saknar direkt
  klientåtkomst och kan hjälpa flera grupper att undvika onödiga provideranrop
  utan att dela gruppprivata uppgifter. Endast serverrollen får skriva en
  snapshot efter att användarens gruppåtkomst och aktiva Geoapify-källa har
  verifierats.
- `group_places` innehåller gruppens relation, metadata, webbplats- och
  öppettidsöverstyrning samt privat källa, ändrare och ändringstid. En
  källuppdatering skriver aldrig tyst över dessa gruppspecifika uppgifter.
  Fältvisa, tidsbegränsade markörer avgör om en uttryckligen källstödd ändring
  får bli ett anonymt förslag till andra grupper.
- Förslags-RPC:n för praktisk information lämnar endast neutral status,
  fältvärde, anonymt innehållsfingeravtryck och tidpunkt. Ursprunglig grupp,
  medlem, privat källänk, observation, antal och interna ID:n lämnar aldrig
  servern. Ett förslag måste godkännas uttryckligen och valideras på nytt innan
  det sparas i den mottagande gruppen.
- `group_place_practical_info_history` bevarar gruppens revisionshistorik och
  nås endast genom medlemskapskontrollerade RPC:er.
- `group_search_areas` innehåller gruppens verifierade sökcentrum.
- `group_hidden_place_suggestions` innehåller gruppens spärrlista för externa
  sökträffar och en begränsad säker ögonblicksbild av kategori, kartposition och
  normaliserad webbplats. Döljningen raderar inte det kanoniska matstället och
  påverkar aldrig andra grupper.
- `place_data_reports` innehåller gruppprivata rapporter, en begränsad
  ögonblicksbild av platsinformationen och eventuell befintlig OSM-note-status.
  En rapport kan rikta sig mot ett kanoniskt ställe eller en exakt
  provideridentitet utan att en tom platsrad skapas. Tabellen har ingen direkt
  klientåtkomst. Aktiva medlemmar rapporterar genom validerade RPC:er och endast
  strukturerad felkategori samt säker neutral platsinformation får projiceras
  till globalt Platsunderhåll; grupp, rapportör och privat fritext stannar kvar i
  den gruppbundna källan.
- `place_improvement_candidates` innehåller neutrala interna kandidater, bland
  annat verifierade manuella ställen som behöver extern källkontroll. Tabellen
  är separat från `place_data_reports`, men båda projiceras till samma globala
  underhålls-UX.
- `place_maintainers` är den privata globala behörighetsgränsen för
  Platsunderhåll och är frikopplad från gruppens owner/admin-roller.
- `place_maintenance_events` auditerar globala maintainerhandlingar för både
  rapporter och förbättringskandidater utan att kopiera historisk privat
  rapporttext.
- `place_data_signal_confirmations` innehåller privata, fritextfria
  bekräftelser. Den klientexponerade RPC:n lämnar bara en härledd neutral status
  och kvalitetsflaggor; grupp, medlem, rapporttext, antal och interna ID:n
  lämnar aldrig servern.
- Den äldre serverseparerade OSM Note-infrastrukturen och redan skapade
  offentliga referenser bevaras för historik och kompatibilitet. #163 aktiverar
  ingen automatisk OSM-publicering; OSM-åtgärder i Platsunderhåll är manuella.
- `visits` representerar kanoniska verkliga besök.
- `visit_group_links` kopplar original- och mottagargrupper till samma besök.
- `visit_participants` innehåller den aktuella faktiska identifierade närvaron
  och är den enda källan till medlemsprogression. Den som registrerar ett nytt
  besök måste själv ingå som faktisk deltagare; registreringshandlingen ger
  ingen extra kredit utöver den vanliga deltagarprogressionen.
- `visit_participation_self_corrections` är ett server-only spår för andra
  deltagares **Jag var inte med** / **Jag var med**. Registreraren kan inte
  korrigera bort sitt eget deltagande på ett besök hen själv skapat och
  klientroller har ingen direkt tabellåtkomst.
- `reviews` innehåller högst ett kanoniskt eget omdöme per besök och användare.
  `review_group_visibility` styr därefter betygs- och kommentarssynlighet per
  grupp; en review dupliceras inte för att samma besök visas i flera grupper.
- `visit_guests` innehåller privata, besökslokala visningsnamn. Gäster blir inte
  medlemmar eller profiler, får ingen progression och visas bara med namn i
  ursprungsgruppen. Mottagande grupper ser endast ett anonymt antal.
- `visit_media` kopplar ett privat foto till besökets ursprungsgrupp.
- `next_stop_date_proposals` och `next_stop_date_responses` innehåller gruppens
  privata planering.

Den primära live-läsningen går genom `get_group_app_state_v5j` med strikt
fallback till `get_group_app_state_v5i` endast när den nya funktionen uttryckligen
saknas. Rå providerdata stannar på serversidan. Känsliga skrivningar använder
validerade `SECURITY DEFINER`-RPC:er med låst `search_path`, autentisering och
relevanta medlemskaps- eller globala rollkontroller.

Ursprungsgruppens identitet, privata kommentarer, gästnamn och medlemskap lämnar
aldrig servern vid delning, källkoppling eller den globala
Platsunderhåll-projektionen. Historisk privat rapporttext görs inte global. Endast
faktiska deltagare får progression; registreraren får ingen extra kredit och
återbesök räknas.

Den kanoniska arkitekturkällan finns i
[docs/architecture.md](./docs/architecture.md).

## Teknik

- TanStack Start, React 19 och Vite 8
- TypeScript och Tailwind CSS v4
- shadcn/ui och Radix UI
- Bun som låst pakethanterare och runtime
- Lovable Cloud och Supabase för autentisering, datalager och privat fillagring
- Geoapify, OpenStreetMap och MapLibre för plats- och kartfunktioner
- Playwright för mobila och tvärbrowserbaserade regressionstester

## Kom igång

Den rekommenderade, reproducerbara starten är:

```bash
bash scripts/bootstrap-agent.sh
bun run dev
```

För en miljö som även ska köra mobila Playwright-tester:

```bash
bash scripts/bootstrap-agent.sh --with-chromium
```

Mer information om runtime, Codex Cloud och miljöunderhåll finns i
[DEVELOPMENT.md](./DEVELOPMENT.md).

## Verifiering

```bash
bun run doctor
bun run verify:changed
bun run verify:agent
bun run verify:full
```

- `verify:changed` kontrollerar ändrade filer, enhetstester, TypeScript och
  produktionsbygge.
- `verify:agent` lägger till relevant Chromium-verifiering för ändrade UI-flöden.
- `verify:full` är den fulla repoövergripande kontrollen för releasekandidater.
- Redo-CI kör dessutom WebKit- och desktopmatrisen när kartkod ändras.

Det kanoniska arbetsflödet för planering, implementation, verifiering, merge och
publicering finns i
[docs/development-workflow.md](./docs/development-workflow.md).

## Repositoryöversikt

```text
src/routes/                    Filbaserade vyer
src/components/matrundan/      Produktkomponenter och dialoger
src/components/ui/             Delade shadcn/Radix-primitiver
src/lib/matrundan/             Domänlogik, read-models och integrationer
supabase/migrations/           Schema, RPC, RLS och Storage
scripts/                       Reproducerbar setup och repoverifiering
tests/e2e/                     Playwright-regressioner
docs/                          Kanonisk arkitektur och utvecklingsflöde
```

Agentinstruktioner finns i [AGENTS.md](./AGENTS.md). Äldre arkitektur- och
changeloghistorik ligger uttryckligen under [docs/archive](./docs/archive/).

## Konfiguration och hemligheter

Publicerbara Supabase-värden kan finnas i `.env`. Service-role-nycklar och andra
privilegierade hemligheter får aldrig exponeras i klientkod eller `VITE_`-
variabler.

`GEOAPIFY_API_KEY` lagras i Lovable Cloud Secrets och används endast av
serverkod för sökning och platsdetaljer. Den äldre OSM Notes-integrationen kräver
ingen ny applikationshemlighet och används inte automatiskt av Platsunderhåll.
En framtida autentiserad OSM-koppling för Matrundans eget konto kräver ett
separat feature- och secret/auth-beslut. Inga produktionshemligheter ska
committas till repot.

## Lovable och publicering

Projektet är kopplat till GitHub. Mergade commits på `main` synkas till Lovable,
men merge, preview-synk, databasdriftsättning och publicering är separata statusar.
Publicering till den publika appen kräver alltid ett uttryckligt godkännande.
