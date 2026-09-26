# Matrundan – arkitektur och säkerhetsbeslut

Det här dokumentet är Matrundans kanoniska källa för varaktiga arkitektur-,
data- och säkerhetsbeslut. Det beskriver avsiktliga gränser och invariants, inte
ett fullständigt schemadump.

För praktiskt utvecklingsarbete kompletteras det av:

- `AGENTS.md` för bindande repo- och arbetsregler;
- `docs/development-workflow.md` för planering, implementation, verifiering och
  leverans;
- `docs/product-roadmap.md` för strategisk produktriktning och backlogmodell;
- `supabase/production-preflight.sql` för den konkreta driftkontrollen efter
  migration.

## Grundprinciper

Matrundan är en privat, gruppcentrerad app. Arkitekturen ska därför i första
hand skydda gruppens gemensamma data, verkliga platsidentitet och historik.

Följande invariants är permanenta:

- gruppen är den primära produkt- och integritetsgränsen;
- verkliga matställen är kanoniska objekt och ska återanvändas, inte dupliceras
  när identiteten kan verifieras säkert;
- gruppspecifik metadata hör till gruppens relation till platsen, inte till den
  globala platsidentiteten;
- besök är verkliga grupphändelser och progression följer faktiska deltagare;
- privata gruppuppgifter får aldrig bli offentlig eller cross-group data genom
  en bekväm klientgenväg;
- servern, inte klienten, avgör medlemskap, behörighet och känsliga
  identitetsövergångar;
- exempel/demo får simulera samma huvudflöden men får inte bli en genväg runt
  live-lägets säkerhetsmodell.

## Runtime och driftsmiljö

Matrundan kör TanStack Start/Vite/React på Cloudflare Workers. Liveproduktionens
data och auth ligger i Supabase **Matrundan Production**; staging och
branchpreview använder Supabase **Matrundan Staging** enligt repots miljökontrakt.
Känsliga skrivningar går genom validerade server-/RPC-gränser.

Produktionskedjan är:

1. kod och migrationer landar i GitHub;
2. relevanta CI-kontroller ska vara gröna;
3. migrationer driftsätts separat när de är godkända;
4. `supabase/production-preflight.sql` körs skrivskyddat efter migration;
5. PostgREST schema-cache laddas om när RPC-yta eller schema ändrats;
6. en autentiserad smoke test mot verklig gruppdata görs;
7. Cloudflare-production publiceras genom ett separat uttryckligt
   publiceringssteg.

Lovable-preview är ett valfritt parallellt UX-/editorsteg mot staging när det
uttryckligen efterfrågas. Det är inte Matrundans productionruntime och en preview
är aldrig samma sak som publicering.

En merge är alltså inte samma sak som databasdriftsättning eller publicering.

## Portabilitet och klientoberoende

Web/PWA är Matrundans nuvarande primärklient. Productionruntime är Cloudflare
Workers med Supabase Production som dagens backend; Lovable är endast ett
valfritt UX-/editor- och previewverktyg mot staging. Ingen av dessa plattformar är
Matrundans domän- eller säkerhetsgräns.

Följande är varaktiga arkitekturprinciper:

- hosting/runtime, auth delivery, storage/media, notisleverans, schemalagda jobb,
  kart-rendering, externa providers och observability behandlas som utbytbara
  plattformsadapters runt Matrundans domän och säkerhetsmodell;
- leverantörsspecifik kod ska hållas vid tydliga gränser och får inte bli enda
  platsen där grupp-, medlemskaps-, plats-, besöks-, delnings- eller
  progressionsregler uttrycks;
- generell domänlogik ska inte göras beroende av DOM, `window`, TanStack Router
  eller andra webbspecifika API:er när beteendet inte i sig är webbspecifikt;
- backendkontrakt, authmodell, kanoniska HTTPS-länkar, mediaåtkomst och
  notisavsikt ska kunna återanvändas av en framtida native-klient utan att
  Matrundans kärnmodell omdefinieras;
- kanoniska koordinater och externa platsidentiteter är produktdata och får inte
  göras beroende av dagens kart-renderare;
- stateful produktdata ska ha en dokumenterad export- och recoveryväg utanför
  den aktiva leverantören när den inte redan kan återskapas deterministiskt från
  repo;
- portabilitet betyder inte spekulativ abstraktion: monorepo, egna wrappers och
  parallella implementationer införs först när en känslig eller kostsam gräns
  behöver isoleras eller en konkret andra implementation finns.

#207 – **Frikoppla drift från Lovable Cloud och etablera portabel plattform** är
tekniskt genomfört i sin kärna. Issue #207 hålls fortsatt öppen för den sista
verifierade avvecklingen av den tidigare Lovable-runtimeytan. Den aktuella
miljömodellen och de varaktiga portabilitetsgränserna dokumenteras i
`docs/platform-migration-plan.md`; operativ migrationshistorik och checkpoint-
evidens hör i Issue #207 och berörda PR:er.

## Trust boundaries

### Klienten

Klienten får:

- välja och presentera data som servern redan har godkänt;
- skicka användarens avsikt och valda indata;
- hålla temporär UI-state för sökning, preview och demo.

Klienten får inte vara enda säkerhetskontrollen för:

- gruppmedlemskap eller adminroll;
- cross-group-läsning;
- kanonisk platsidentitet;
- source-linking;
- deltagarprogression;
- privat delning;
- OSM-publiceringsstatus;
- databasens unika invariants.

### Databasen

Postgres/Supabase är den auktoritativa gränsen för:

- medlemskap och roller;
- gruppisolering;
- kanoniska `places`;
- grupprelationer i `group_places`;
- gruppens privata nästa-stopp-förslag, platsintresse, gemensamma dag och dagsvar;
- besök, deltagare, reviews och progression;
- externa källidentiteter;
- känsliga cross-group-förslag;
- privata förbättrings- och rapporteringsflöden.

`SECURITY DEFINER` används bara när en serverfunktion uttryckligen behöver läsa
eller skriva utanför vanlig RLS-synlighet. Sådana funktioner ska alltid ha låst
`search_path`, explicita behörighetskontroller och minimerad output.

## Gruppisolering

Gruppdata ska inte kunna läsas bara för att en användare känner till ett UUID.
Varje live-RPC som arbetar med gruppdata måste verifiera minst:

1. att användaren är autentiserad;
2. att gruppen är aktiv när skrivning kräver det;
3. att användaren har aktivt medlemskap;
4. admin/owner-roll när funktionen gör administrativ ändring.

Klienten får inte läsa skyddade bas-tabeller direkt när en minimerad RPC är den
avsedda kontraktsytan.

Det gäller särskilt tabeller eller vyer som kan innehålla:

- andra gruppers metadata;
- rå providerdata;
- privata rapporter;
- förbättringsunderlag;
- historiska administrativa händelser.

## Kontoradering och kontoägarskap

Kontoradering använder `prepare_own_account_deletion(jsonb, boolean)` som
serverstyrd förberedelse före själva auth-raderingen.

Funktionen ska scrubba eller koppla loss personidentifierande fält som annars
skulle blockera eller onödigt behålla användaridentitet i historiska systemdata.

Historiska grupphändelser får bevaras när produktens integritet och referenser
kräver det, men direkta användarreferenser ska nullas eller ersättas när det är
säkert och semantiskt korrekt.

Nya tabeller som innehåller `created_by`, `updated_by`, submitter-ID eller annan
användarreferens ska därför granskas mot kontoraderingsflödet innan de räknas som
färdiga. `visit_participation_self_corrections.user_id` refererar profilen med
`ON DELETE CASCADE`, så det privata korrigeringsspåret försvinner automatiskt
när profilen raderas och kräver ingen separat scrubbrad. `review_group_reactions`
är en medlems privata sociala markering, inte historisk betygsdata; den ska rensas
redan när profilen mjukraderas och har dessutom fysisk `ON DELETE CASCADE` som
säkerhetsnät. Nästa-stopp-v2 använder `ON DELETE SET NULL` för
`proposed_by`/`updated_by` och `ON DELETE CASCADE` för en medlems egen **Jag vill
hit**-markering, så kontoradering blockerar inte gruppens kvarvarande idé eller
lämnar en stödmarkering kopplad till det raderade kontot.

## Kanonisk datamodell

### Matställen

`places` representerar ett verkligt kanoniskt matställe.

`group_places` representerar att en viss grupp har lagt till eller arkiverat den
platsen och bär gruppspecifik metadata.

Det betyder:

- samma verkliga plats kan användas av flera grupper via samma `places.id`;
- en grupps anteckningar, Passar för, praktiska overrides eller status ska inte
  skrivas till det globala `places`-objektet bara för att de råkar vara
  tillgängliga i klienten;
- borttagning från en grupp är normalt arkivering av `group_places`, inte
  radering av den kanoniska platsen.

### Externa källor

`place_sources` kopplar en kanonisk plats till en extern identitet, i dag främst
Geoapify/OSM.

En aktiv provideridentitet ska vara unik och får inte tyst flyttas mellan två
kanoniska `places`-rader.

Rå providerpayload hålls server-side. Klienten får bara den normaliserade
information som krävs för produktflödet.

När en tidigare manuell plats senare får en säker provideridentitet ska källan
länkas till samma `places.id`; historiken ska inte flyttas till ett nytt objekt.

## Bilder och lagring

Besöksfoton ligger i privat Storage-bucket och ska inte kunna listas eller läsas
utan gruppkontext.

Produktionsvakten för `visit-photos` är:

- privat bucket;
- JPEG;
- max 1,5 MB;
- server-/policykontroller för rätt grupp och användare.

Klienten får komprimera och validera för UX, men Storage-reglerna är den
säkerhetsmässiga sanningen.

Ett kanoniskt besök kan bära flera privata mediaobjekt i sin **ursprungsgrupp**,
men högst **en aktiv bild per faktisk identifierad deltagare**. Den databasmässiga
unikheten är därför `(visit_id, group_id, uploaded_by)`. Varje mediaobjekt har
stabilt individuellt ägarskap genom `visit_media.uploaded_by`.

Nya uppladdningar och ersättningar kräver att användaren:

- är aktiv medlem i gruppen;
- är faktisk deltagare på det kanoniska besöket;
- arbetar i besökets ursprungsgrupp;
- bara skapar eller ersätter sin egen bildplats.

Owner/admin får moderera och radera en deltagares bild men får inte därigenom
ladda upp eller skriva över bilden som om den vore deras egen. **Den som bara
registrerade besöket får ingen separat rätt att punktmoderera andra deltagares
bilder.** Helbesöksradering är en annan operation: dess RPC samlar först
Storage-sökvägarna och raderar därefter det kanoniska besöket; klienten städar
sedan endast de nu orefererade Storage-objekten. Därmed kan registreraren fortsatt
radera ett besök när produktregeln tillåter det utan att få en fristående
"ta bort någon annans bild"-förmåga.

Skrivreglerna verkställs både i RPC/Storage-policy och i klientens presentation;
klientkontrollen är endast UX.

Upsert serialiseras per grupp, besök och uppladdare så samtidiga skrivningar till
samma deltagares bildplats inte blir last-write-wins mellan två rader. En
misslyckad uppladdning får kunna städa just sin egen orefererade Storage-fil utan
rätt att radera någon annans media.

Den aktuella grupp-read-modellen exponerar `photos[]` endast från den aktiva
gruppens auktoriserade besökskontext. Ett äldre kompatibilitetsfält `photo`
behålls som en enda stabil representativ bild, den äldsta kvarvarande bilden,
så historikminiatyrer och äldre klienter inte behöver tolka ett galleri.

Cross-group-synlighet är uttrycklig och individuell. Ett foto blir aldrig
synligt i en ny grupp bara för att det kanoniska besöket delas. Bildägaren kan
i stället skapa en `visit_media_group_visibility` för sin egen befintliga bild
och en målgrupp där samma kanoniska besök redan finns. Relationen kopierar
varken fil eller ägarskap och kaskadreras när mediaobjektet eller målgruppens
besökslänk tas bort.

Målgruppens read-model får endast ett opaque `deliveryToken` för cross-group-
media; ursprungsgrupp och rå `storagePath` lämnar aldrig den gränsen.
Appservern tar emot användarens bearer-session via samma origin och vidarebefordrar
den till den minimala Supabase Edge Functionen `visit-photo-delivery`. Funktionen
revaliderar sessionen, låter den service-only resolver-RPC:n kontrollera aktuell
målgruppsbehörighet och använder därefter serverrollen endast för att hämta det
privata Storage-objektet. Cloudflare-preview behöver därmed ingen service-role-
hemlighet för bildleveransen, och varken ursprungsgrupp eller rå Storage-sökväg
exponeras för klienten. Därmed kan målgruppens admin inte skriva över eller
radera originalet, samtidigt som byte av bild följer samma stabila mediaobjekt.

## Säkerhets- och persondatakarta

Matrundans säkerhetsmodell utgår från att **gruppen är den primära
integritetsgränsen** och att klienten aldrig är auktoritativ för användar-ID,
grupp-ID eller roll. Webbroutes och deep links får välja vilken grupp klienten
försöker läsa, men den server-/databasväg som levererar gruppstate måste alltid
kontrollera `auth.uid()`, aktivt medlemskap och vid administrativa skrivningar
rätt grupproll. Den negativa regressionen ligger i
`supabase/tests/security-boundaries.test.sql`.

Autentisering och profilflöde:

- appen initierar Google OAuth via Supabase Auth;
- Supabase Auth håller den externa provideridentiteten och rå provider-metadata,
  bland annat e-post, provider-ID, namn och avatar när Google levererar dem;
- `public.profiles` är den gruppsynliga projektionen och innehåller användar-ID,
  visningsnamn och avatar, inte provider-token eller providerhemligheter;
- provider-/user-metadata används för profilbootstrap, aldrig som grupproll eller
  behörighetskälla. Behörighet kommer från signerad Supabase-session,
  `auth.uid()`, `memberships`, RLS och avgränsade RPC:er.

Privata dataområden:

- medlemskap, gruppmetadata, besök, deltagande, omdömeskommentarer och
  reaktioner är gruppscopade;
- besöksbilder ligger i den privata Storage-bucketen `visit-photos`; rå
  `storage_path` får bara lämna ursprungsgruppen enligt mediakontraktet nedan;
- `push_subscriptions` innehåller privata push-endpoints och Web Push-nyckelmaterial,
  `notification_preferences` personliga inställningar och
  `notification_outbox` mottagar-ID samt notistext. De är inte grupphistorik;
- Geoapify används för plats-/kartsökning och ska inte få Supabase-identitet som
  del av behörighetsmodellen. Cloudflare Worker förmedlar serverfunktionerna men
  får inte göra klientens gruppval till ett behörighetsbeslut.

Kontoborttagning är därför en sammansatt operation: databasen scrubbar/anonymiserar
historisk identitet, rensar privat notisdata, returnerar privata bildsökvägar för
Storage-radering och serverfunktionen tar därefter bort Supabase Auth-användaren.
Nya tabeller eller kolumner som binder direkt till en användare ska fortsatt
granskas mot detta flöde. Push-endpoints, notispreferenser och köad notistext får
inte lämnas kvar efter profilens soft-delete.

## RLS och RPC-mönster

### Direkt RLS

Direkt tabellåtkomst används bara när raden i sig är en lämplig säkerhetsgräns
och policyn kan uttrycka hela regeln enkelt.

RLS-policies som behöver medlemskap, grupproll eller gemensam grupp använder
auth-bundna wrappers som `current_user_has_membership`,
`current_user_has_group_role` och `current_user_shares_group`. De binder
aktören till `auth.uid()`. De underliggande SECURITY DEFINER-hjälparna
`has_membership`, `has_group_role` och `shares_group` tar uttryckliga
användar-ID:n och är därför interna byggblock, inte direkt klient-API.
`authenticated` ska inte ha EXECUTE på de råa hjälparna.

### Minimerad RPC

Använd en minimerad RPC när:

- data måste läsas över flera skyddade tabeller;
- cross-group-information måste aggregeras eller neutraliseras;
- klienten bara ska få en delmängd av intern data;
- flera skrivningar måste ske atomärt;
- servern måste revalidera en kandidat precis före commit.

En cross-group-RPC får aldrig returnera mer data bara för att den internt hade
behörighet att läsa den.

## Gruppstate

`get_group_app_state_v5n(uuid)` är nuvarande primära read-RPC för gruppens
applikationsstate. `get_group_app_state_v5m(uuid)` är den närmast föregående
kompatibla läs-RPC:n och får användas som strikt fallback när v5m uttryckligen
saknas under en säker rullning. Andra auth-, nätverks- eller datafel får inte
döljas genom fallback.

v5m bygger additivt på v5l och kompletterar redan auktoriserade reviewobjekt med
`atmosphere` och `reviewModel` samt besöken med den aktiva gruppens privata
`photos[]`, utan att bredda gruppens läsrättigheter. v5l
kompletterar i sin tur redan auktoriserade besök med den kanoniska
`isTakeaway`-kontexten ovanpå v5k. v5k lägger till den privata `nextStop`-
projektionen ovanpå v5j. v5j bevarar deltagarsemantiken genom v5i-wrappern över
den serverinterna `get_group_app_state_v5i_participation_base(uuid)`.
Basfunktionen får inte vara direkt körbar av `anon` eller `authenticated`.
Wrappern filtrerar synliga reviews mot aktuella rader i `visit_participants` och
exponerar endast den inloggade användarens minimerade deltagarstatus
(`participant`, `declined` eller `none`).

Read-RPC:n ska:

- verifiera medlemskap;
- bara returnera data för vald grupp;
- bevara integritetsregler för delade besök och gäster;
- bara visa deltagaromdömen från personer som fortfarande är faktiska deltagare;
- undvika att exponera interna tabellfält som klienten inte behöver.

Sekundär, potentiellt växande besöksdata som omdömesreaktioner ska inte läggas in
i hela gruppens v5m-payload bara för att den visas i besöksdetaljen. Den läses i
stället lazy genom en grupp- och medlemsvaliderad, minifierad per-besök-RPC.

## Nästa stopp

Nästa stopp är privat gruppstate och ska inte härledas från en offentlig katalog
eller annan grupps planering. Produktmodellen är en **mjuk kö** för sådant gruppen
faktiskt vill försöka göra tillsammans, inte en omröstning eller en full
eventplanerare.

`next_stop_place_proposals` lagrar de aktiva köplatserna och refererar samma
kanoniska `place_id` som gruppens `group_places`. Förslagens `created_at`
äger standardordningen: första aktiva stället är **Nästa stopp** och övriga
ligger **På tur** äldst först. Nya förslag läggs sist och skriver aldrig över
köhuvudet. Gruppen får uttryckligen flytta fram ett senare ställe; då blir det
Nästa stopp medan den tidigare köplatsen och övriga ställen behåller sin
inbördes skapade ordning.

`group_next_place` är den bakåtkompatibla och auktoritativa projektionen av
köhuvudet. Den är inte en ranking. Eventuell `next_stop_place_supports`-data
(**Jag vill hit**) är privat kompatibilitets-/preferensdata och får varken
omsortera kön, utse vinnare eller vara nödvändig för att förstå Nästa stopp.
Den signalens eventuella framtida användning utanför planeringskön är ett separat
produktbeslut.

`next_stop_plans` lagrar gruppens enda gemensamma planeringsdag. V2 använder
inte klockslag, och en dag får bara finnas när gruppen har ett faktiskt Nästa
stopp. Binära dagsvar **Jag kan** / **Jag kan inte** återanvänder den privata
`next_stop_date_responses`-lagringen; uteblivet svar är ingen signal och
`Osäker` ingår inte. Om gruppen manuellt flyttar fram ett annat ställe inom
samma planerade tillfälle följer dag och dagsvar med. När det aktuella Nästa
stoppet faktiskt genomförs nollställs däremot dag och svar innan nästa köplats
flyttas fram. Dagen är gruppägd: en aktiv gruppmedlem får ändra den, men klienten
ska tydligt bekräfta ett faktiskt byte och förklara att tidigare dagsvar ersätts
så att alla i gruppen får svara på nytt. Förslagsställaren är inte moderator
eller godkännare för datumändringar.

Ett vanligt kanoniskt besök ska inte i sig konsumera planeringskön. Spontan fika,
lunch, middag eller ett besök på ett ställe som råkar ligga På tur får bygga
gruppens historik utan att ändra Nästa stopp. Endast en besöksregistrering som
uttryckligen startas från det aktuella **Nästa stopp** får avancera kön.
Live-skrivningen använder därför den etablerade besöksmutationen som bas men
sätter en transaktionslokal completion-signal genom
`create_visit_with_review_v6`. Servern verifierar att originalbesöket gäller
gruppens aktuella köhuvud, tar bort endast den köplatsen och väljer därefter
äldsta kvarvarande aktiva förslag. Besöksskrivning och köförflyttning sker i
samma transaktion.

`next_stop_plans`, `next_stop_place_proposals` och
`next_stop_place_supports` är server-only för klientroller. De läses genom den
minimerade `nextStop`-projektionen som v5l återanvänder från v5k; dagsvaren
läses genom samma gruppscopade kompatibilitetsdata som den befintliga
datumresponsen.

Nästa-stopp-mutationerna ska minst säkerställa:

- aktiv grupp, autentisering och aktivt medlemskap;
- att köställen fortfarande är aktiva i gruppens lista;
- högst fem aktiva köställen;
- proposer eller owner/admin för destruktiv borttagning av ett förslag;
- gruppnivålås och revision vid handlingar som kan flytta gemensamt köhuvud
  eller dag, så stale klientstate ger ett begripligt konfliktfel i stället för
  last-write-wins;
- att endast explicit completion från aktuellt Nästa stopp får konsumera
  köhuvudet;
- deterministisk framflyttning via `created_at, id`;
- Europe/Stockholm-semantik för passerad planeringsdag.

Arkivering av köhuvudet får flytta fram nästa äldsta aktiva ställe enligt samma
ordning. En passerad planeringsdag skapar aldrig ett besök automatiskt; klienten
ska fråga efter verkligheten och låta användaren registrera det besök som
faktiskt skedde.

## Besök och deltagare

Ett besök är gruppens verkliga händelse, inte registrerarens individuella logg.
Samma `visits.id` är därför kanoniskt även när besöket visas genom flera
`visit_group_links`.

`visit_participants` betyder **aktuell faktisk identifierad närvaro** på det
kanoniska besöket. Progression, deltagarlistor, delningsbehörighet och aktivt
deltagaromdöme ska härledas från den sanningen i stället för från en separat
registreringspoäng eller administrativ kredit.

`create_visit_with_review_v5` är den serverstyrda basmutationen för vanliga nya besök i
den här modellen. `create_visit_with_review_v6` återanvänder samma mutation men
kan, endast när klienten uttryckligen registrerar aktuellt Nästa stopp, fullfölja
köhuvudet atomärt i samma transaktion. Den som registrerar ett nytt besök måste själv finnas bland de
validerade deltagarna. Nya besök använder `frukost`, `lunch`, `fika`, `middag`
eller `dryck`; `kväll` bevaras endast som läsbart legacyvärde och avvisas för nya
v5-skrivningar.

Nya scorebara reviews använder en explicit och historiskt låst `review_model`.
`food_v1_takeaway` och `food_v1_quick` kräver Smak, Service och Prisvärdhet 1–5.
`food_v1_atmosphere` kräver samma tre dimensioner plus Atmosfär 1–5.
Helhetsbetyget sätts inte separat utan härleds server-side som det aritmetiska
medelvärdet av de dimensioner som ingår i modellen och lagras som decimal.
Klienten får därför inte skicka ett manuellt overall för en review med ny modell.

Hämtmat väljer alltid takeaway-modellen. För besök på plats avgör gruppens hela
`Passar för`-mängd om Atmosfär ingår: endast **Snabbt & enkelt** ger quick-
modellen, medan **Avslappnat** och/eller **Något extra** ger atmosphere-modellen,
även i kombination med **Snabbt & enkelt**. Saknas `Passar för` får den metadata som behövs
för ett nytt på-plats-omdöme sparas på gruppens platsrelation; ett
Hämtmat-omdöme förblir entydigt även utan sådan klassificering men ett frivilligt
val får fortfarande komplettera gruppens platsmetadata. Senare ändringar av
`Passar för` eller besökskontext skriver aldrig om en befintlig reviews frysta
modell eller historiska score.

Reviews från före den härledda modellen har migrerats en gång till en explicit,
historiskt låst legacy-modell. `food_v0_3d` används när Smak, Service och
Prisvärdhet finns: Atmosfär fabriceras aldrig och helhetsbetyget härleds som de
tre dimensionernas aritmetiska medelvärde. `food_v0_overall` används när den
äldre raden endast har ett manuellt helhetsbetyg; då bevaras helhetsbetyget och
saknade detaljbetyg förblir null. Partiella eller andra oväntade legacyformer
stoppar migrationen för manuell bedömning. Backfillen är inte ett mönster för
framtida automatiska modellbyten.

Ett tredimensionellt omdöme är komplett enligt sin egen modell. Ett
`food_v0_overall`-omdöme är på samma sätt historiskt giltigt utan detaljbetyg;
vanlig redigering får ändra det manuella helhetsbetyget inom 1–5 och kommentaren,
men får inte fabricera detaljbetyg eller byta modell. Det senast manuellt sparade
helhetsbetyget är reviewns kanoniska score. Vanlig redigering behåller modellen.
Endast reviewägaren kan genom en separat, uttrycklig och
bekräftad handling komplettera med Atmosfär när den aktuella fyrdimensionella
modellen är relevant. Det gäller `food_v0_3d`, `food_v1_quick` och, efter en
korrigerad Hämtmat-markering, `food_v1_takeaway`; modellbytet sker atomärt först
när alla fyra dimensioner sparas. `dryck`
(**Ett glas**) är fortsatt ett fullvärdigt men scorelöst besök: inga numeriska
reviewfält får sättas och besöket påverkar inte matställets betyg, men
deltagande, progression, återbesök, kommentar och foto fungerar enligt samma
kanoniska besöksmodell.

`visits.is_takeaway` är en kanonisk egenskap på besöket. `false` är implicit På
plats och `true` betyder Hämtmat; den är inte ett `Passar för`-värde och ändrar
inte progression. `dryck` normaliseras alltid till `is_takeaway = false`.
Eftersom delning återanvänder samma `visits.id` följer Hämtmat-kontexten med utan
att källgrupp eller annan privat gruppdata exponeras. Dubblettskyddet tar med
Hämtmat-kontexten för scorebara matbesök så På plats och Hämtmat inte felaktigt
behandlas som samma starka dubblett.

En senare korrigering av `is_takeaway` är reversibel och får inte skriva om
reviewns lagrade `review_model` eller dimensionsvärden. När ett befintligt
modernt omdöme tillfälligt är aktivt i Hämtmat-kontext används i stället en
**effektiv** tredimensionell modell för presentation och aggregat: Smak, Service
och Prisvärdhet räknas om aritmetiskt och ett eventuellt sparat Atmosfärsvärde
döljs men bevaras. Om Hämtmat tas bort igen återgår omdömet till sin lagrade
modell och samma Atmosfärsvärde blir aktivt igen. Ett omdöme som skapades som
Hämtmat får däremot aldrig ett fabricerat Atmosfärsvärde när markeringen senare
tas bort; dess lagrade tredimensionella modell består tills en separat uttrycklig
omvärdering eventuellt kompletterar den. Historiska `food_v0_3d`-reviews
fortsätter använda samma tre dimensioner; Hämtmat-korrigering ändrar därför
varken deras modell eller matematik. `food_v0_overall` saknar detaljdimensioner
helt och behåller därför alltid sitt sparade helhetsbetyg oavsett Hämtmat-kontext.

Servern avvisar ett nytt besök där `auth.uid()` inte finns bland de validerade
`visit_participants`.

`update_visit_v1` är den serverstyrda korrigeringsytan för ett redan kanoniskt
besök. Endast den autentiserade registreraren får använda den, från besökets
originalgrupp där registreraren fortfarande har aktivt medlemskap. Datum,
besökskontext och deltagare som hör till originalgruppen kan korrigeras utan att
ett nytt `visits.id` skapas. Identifierade deltagare som endast hör till en
annan länkad grupp bevaras server-side och får inte försvinna för att klienten i
originalgruppen saknar rätt att se deras identitet.

Privata gäster uppdateras genom stabila `visit_guests.id`, aldrig genom
namnmatchning. En gäst med en pågående eller accepterad #214-koppling får inte
tas bort genom besöksredigeringen. Reviewrader raderas inte när deltagande
korrigeras; gruppens read-modell filtrerar aktiva omdömen mot aktuell faktisk
närvaro. En korrigering av `meal_type` eller `is_takeaway` får inte heller
skriva om en redan fryst `review_model`. `update_own_review_v3` bevarar därför
historiska ratingfält när besöket är scorelöst och ändrar då bara användarens
kommentar; vid scorebara besök följer den samma frysta reviewmodell som v2.

Registreringshandlingen i sig ger ingen extra progression. Registreraren får
samma progression som andra därför att hen är faktisk deltagare, inte därför att
hen skapade raden. Om någon registrerat ett besök som hen i verkligheten inte
deltog i är den avsedda korrigeringen att radera felregistreringen och skapa
besöket korrekt, inte att använda Matrundan som administrativ registrering åt
andra.

`save_own_review_for_visit_v2` kompletterar ett redan existerande kanoniskt
besök. Servern kräver att användaren är faktisk deltagare och att besöket är
legitimt synligt i den aktuella gruppen. För scorebara reviews väljer servern
samma nya reviewmodell och härleder overall från de relevanta dimensionerna. För
`dryck` tillåts i stället en scorelös kommentar med null i alla ratingfält och
`rating_visible = false`; en tom kommentar skapar inte ett meningslöst
reviewobjekt. `update_own_review_v3` behåller varje reviews frysta modell vid normal
redigering. `upgrade_own_review_model_v1` är den separata ägarstyrda vägen från
en tredimensionell modell (`food_v0_3d`, `food_v1_quick` eller
`food_v1_takeaway`) till `food_v1_atmosphere`; kommentar-, besöks- eller
metadataredigering kan aldrig utlösa samma övergång. `reviews` behåller invarianten högst en kanonisk review per
`(visit_id, user_id)`; gruppspecifik synlighet ligger fortsatt i
`review_group_visibility` och löses inte genom reviewkopior.

### Privata omdömesreaktioner

En reaktion hör till det kanoniska individuella omdömet men är privat för den
grupp där omdömet presenteras. `review_group_reactions` använder därför
`(review_id, group_id, user_id)` som unik identitet och refererar samma
`review_group_visibility(review_id, group_id)` som avgör att omdömet alls får
visas i gruppen. En delning skapar aldrig en global reaktion och kopierar inte en
annan grupps reaktioner.

I v1 är ett omdöme reagerbart endast när dess fritextkommentar är synlig och
icke-tom i den aktuella gruppen. Alla aktiva gruppmedlemmar som legitimt kan se
omdömet får reagera, även om de inte själva deltog i besöket. En medlem har högst
en reaktion per omdöme och grupp och får byta eller ta bort den. Reaktioner
påverkar aldrig betyg, progression, ranking eller gamification.

Råtabellen är server-only för klientroller. Läsning sker lazy per besök genom en
minifierad RPC som validerar medlemskap och gruppens besökslänk; skrivning
revaliderar dessutom aktiv grupp, synlighet och reagerbar kommentar. Om en
gruppkoppling eller `review_group_visibility` tas bort ska gruppens reaktioner
försvinna genom FK-cascade utan att påverka samma omdöme i andra grupper.

Andra deltagare får självkorrigera sin egen närvaro med
`set_own_visit_participation_v1`. **Jag var inte med** tar bort den egna aktiva
`visit_participants`-raden och registrerar en privat server-only korrigering i
`visit_participation_self_corrections`. **Jag var med** får endast återställa en
sådan tidigare egen korrigering; RPC:n får inte fungera som godtycklig
självtaggning. Registreraren får inte korrigera bort sitt eget deltagande på ett
besök hen själv skapat. Tabellen kan inte läsas eller skrivas direkt av
klientroller.

En review raderas inte destruktivt när en annan deltagares deltagande korrigeras
bort. Read-modellen slutar i stället exponera den som aktivt deltagaromdöme. Om
användaren senare återställer sin faktiska närvaro kan samma kanoniska review åter
bli relevant. Det bevarar historik utan att ge progression eller synligt
omdöme för någon som inte längre är deltagare.

Den nya registrerarinvarianten är framåtriktad. Befintlig historik där en äldre
version tillät en annan relation mellan `created_by` och `visit_participants`
skrivs inte om automatiskt och får inte backfillas destruktivt bara för att den
nya regeln införs.

Regler:

- registreraren är låst som faktisk deltagare vid nya besök och lämnar sitt eget
  omdöme i registreringsflödet för scorebara matbesök;
- scorelösa dryckesbesök räknas som verkliga besök men skapar ingen rating eller
  omdömesbacklog;
- registreraren får ingen extra progression eller belöning för själva
  registreringshandlingen;
- andra valda eller senare återställda faktiska gruppmedlemmar får
  medlemsspecifik progression;
- andra deltagares självkorrigering gäller samma kanoniska besök i alla grupper
  där besöket legitimt visas; den skapar aldrig en ny `visit`;
- gäster lagras som besöksbundna gäster, inte som gruppmedlemmar;
- gästnamn är presentation och får inte användas som kontoidentitet;
- återbesök är nya verkliga besök och räknas;
- en delad besöksrepresentation får inte duplicera progression, deltagande,
  review eller skapa ett nytt verkligt besök.

## Sökning och sökområden

Gruppens sparade sökområden är förval för en ny söksession, inte permanent
behörighets- eller innehållsgräns.

Alla sparade områden är valda när sökningen öppnas och inget område är primärt.
Temporära ändringar i en söksession får inte tyst skriva om gruppens sparade
områden.

`group_search_areas` använder en explicit hybridmodell:

- `point` är ett verifierat centrum som söks med den valda punkt-radien;
- `boundary` är ett verifierat providerområde som söks inom providergränsen.

En söksession får kombinera båda typerna samtidigt, upp till samma gräns på fem
områden. Radievalet påverkar endast `point`. Resultat från flera områden
sammanförs och dedupliceras på provider + provideridentitet så samma verkliga
matställe inte visas flera gånger bara för att det matchar både en boundary och
en punkt.

Boundaryläget kräver en verifierad provideridentitet och en providergeometri som
kan representeras som Polygon eller MultiPolygon. Bred administrativ geografi
får inte sparas som en ny godtycklig punkt när gränsen inte kan verifieras.
Själva polygonen är sessions-/cachedata för kartpresentation och lagras inte som
privat gruppgeometri i `group_search_areas`.

Historiska områden får aldrig omtolkas tyst. `search_mode` har därför `point` som
bakåtkompatibelt defaultvärde, och ett äldre område blir boundary först efter ett
nytt uttryckligt val där providergränsen verifieras.

## Provider och Geoapify

Geoapify används genom serverfunktioner; API-nyckeln ska aldrig ligga i
klientbundle eller klientlagring.

Provideranrop kan kortlivat cacheas server-side för att minska onödiga anrop,
men cache-nycklar ska inte innehålla gruppmedlemskap eller privat gruppdata.

Providerresultat normaliseras till produktdomänen. Rå payload används som
server-side bevis eller underlag när det behövs, men ska inte spridas genom
klienten.

För boundarysökning är provideridentiteten den auktoritativa filtreringsnyckeln.
Klienten får inte själv avgöra vilka live-matställen som ligger inom en kommun
utifrån den ritade polygonen. Polygon/MultiPolygon används för verifiering och
kartpresentation; själva live-sökningen sker server-side mot providern.

Autocomplete för geografi och matställen ska hålla isär:

- geografiskt scope;
- generell mattyp/kök;
- specifikt verkligt matställe.

Ett specifikt matställe får inte implicit flytta användarens sökområde.

## Praktisk platsinformation

Adress/kartposition, webbplats och öppettider kan komma från extern källa men
kan behöva privata gruppoverrides.

`group_places` bär därför gruppens praktiska override-värden medan global
providerinformation ligger på eller härleds från den kanoniska platsen och dess
källor.

Serverfunktioner för praktisk information ska:

- verifiera aktivt medlemskap;
- hålla historik för gruppens egna ändringar;
- aldrig göra en annan grupps privata källa, anteckning eller adminidentitet
  synlig;
- kunna presentera ett neutralt cross-group-förslag utan att avslöja
  ursprungsgruppen;
- revalidera förslaget server-side vid tillämpning.

Cross-group-förslag får vara en kvalitetssignal, inte ett sätt att bläddra i
andra gruppers data.

## Privat platsrapportering och OSM

`place_data_reports` är den gruppbundna källan för konkreta användarrapporter om
platsdata. Rapportens livscykel och privata fält förblir gruppbundna även när en
neutral projektion av ärendet visas i globalt Platsunderhåll.

Rapporter kan avse:

- ett redan tillagt kanoniskt ställe; eller
- en providerträff som ännu inte lagts till.

Vanliga användare rapporterar fortsatt i sitt naturliga plats- eller sökflöde.
Den historiska privata beskrivningen, rapportören, gruppidentiteten och privata
gruppoverrides får aldrig projiceras till den globala arbetsytan. Endast
strukturerad felkategori och uttryckligen säker neutral platsinformation får
lämna rapportens gruppkontext.

Den äldre OSM Note-infrastrukturen med prepare → extern skrivning → complete/fail
→ statusrefresh finns kvar för redan skapad offentlig historik och kompatibilitet.
Den ska inte byggas djupare in i gruppadministration och är inte den långsiktliga
arbetsytan för platsunderhåll.

En användares privata beskrivning eller gruppnamn får aldrig automatiskt bli
OSM-text. Offentliga OSM-referenser, note-URL och offentlig status får däremot
visas i Platsunderhåll när de redan finns, eftersom de inte avslöjar den privata
gruppkontexten.

Om en plats senare får en aktiv OSM-/providerkälla kan en öppen
`missing_in_osm`-rapport fortsatt lösas enligt befintliga serverinvariants, men
en pågående historisk publicering får inte tyst försvinna mitt i ett
submission-state.

## Manuell plats, kanonisk återanvändning och senare källkoppling

Ett manuellt ställe kan skapas utan extern provideridentitet. Verifierad
kartposition krävs däremot när flödet ska använda cross-group-matchning eller
skapa ett neutralt förbättringsunderlag. Fri text får aldrig gissas om till
verifierad geografi.

### Återanvändning före ny kanonisk plats

När användaren uttryckligen går vidare från sökningen med **Lägg till ett ställe
som saknas** får servern göra en begränsad kontroll om ett relevant kanoniskt
Matrundan-ställe redan finns utan aktiv extern källa.

Kontrollen är inte en publik eller generell platskatalog. Den får bara ske i den
konkreta tilläggskontexten och kräver namn samt verifierad kartposition.
Kandidatpoolen begränsas geografiskt och matchningen är konservativ över minst
namn, avstånd och när tillgängligt adress/ort.

Liknande namn är aldrig ensamt tillräckligt för automatisk sammanslagning. En
kandidat är ett förslag till användaren, inte en merge-order. Om flera rimliga
kandidater finns ska användaren kunna välja eller uttryckligen avstå från dem.
Två närliggande verksamheter måste kunna förbli separata.

Cross-group-läsningen sker i en minimerad `SECURITY DEFINER`-RPC med låst
`search_path`, aktiv grupp- och medlemskontroll. Klienten får endast neutral
platsidentitet som behövs för valet:

- kanoniskt plats-ID;
- namn och kategori;
- säker adress/ort/område när det finns;
- kartposition och avstånd;
- neutral matchtyp;
- om samma platsrelation redan är aktiv/arkiverad i målgruppen.

Följande får aldrig lämna servergränsen genom kandidatflödet:

- ursprungsgrupp eller gruppnamn;
- vem som skapade eller använder platsen;
- medlemskap eller antal grupper;
- privata anteckningar, Passar för, rapporter eller praktiska overrides;
- interna grupp- eller användar-ID:n.

När användaren väljer en kandidat återanvänds samma `places.id`. Servern skapar
eller återaktiverar endast målgruppens `group_places`-relation och får inte
kopiera metadata från någon annan grupp.

När användaren väljer **Inget av dessa stämmer** får ett nytt kanoniskt ställe
skapas, men servern gör kandidatkontrollen igen precis före skapandet. För
verifierade fallbackskapanden serialiseras den korta kontroll-/skapandefasen med
ett transaktionslås så att två samtidiga grupper inte båda kan passera kontrollen
och skapa samma rimliga kandidat samtidigt. Kandidater som användaren redan
uttryckligen avböjt får passera; nya eller förändrade kandidater måste visas på
nytt.

### Neutralt förbättringsunderlag

Ett verifierat manuellt ställe utan aktiv extern källa kan skapa en intern
`place_improvement_candidates`-rad med betydelsen ungefär **behöver matchas mot
extern källa**.

Detta underlag är medvetet separat från `place_data_reports`:

- det betyder inte **saknas i OpenStreetMap**;
- det är inte en användarrapport;
- det har en egen intern livscykel;
- `anon` och `authenticated` saknar direkt tabellåtkomst;
- det projiceras till samma globala arbetsyta genom ett minimerat
  serverkontrakt.

När samma kanoniska plats senare får en aktiv `place_sources`-koppling löses
öppna eller OSM-markerade förbättringskandidater automatiskt. Därmed följer
förbättringsunderlaget platsidentiteten i stället för en specifik grupps privata
historik.

### Globalt Platsunderhåll

`Platsunderhåll` är en enda global intern arbetsyta för särskilt behöriga
platsunderhållare. Gemensam UX innebär inte gemensam tabell: den paginerade
serverprojektionen `list_place_maintenance_work_items_v1` förenar minst
`place_improvement_candidates` och relevanta `place_data_reports` till ett
minimerat work-item-kontrakt.

Behörighet styrs av den privata rollen `place_maintainers` och är uttryckligen
separerad från grupproller. Att vara owner/admin i en eller flera grupper ger
aldrig global maintainerbehörighet. Klienten får bara fråga en boolesk access-RPC
och får inte läsa rolltabellen direkt.

Den globala projektionen får returnera det som behövs för handläggning:

- work-item-typ och intern arbetsstatus;
- kanoniskt plats-ID när ett sådant finns;
- neutral platsidentitet som namn, kategori, säker adress/ort och verifierad
  kartposition;
- strukturerad rapportkategori;
- relevant aktiv extern identitet;
- för providerträffar utan kanoniskt `place_id`: endast den säkra
  provideridentifierade platsögonblicksbild som behövs för att förstå ärendet;
- befintlig offentlig OSM-referens/status när sådan redan finns.

Den får aldrig returnera ursprungsgrupp, gruppnamn, medlemskap, rapportör,
`source_group_id`, historisk privat rapporttext, privata gruppanteckningar,
Passar för, favoriter, besök, `group_places`-overrides eller rå providerpayload.
För rapporter om kanoniska ställen används aktuell neutral `places`-data i
stället för gruppens privata rapportögonblicksbild.

Arbetsstatusen normaliseras i UI till exempelvis:

- `open`: ska kontrolleras;
- `needs_osm`: kräver manuellt arbete i OpenStreetMap;
- `resolved`: ärendet är löst;
- `dismissed`: ärendet är avfärdat med kontrollerad orsak när det stöds.

`place_maintenance_events` auditerar globala maintainerhandlingar polymorft för
både rapporter och förbättringskandidater utan att kopiera privat rapporttext.
Den kandidat-specifika `place_improvement_candidate_events` kan samtidigt
bevara kandidatens lägre nivå-historik. Auditaktörens användarreferens nullas vid
profilradering så historiken kan bevaras utan att blockera kontolivscykeln.

Providerkontroll för förbättringskandidater sker server-side. Klienten skickar
endast work-item/kandidat-ID och vald provideridentitet; servern laddar den
neutrala kandidatpositionen, gör en färsk Geoapify-sökning och håller API-nyckel
samt rå providerdata server-side. En verifierad provideridentitet får bara
kopplas till samma befintliga `places.id` och får inte flyttas från en annan
kanonisk plats.

`needs_osm` är endast intern arbetsstatus. Platsunderhåll får öppna OSM, kopiera
neutral platsinformation och låta underhållaren arbeta manuellt i OSM-webben
eller Every Door. Matrundan gör ingen automatisk OSM-publicering eller redigering
i #163. En framtida autentiserad OSM-adapter ska ligga bakom samma globala
underhållsgräns och kräver separat feature- och secret/auth-driftsättning.

Den tidigare gruppspecifika arbetskön **Rapporterade fel** är reducerad så att vi
inte har två administrativa dashboards. Vanliga användares **Rapportera fel**-
handlingar finns kvar och skriver fortsatt till den gruppbundna rapportkällan.
Befintliga rapporter och offentlig OSM Note-historik bevaras.

Demo/test använder en deterministisk lokal fixture på samma route med minst ett
rapporterat fel, en förbättringskandidat, en providerträff, OSM-åtgärd och ett
avslutat ärende. Den ska vara tydligt märkt som fiktiv utvecklingsdata och får
inte göra provider-, databas- eller OSM-skrivningar.

### Senare extern källkoppling

I gruppens befintliga detaljflöde får ägare/admin länka en senare providerträff
till ett manuellt ställe endast om:

- målplatsen är aktiv i gruppen;
- målplatsen saknar aktiv extern källa;
- exakt en konservativ match finns;
- den externa identiteten inte redan används av en annan aktiv plats;
- namn, adress och kartposition uppfyller servervaliderade kontrakt.

Det globala Platsunderhållets maintainer-länkning följer motsvarande kanoniska
identitetsvakter men är inte beroende av en viss grupprelation.

Tvetydighet innebär alltid ingen åtgärd. Fuzzy auto-merge ingår inte.

Källkopplingen bevarar samma `places.id`, `group_places`, besök, omdömen och
privata gruppuppgifter. Den får inte skriva över eller exponera gruppmetadata.

## Delning mellan grupper

Delning får aldrig bli cross-group-läsning av privat källdata.

När ett matställe delas mellan två av användarens grupper ska målgruppen kunna
återanvända samma kanoniska platsidentitet, men följande ska inte följa med:

- besök;
- omdömen;
- favoriter;
- privata anteckningar;
- Passar för;
- adminhistorik;
- gruppmedlemskap.

Dagens specifika delningsfunktioner och framtida återanvändning ska alltså skapa
eller återaktivera målgruppens relation, inte kopiera hela `group_places` eller
historik.

## Delade besök

Ett verkligt besök kan visas i mer än en grupp utan att dupliceras som två
verkliga händelser.

Delningslänken ska därför peka på samma besöksidentitet och bara exponera den
minsta information som målgruppen behöver.

Identifierat deltagande och en användares kanoniska review hör till själva
besöket, inte till en kopia per grupp. Gruppkontexten styr fortfarande vilka
medlemmar, kommentarer och reviewfält som får presenteras. Om en annan deltagare
självkorrigerar sin faktiska närvaro ska samma sanningsändring därför gälla i
alla gruppvyer av samma besök utan att avslöja vilka andra grupper som länkar
dit.

Reaktioner är uttryckligen gruppspecifika trots att reviewn är kanonisk. Samma
review får därför ha olika `review_group_reactions` i två grupper. Delning får
aldrig kopiera eller projicera källgruppens reaktörer, reaktionsantal eller annan
gruppintern social aktivitet; målgruppen börjar med sin egen reaktionskontext.

Ursprungsgrupp, privata kommentarer, medlemskap och interna ID:n får aldrig
exponeras i delningspayloaden.

Progression och statistik ska dedupliceras på det verkliga besöket så att en
delad representation inte räknas två gånger.

## Exempelgrupp och demo

Exempelgruppen är ett permanent scenariokontrakt, inte bara statisk mockcopy.
Den ska kunna visa viktiga produkttillstånd med samma huvudkomponenter som live
utan att göra externa provider-/OSM-skrivningar.

Demo/exempel får därför använda deterministiska lokala fixtures för:

- providerresultat;
- geografiska val;
- privata signaler;
- kanonisk återanvändning;
- källa- och kvalitetskontroll.

Fixtures får aldrig antyda att en extern skrivning faktiskt gjorts.

När en större feature ändrar huvudflödet ska PR:n uttryckligen bedöma om
exempelgruppens scenariokontrakt behöver uppdateras.

## Notiser

Notifieringar köas server-side tillsammans med den händelse som skapar dem.
Klienten får trigga en snabb flush efter en lyckad mutation, men en misslyckad
notisleverans får inte få själva produktmutationen att misslyckas.

Ett schemalagt jobb är säkerhetsnät för kvarvarande outbox-rader.

Notiser får bara innehålla minsta nödvändiga gruppkontext och ska inte bli en
ny delningskanal för privat data.

När en senare faktisk deltagare lämnar sitt första omdöme på ett befintligt
besök använder `review_added` samma outbox och gruppspecifika synlighetsmodell.
Författaren notifieras inte om sitt eget omdöme och senare redigeringar eller
reaktioner skapar ingen ny push. Registrerarens initiala omdöme skapas tillsammans
med själva besöket och ska inte ge en dubblerad omdömesnotis. Deep-linken får
bära målgrupp, besök och review men ingen privat source-group-identitet.

## Release och databasdrift

Version, in-app-historik och `CHANGELOG.md` ska hållas synkroniserade för en
releasekandidat.

Produktions-preflighten ska ha en credential-fri release-security-grind före
jobbet som använder GitHubs `production`-environment. Grinden återanvänder
`Public readiness` för full-history secret scan och kräver dessutom grön
`CI / required` för exakt aktuell `main`-SHA. Först därefter får
produktionscredentials exponeras för preflight-jobbet.

Den exakta produktionsbuilden ska före inert upload verifieras mot de
serverhemligheter som finns i preflight-jobbets miljö. Ett fynd får ange
kontraktsnamn och artifact-path men aldrig skriva ut själva hemligheten.
Dependency review körs endast när en PR faktiskt ändrar dependency-manifest
eller lockfil, så vanlig produktutveckling behåller den snabba PR-loopen.

En migration i GitHub betyder inte att produktionsdatabasen är migrerad.
Databasdriftsättning kräver separat uttryckligt godkännande.

Efter migration ska minst följande verifieras innan publicering:

- nya tabeller, kolumner, index, constraints, triggers och RPC-signaturer;
- positiva grants;
- negativa grants och RLS-isolering;
- PostgREST schema-cache;
- autentiserad läsning av en verklig grupp;
- eventuell backfill eller datakvalitet som migrationen lovar.

`supabase/production-preflight.sql` är den kanoniska driftkontrollen och ska
uppdateras när en release inför nya obligatoriska databasobjekt eller
behörighetsinvariants. Avgränsade releasepreflight-filer får komplettera den
kanoniska kontrollen när de uttryckligen körs tillsammans med den vid just den
release som inför objekten.

## Migrationer

Migrationer är append-only efter att de har driftsatts i produktion.

Redigera eller spela inte om en redan applicerad migrationsfil för att få lokala
miljöer att se rena ut. Lägg i stället en ny framåtriktad migration.

Migrationer ska vara konservativa med befintlig data:

- inga destruktiva omskrivningar utan uttryckligt beslut;
- gamla punktbaserade sökområden får inte tyst bli polygoner;
- gamla platsrelationer får inte automatiskt fuzzy-mergas;
- historiska privata fält får inte bli globala bara för att en ny kanonisk modell
  tillkommer.

## Miljö och secrets

Följande får aldrig ligga i klientbundle, klientpersistens eller publika
repositoryfiler:

- service-role-nyckel;
- providerhemligheter;
- webhook-/pushhemligheter;
- användartokens;
- rå privat providerpayload som endast behövs server-side.

Publika klientnycklar som Supabase anon-key får användas enligt leverantörens
modell men de ersätter aldrig RLS och servervalidering.

## Arkitekturchecklista för större ändringar

Innan implementation av ändringar i datamodell, integritet, delning,
autentisering, Geoapify, notiser eller gamification ska planen besvara:

1. Vilket objekt är kanoniskt?
2. Vilken grupp äger vilken metadata?
3. Vilken data får klienten faktiskt se?
4. Vilken kontroll måste ligga server-side?
5. Kan ändringen skapa eller sammanblanda cross-group-data?
6. Hur hanteras demo/exempel utan att försvaga live-modellen?
7. Krävs migration eller backfill, och är den icke-destruktiv?
8. Vilka positiva och negativa behörigheter måste verifieras?
9. Behöver `production-preflight.sql` uppdateras?
10. Behöver kontoraderingsflödet scrubba en ny användarreferens?
11. Binder ändringen Matrundans domän onödigt till en viss leverantör eller
    webbklient, och i så fall varför är det motiverat?

Om någon av dessa frågor saknar ett verifierbart svar är arkitekturplanen inte
klar.
