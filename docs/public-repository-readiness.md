# Public repository readiness

Matrundan ska kunna förberedas för offentlig repository-visibility utan att ett sådant beslut blandas ihop med produktrelease, databasdriftsättning eller publicering av appen.

Det här dokumentet är en säkerhets- och underhållschecklista. Att checklistan är uppfylld gör **inte** repot publikt och är inte ett beslut om open-source-licens.

## Grundprinciper

- Produktens privata gruppdata, användardata och serverhemligheter får aldrig ligga i Git-repot.
- Browser-exponerade nycklar ska behandlas som publika och begränsas hos leverantören med origin/referrer-regler där det stöds.
- Serverhemligheter ska ligga i deployment-/runtime-miljön och aldrig i `VITE_*`-variabler eller versionshanterade filer.
- Demo- och exempeldata i repot ska vara uttryckligen fiktiva och får inte härledas från riktiga privata grupper.
- Ett framtida visibility-byte är en separat administrativ åtgärd som kräver uttryckligt godkännande.

## Före varje framtida visibility-byte

### 1. Aktuellt träd

- Kör `bun run verify:full` i en fullständig checkout.
- Kör `bun scripts/public-readiness-check.mjs` efter att alla relevanta refs har hämtats.
- Verifiera att ingen `.env`, privatnyckel, credentials-fil eller motsvarande är versionshanterad.
- Verifiera att `.env.example` endast innehåller placeholders och tydligt skiljer browser-exponerade värden från serverhemligheter.

### 2. Hela Git-historiken och refs

`scripts/public-readiness-check.mjs` söker efter ett litet antal starka hemlighetsmönster i alla lokalt nåbara Git-refs utan att skriva ut de misstänkta värdena. Den är ett skyddsräcke, inte en fullständig secretscanner.

Före faktisk offentlig visibility ska dessutom:

- alla remote branches och tags hämtas;
- gamla feature-, backup- och Lovable-brancher granskas;
- en etablerad history-aware secretscanner, exempelvis GitHubs egen secret scanning eller motsvarande lokalt verktyg, användas när den är tillgänglig;
- tidigare exponerad riktig hemlighet roteras även om den senare har tagits bort från historiken.

Skriv inte om Git-historiken enbart för kosmetik. Om en riktig hemlighet hittas ska rotation komma först; eventuell historikrensning är en separat riskbedömd operation.

### 3. GitHub-innehåll utanför kodträdet

Granska manuellt sådant som också kan bli offentligt:

- öppna och stängda issues;
- PR-beskrivningar, kommentarer och reviewtrådar;
- Actions-loggar och artifacts;
- screenshots och uppladdade bilagor;
- releases och release-assets;
- projekt-/roadmaptext som inte är avsedd för extern insyn.

Privata foton, riktiga gruppnamn, e-postadresser, interna användar-/grupp-ID:n, privata kommentarer eller autentiseringsmaterial får inte finnas där.

### 4. Leverantörsnycklar

- Supabase publishable key är browserkonfiguration och ska fortfarande skyddas av RLS och serverkontroller.
- Supabase service-role/secret key får aldrig finnas i klienten eller Git.
- Geoapify-kartnyckel som används i browsern ska ha så snäv origin/referrer-begränsning som möjligt.
- Servernycklar för Geoapify och VAPID private key ska ligga enbart i servermiljön.

### 5. Licens och varumärke

Repository-visibility och licens är separata beslut.

Innan repot görs publikt ska ägaren uttryckligen välja licensstrategi. Tills dess ska ingen open-source-licens läggas till av bekvämlighet. Ett publikt repo utan uttrycklig open-source-licens ska inte beskrivas som open source.

Matrundan-namn, logotyp och eventuell framtida varumärkesstrategi bedöms separat från källkodslicensen.

### 6. Slutligt beslut

Före visibility-byte ska leveranskvittot minst ange:

- verifierad `main`-SHA;
- resultat från `bun run verify:full`;
- resultat från `bun scripts/public-readiness-check.mjs`;
- resultat från history-aware secretscan;
- vilka branches/tags som ingick;
- manuell granskning av issues/PR/Actions/artifacts;
- licensbeslut;
- eventuella roterade nycklar;
- uttryckligt godkännande att ändra repository visibility.

Att appen redan är publik på webben ändrar inte dessa krav. En publik webbapp gör produktidé och klientbeteende observerbart, men ett publikt repo exponerar även implementation, historik, interna dokument och utvecklingsspår.
