# Matrundan – arkitektur och säkerhetsbeslut

Det här dokumentet är Matrundans kanoniska källa för varaktiga arkitektur-,
data- och säkerhetsbeslut. Det beskriver avsiktliga gränser och invariants, inte
ett fullständigt schemadump.

Äldre plan- och arkitekturtexter som inte längre är normerande ligger under
`docs/archive/`. Vid konflikt gäller i första hand:

1. aktuellt databasschema och aktuell kod;
2. detta dokument;
3. `README.md` och `DEVELOPMENT.md`;
4. arkiverad dokumentation.

## Produktgräns

Matrundan är en privat, gruppcentrerad app för vänner och familjer som vill
upptäcka, välja, besöka och minnas matställen tillsammans.

Kärnan är gruppens gemensamma matresa:

1. samla ställen gruppen är nyfiken på;
2. bestäm nästa gemensamma stopp;
3. registrera verkliga besök och faktiska deltagare;
4. bygg en privat historik med omdömen, favoriter, foton, återbesök och
   milstolpar;
5. använd historiken som inspiration till nästa gemensamma upplevelse.

Matrundan ska inte bli en offentlig restaurangkatalog, publik recensionsplattform,
individuell matdagbok, social feed, global ranking eller generisk karttjänst.
Sökning, kartor, statistik, rekommendationer och gamification är stöd för den
gemensamma matresan, inte egna produktcentrum.

## Permanenta invariants

- Gruppen är den primära produkt- och integritetsgränsen.
- Gruppdata ska vara privat och isolerad mellan grupper.
- Verkliga matställen och besök ska vara kanoniska och länkas, inte dupliceras.
- Delning får aldrig exponera ursprungsgrupp, privata kommentarer, medlemskap
  eller interna identifierare.
- Endast faktiska deltagare får progression; registreraren får ingen extra
  kredit.
- Återbesök räknas.
- Gamification ska vara varm, diskret, privat och sekundär.
- Sparade sökområden är förvalda sökcentrum, aldrig geografiska begränsningar.
  Alla sparade områden är valda när sökningen öppnas; inget område är primärt.
- Produktcopy ska vara naturlig svenska.
- Exempelgrupp, intern demo och autentiserat live-läge ska fungera parallellt.
- Ändrade huvudflöden ska fungera utan horisontell overflow vid 360 px.
- Skydda enkelheten och undvik funktioner som inte stärker gruppens gemensamma
  matresa.

## Körlägen och tillitsgränser

### Publik landning

Utloggade användare ska kunna läsa publik produktinformation, öppna inbjudningar,
logga in och prova exempelgruppen utan att privat gruppdata laddas.

### Exempelgrupp

`/exempel` använder fiktiv data och samma produktkomponenter som live-läget.
Skrivningar sparas endast i den aktuella flikens `sessionStorage`.
Exempelgruppen får inte skriva till live-databasen eller göra externa OSM-anrop.

### Intern testsandbox

`?demo=1` är en separat, skrivbar utvecklings- och testsandbox. Den använder
lokal webbläsardata och får inte exponeras som publik onboarding. OSM-publicering
och statuskontroll simuleras lokalt.

### Live-läge

Live-läget kräver autentisering. Data läses genom gruppscopade read-models och
skrivs genom validerade RPC:er eller serverfunktioner. Direkt klientåtkomst till
privata basobjekt undviks när en säkrare read-model eller RPC-gräns finns.

## Kanonisk datamodell

### Matställen

`places` representerar verkliga matställen. Ett verkligt ställe ska normalt ha
en kanonisk rad även om flera grupper använder det.

Gruppspecifika uppgifter ligger i `group_places`, exempelvis:

- aktiv eller arkiverad relation till gruppen;
- gruppens kategori- eller köksöverstyrning;
- Passar för;
- privat gruppanteckning;
- eventuell webbplatsöverstyrning.

En gruppspecifik uppgift får inte tyst skrivas in som global sanning.

### Externa källor

`place_sources` kopplar externa provideridentiteter till ett kanoniskt
matställe. Geoapify- och OpenStreetMap-identiteter lagras separat.

Varje källrad har en livscykel:

- `active` – identiteten beskriver nuvarande plats;
- `superseded` – identiteten är historisk eller ersatt.

En provideridentitet är unik bland aktiva källor. Historiska källor kan bevaras
utan att blockera en senare verklig verksamhet på samma fysiska plats.

Rå providerdata får lagras serverinternt i `place_sources.raw`, men lämnas inte
till klientens read-model. Klienten får endast begränsad identitet:

- provider;
- provider-ID;
- aktiv eller ersatt status.

Verifierad webbplats kan lagras på `places.website`. En grupp kan ha en separat
`group_places.website_override`. URL:er måste normaliseras till säker HTTP eller
HTTPS innan de visas eller sparas i en klientexponerad ögonblicksbild.

### Providerträffar och privata rapporter

En sökträff är inte automatiskt ett kanoniskt matställe. En felaktig eller
inaktuell providerträff ska kunna rapporteras utan att appen först skapar en tom
rad i `places`.

`place_data_reports` kan därför rikta sig mot exakt ett av följande mål:

1. ett kanoniskt `place_id`; eller
2. en exakt `provider + provider_place_id`.

Målen är ömsesidigt uteslutande och skyddas av databaskontrakt. En
providerträffsrapport bevarar bara en begränsad ögonblicksbild av namn, adress,
ort, säker webbplats, kartposition och källidentitet. Rå providerpayload sparas
inte i rapporten.

Rapportering och döljning är två separata handlingar:

- rapportering skapar ett privat granskningsunderlag för gruppens ägare och
  administratörer;
- döljning är en reversibel gruppinställning som endast påverkar den aktuella
  gruppens söklista och karta.

En ägare eller admin kan välja båda i samma användarflöde, men en lyckad rapport
får inte rullas tillbaka om den efterföljande döljningen misslyckas. En medlem
kan rapportera utan att få administrativ rätt att dölja.

### Dolda providerträffar

`group_hidden_place_suggestions` identifierar en dold träff med:

- grupp;
- provider;
- provider-ID.

Döljningen raderar inget kanoniskt matställe och påverkar aldrig andra grupper.
För att en dold träff ska kunna granskas även om providern senare slutar
returnera den bevaras en begränsad säker ögonblicksbild:

- namn och kategori;
- adress, område och ort;
- giltig kartposition när den finns;
- normaliserad HTTP-/HTTPS-webbplats när den finns;
- när och av vem träffen doldes.

Äldre dolda rader utan de nya fälten förblir giltiga och kan återställas. Rå
providerdata får inte lagras i den gruppprivata spärrlistan.

### Anonyma platsdatasignaler

Privata rapporter får hjälpa andra grupper endast genom en härledd och neutral
slutsats. De får aldrig bli en global rapportfeed eller en väg runt gruppens
integritetsgräns.

`place_data_signal_confirmations` lagrar en medlems enkla bekräftelse för exakt
ett kanoniskt ställe eller en provideridentitet. Tabellen är privat och saknar
direkt klientåtkomst. Bekräftelsen innehåller ingen fritext och är separat från:

- gruppens privata rapportkö;
- gruppens reversibla döljning;
- eventuell OSM-publicering.

Läs-RPC:n för en grupp får bara använda evidens från **andra grupper**. Den
aktuella gruppens privata rapporter eller bekräftelser får inte ens återkomma som
en anonym signal till vanliga medlemmar i samma grupp.

Klienten får endast följande härledda fält per mål:

- `closureStatus`: `none`, `unverified`, `reviewed` eller `uncertain`;
- `limitedInformation`: båda webbplats och öppettider saknas uttryckligen;
- `recentlyConfirmedOpen`: det finns aktuell anonym motbevisning.

Följande får aldrig lämnas av signal-RPC:n:

- ursprungsgrupp;
- medlem eller rapportör;
- rapporttext eller intern anteckning;
- antal rapporter, grupper eller bekräftelser;
- rapport-, grupp- eller användar-ID.

Evidensmodellen är konservativ:

- en ensam ogranskad rapport ger endast `unverified`;
- en adminbedömd rapport eller stöd från minst två oberoende grupper kan ge
  `reviewed`;
- en positiv signal tillsammans med motbevisning ger `uncertain`;
- nyliga verkliga besök räknas som anonym motbevisning;
- ogranskade rapporter, bekräftelser och granskade underlag har separata
  tidsfönster och tappar automatiskt tyngd.

**Begränsad platsinformation** är en kvalitetsflagga, inte en stängningssignal.
Den får bara visas när leverantörens aktuella data uttryckligen saknar både
webbplats och öppettider. Okänd eller äldre data får inte tolkas som frånvaro.
Geoapifys fulla öppettidsschema lämnas inte till klienten; endast en neutral
boolesk indikator normaliseras.

### Besök

`visits` representerar verkliga besök. Ett besök ska vara kanoniskt även när det
visas i flera av användarens grupper.

`visit_group_links` kopplar ett besök till original- och mottagargrupper.
Originalgruppen är privat serverinformation och får inte lämnas till mottagande
grupp.

`visit_participants` innehåller faktiska deltagare. Progression och privata
medlemsmeriter ska baseras på dessa rader, inte på vem som registrerade besöket.

`review_group_visibility` styr vilka betyg och kommentarer som får visas i varje
grupp. En kommentar från en annan grupp delas bara efter ett uttryckligt val av
kommentarens ägare.

`visit_media` tillhör besöket men är knutet till ursprungsgruppen. Delade grupper
får inte automatiskt tillgång till fotot.

### Nästa stopp och datumplanering

Nästa stopp tillhör gruppen och ska alltid referera till ett aktivt
`group_place`.

Datumförslag och svar är gruppprivata:

- `next_stop_date_proposals` innehåller datum, valfri tid och skapare;
- `next_stop_date_responses` innehåller en medlems svar på ett visst förslag.

Matrundan räknar svar men fattar inte automatiska majoritetsbeslut. En ägare
eller admin bekräftar planen uttryckligen.

### Sökområden

`group_search_areas` innehåller verifierade Geoapify-sökcentrum. De begränsar
inte var gruppen får söka och har ingen primärordning.

Sökningen öppnas med samtliga sparade områden aktiva. Användaren kan tillfälligt
slå av områden eller lägga till en annan verifierad plats utan att ändra
gruppinställningarna.

Breda administrativa områden som kommuner, län, regioner och länder ska inte
sparas som oprecisa punktcentrum. Äldre värden kan visas med vägledning för
ersättning.

## Read-model och klientexponering

Den primära live-läsningen går genom `get_group_app_state_v5f`.
`get_group_app_state_v5e` är en strikt kompatibilitetsfallback och används endast
när den aktuella RPC:n uttryckligen saknas i PostgRESTs schema-cache.

Read-modelen ska:

- verifiera autentisering och aktivt medlemskap;
- filtrera på aktuell grupp;
- lämna ut effektiv gruppmetadata, inte privata fält från andra grupper;
- aldrig lämna ut rå providerpayload;
- aldrig lämna ut ursprungsgrupp för delade besök;
- aldrig lämna ut en kommentar som inte är synlig i gruppen;
- aldrig lämna ut privata media från annan grupp.

Fallback får inte användas för andra fel än uttryckligen saknad ny RPC. Ett
behörighetsfel, nätverksfel eller valideringsfel får inte döljas genom fallback.

## Skrivgränser

Säkerhetskänsliga skrivningar använder normalt `SECURITY DEFINER`-RPC:er med:

- låst `search_path`;
- explicit autentisering genom `auth.uid()`;
- aktiv gruppkontroll;
- medlemskaps- eller rollkontroll;
- servervaliderad input;
- explicita grants och revokes.

Direkt klientskrivning till kanoniska eller integritetskänsliga tabeller ska
undvikas.

### Rollprinciper

Aktiva medlemmar får:

- lägga till ställen;
- komplettera gruppens kategori, kök, Passar för och privata anteckning;
- registrera och redigera egna besök inom produktens regler;
- rapportera felaktig platsinformation för ett kanoniskt ställe eller en exakt
  providerträff;
- bekräfta eller motsäga en anonym stängningssignal utan fritext;
- föreslå datum och svara på förslag.

Ägare och administratörer får dessutom:

- ändra gruppinställningar;
- arkivera och återaktivera gruppen;
- ta bort och återställa ställen i gruppens aktiva lista;
- dölja och återställa providerträffar för gruppen;
- granska gruppens samlade platsdatarapporter;
- förbereda och bekräfta OSM-publicering;
- bekräfta planerat datum.

En klientroll får inte:

- läsa privata bastabeller direkt när en RPC-gräns finns;
- registrera ett bekräftat externt OSM-note-ID;
- ändra extern OSM-status;
- läsa OSM-försöksloggen;
- anropa interna triggerfunktioner direkt.

## Platsdatarapporter och OSM-handoff

### Privat rapportering

Alla aktiva gruppmedlemmar får rapportera felaktig platsinformation. Rapporten
är privat inom gruppen och kan skapas från:

- ett redan tillagt kanoniskt matställe; eller
- en exakt providerträff före tillägg.

En rapport innehåller:

- grupp och målidentitet;
- generell felkategori;
- användarens privata beskrivning;
- begränsad ögonblicksbild av platsinformationen;
- rapportör och tidsstämplar;
- granskningsstatus och intern adminanteckning.

Samma medlem får inte skapa flera samtidiga rapporter med samma kategori för
samma mål.

Statusar:

- `open` – väntar på granskning;
- `ready_for_osm` – admin har förberett underlaget;
- `resolved` – åtgärdad i Matrundan;
- `dismissed` – avslutad utan åtgärd.

`ready_for_osm` är ett privat internt tillstånd. Det publicerar ingenting utan en
separat bekräftelse.

### Offentlig OSM-publicering

Endast ägare/admin får starta publicering. Innan publicering måste admin:

- granska rapporten;
- se och redigera exakt offentlig text;
- kontrollera kartposition;
- bekräfta att texten blir offentlig.

Endast följande får lämna Matrundan:

- den granskade offentliga texten;
- kartpositionen;
- en neutral slumpmässig Matrundan-referens.

Följande får aldrig skickas automatiskt:

- gruppnamn;
- rapportör eller reviewer;
- privat rapporttext om den inte uttryckligen har skrivits om till offentlig
  text;
- intern adminanteckning;
- medlemskap;
- interna databas-ID:n.

En providerträffsrapport kan förberedas för OSM först när den har tillräckligt
underlag och giltig kartposition. Publicering skapar inte automatiskt ett
kanoniskt matställe i Matrundan.

Publiceringen går genom en serverstyrd adapter med identifierbar User-Agent och
referer. Klienten reserverar försöket genom gruppscopad RPC, serverrollen gör
OSM-anropet och endast serverrollen får registrera note-ID och extern status.

### Återhämtning och dubblettskydd

En neutral offentlig referens genereras per rapport. Vid osäkert nätverksavbrott
söker servern efter samma referens och position innan ett nytt POST-försök görs.

En rapport får bara kopplas till en OSM-note. Publiceringsförsök loggas append-only
för att misslyckade försök fortfarande ska räknas mot dygnskvoten. Kvoter
serialiseras per användare och grupp för att parallella transaktioner inte ska
kunna passera samma gräns.

### Källstatus och gamla underlag

Ett `missing_in_osm`-underlag får inte publiceras om platsen redan har en aktiv
OpenStreetMap-källa.

När en aktiv OSM-källa länkas:

- opublicerade, väntande `missing_in_osm`-rapporter avslutas atomiskt;
- en nyligen startad OSM-publicering blockerar källkopplingen tills försöket är
  klart eller gammalt;
- publicerade OSM-noter bevaras som historik.

## Manuell plats och senare källkoppling

Ett manuellt ställe kan skapas utan extern provideridentitet, men i live-läge
ska kartpositionen komma från ett uttryckligt verifierat Geoapify-val när
platsen ska användas för OSM-underlag eller senare källmatchning.

När en senare providerträff verkar motsvara ett manuellt ställe får ägare/admin
länka källan endast om:

- målplatsen är aktiv i gruppen;
- målplatsen saknar aktiv extern källa;
- exakt en konservativ match finns;
- extern identitet inte redan används av annan aktiv plats;
- namn, adress och kartposition uppfyller det servervaliderade kontraktet.

Tvetydighet innebär alltid ingen åtgärd. Fuzzy auto-merge ingår inte.

Källkopplingen bevarar:

- samma `places.id`;
- samma `group_places`;
- besök och omdömen;
- gruppens privata metadata;
- historiska källor.

Källkopplingen får aldrig skriva över gruppens privata fält med providerdata eller
exponera vilken grupp som initierade kopplingen.

## Delning mellan grupper

Delning använder kanoniska platser och besök i stället för kopior.

Servern ansvarar för att:

- kontrollera att användaren har åtkomst till både ursprungs- och mottagargrupp;
- länka platsen till mottagargruppen vid behov;
- länka samma besök genom `visit_group_links`;
- aldrig lämna ut ursprungsgruppen till mottagaren;
- aldrig dela privat kommentar utan uttryckligt medgivande;
- aldrig dela privat foto till mottagargruppen;
- behålla faktiska deltagare som progressionens källa.

En gruppspecifik borttagning av ett ställe raderar inte det kanoniska stället,
andras grupprelationer eller historiska besök.

## Kontoradering

Självbetjänad kontoradering orkestreras serverstyrt. Personliga uppgifter tas bort
eller anonymiseras medan gemensam grupphistorik kan bevaras som
**Tidigare medlem** när det behövs för dataintegritet.

Platsdatarapporter behandlas särskilt:

- rapportörens identitet tas bort;
- användarens privata rapporttext tas bort;
- intern anteckning skriven av den raderade användaren tas bort;
- OSM-publicerarens personkoppling tas bort;
- append-only-försöksloggen anonymiseras genom `submitted_by = NULL`;
- användarens aktiva platsdatasignalbekräftelser raderas;
- neutral platsöversikt och operativ status kan bevaras.

Kontoradering får inte lämna gamla personnamn i rapportöversikter, aktiva
platsdatasignaler eller externa OSM-referenser.

## Notiser

Push-prenumerationer lagras per autentiserad användare. Servern får endast skicka
notiser som mottagaren har gruppåtkomst till.

Notiser får inte innehålla privat data från en grupp mottagaren saknar medlemskap
i. En arkiverad grupp ska inte generera nya operativa notiser.

## Media

Besöksfoton lagras privat. Åtkomst ska kontrolleras genom serverstyrda URL:er och
grupp-/ägarskapspolicyer.

Ett foto tillhör besökets ursprungsgrupp och delas inte automatiskt när besöket
länkas till en annan grupp.

## Geoapify och OpenStreetMap

Geoapify används serverstyrt. API-nyckeln lagras i Lovable Cloud Secrets och får
inte exponeras i klienten eller committas.

Geoapify-resultat normaliseras till Matrundans domänmodell. Normaliseringen ska:

- filtrera explicit nedlagda, rivna eller övergivna objekt;
- separera Geoapify-ID från eventuell OSM-identitet;
- normalisera webbplats till säker URL;
- härleda endast en boolesk indikator för om öppettider finns, inte exponera hela
  schemat till klienten;
- begränsa rå metadata;
- deduplicera sökresultat konservativt.

OpenStreetMap Notes används för konkreta kartdatafel efter mänsklig granskning.
Notes får inte användas som automatisk fel-dump, privat kommentarssystem eller
masspubliceringskanal.

Anonyma noter kan skapas utan OSM-konto. Kommentarer och stängning kräver
inloggat OSM-konto och ingår därför inte i den anonyma grundintegrationen.

## Demo- och exempelisolering

Demo- och exempeldata måste vara fiktiv och får inte skapa externa effekter.

I lokala lägen ska följande simuleras eller sparas lokalt:

- platsdatarapporter;
- rapporter om providerträffar;
- dolda sökträffar och deras säkra ögonblicksbilder;
- kvalitetsflaggan för begränsad platsinformation;
- OSM-publicering;
- OSM-statuskontroll;
- källkoppling;
- privata gruppändringar.

Lokala lägen får aldrig använda service-role, skriva produktion eller publicera
en verklig OSM-note. Cross-group-bekräftelser är live-only och får inte skriva
från demo eller exempelgrupp.

## Databasmigrationer

Migrationer är additiva som standard och ska bevara befintliga produktionsrader.
Destruktiva ändringar eller rensningar kräver uttryckligt godkännande.

En migration ska:

- vara versionsordnad och ligga under `supabase/migrations/`;
- använda stabila, bakåtkompatibla övergångar när möjligt;
- ha låst `search_path` för `SECURITY DEFINER`;
- sätta explicita grants och revokes;
- uppdatera produktions-preflight när ett nytt obligatoriskt objekt tillkommer;
- inte registreras som applicerad innan objekten har verifierats.

PostgRESTs schema-cache laddas om efter migrationsdriftsättning.

## Produktions-preflight

`supabase/production-preflight.sql` är den kanoniska skrivskyddade kontrollen
efter migration och före publicering.

Alla rader måste returnera `ok = true`. Kontrollen omfattar minst:

- aktuella och kompatibla read-models;
- obligatoriska tabeller, kolumner, constraints, index och triggers;
- grupp- och rapport-RPC:er;
- providerträffsrapporter och dolda träffars säkra ögonblicksbild;
- anonyma platsdatasignaler, negativa behörigheter och cross-group-isolering;
- OSM-publiceringsfunktioner;
- grants och negativa behörighetskontroller;
- kontoraderingens rapport-, signal- och OSM-städning;
- frånvaro av direkt klientåtkomst till privata tabeller.

Efter preflight görs en autentiserad läsning av en verklig aktiv grupp. Riktade
negativa tester ska ske i rollback-transaktion eller mot obefintliga ID:n så
ingen produktionsdata skapas.

## Release, merge och publicering

Version, in-app-historik och `CHANGELOG.md` ska vara konsekventa.

Merge till `main` kräver:

- godkänt scope;
- granskad diff;
- relevanta gröna tester;
- grön CI;
- inga kända blockerare.

Efter merge redovisas separat:

- branch och commit;
- PR och merge;
- CI;
- Lovable-synk;
- preview och manuella teststeg;
- databas och migration;
- ej verifierat;
- publicering.

Merge är inte publicering. Databasdriftsättning och publik deployment kräver
separata uttryckliga godkännanden.
