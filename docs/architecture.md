# Matrundan – arkitektur och säkerhetsbeslut

Det här dokumentet är Matrundans kanoniska källa för varaktiga arkitektur-,
data- och säkerhetsbeslut. Det beskriver avsiktliga gränser och invariants, inte
ett fullständigt schemadump.

När kod, migrationer och dokumentation skiljer sig ska den senaste
produktionskompatibla migrationen och den faktiska runtime-vägen inspekteras.
Dokumentationen ska rättas i samma ändring.

## 1. Produktgräns

Matrundan är en privat, gruppcentrerad app för vänner och familjer som vill:

1. samla matställen de är nyfikna på;
2. bestämma nästa gemensamma stopp;
3. registrera verkliga besök och faktiska deltagare;
4. bevara privata omdömen, favoriter, foton och historik;
5. använda historiken som inspiration till nästa upplevelse.

Produkten är avsiktligt inte:

- en offentlig restaurangkatalog eller publik recensionsplattform;
- en offentlig social feed;
- en individuell matdagbok;
- en generell karttjänst;
- en global tävling eller ranking;
- en rekommendationsmotor som blandar privata grupper.

Gruppen är den primära produkt- och integritetsgränsen. Kanoniska verkliga
entiteter kan länkas tekniskt mellan grupper, men synlig kontext och
användarskapat innehåll förblir gruppprivat.

## 2. Körlägen

### Publik landning

Utloggade användare möts av en publik start utan `StoreProvider` och utan att
privat gruppdata laddas. Landningen erbjuder konto/inloggning, privat inbjudan
och den sekundära exempelgruppen.

Direkta inbjudningsrutter ska fungera utan att först gå via landningen.
Landningen får aldrig framstå som medlemskap i en grupp.

### Interaktiv exempelgrupp

`/exempel` öppnar en uttryckligt märkt, helt fiktiv exempelgrupp.

- Startdata kommer från `EXAMPLE_STATE`.
- Matställen, adresser, medlemmar, besök, betyg och aktivitet är fiktiva.
- Vanliga produktkomponenter och lokala mutationer återanvänds.
- Ändringar sparas endast i en dedikerad `sessionStorage`-nyckel i aktuell flik.
- Exempelläget får aldrig nå live-mutationer, Supabase eller permanent Storage.
- Besöksfoton lagras lokalt som komprimerad data endast i sessionen.

En ny flik börjar från fast exempeldata. Omladdning i samma flik behåller
sessionens ändringar tills användaren återställer eller lämnar exemplet.

### Intern testsandbox

`?demo=1` är en separat skrivbar sandbox för utveckling och regressionstester.
Den använder egen `localStorage`, får inte dela data med exempelgruppen och ska
inte presenteras som användarens riktiga grupp.

### Live-läge

Live-läge aktiveras efter autentisering. Den aktiva gruppen bestämmer den enda
grupp-read-model som laddas i appens store.

Övergångar mellan landning, exempel, demo och live ska vara deterministiska.
Utloggning och kontobyte ska rensa tidigare live-state och gruppval.

## 3. Applikationslager

### UI och routes

- `src/routes/` innehåller filbaserade vyer.
- `src/components/matrundan/` innehåller produktspecifika komponenter och
  dialoger.
- `src/components/ui/` innehåller delade shadcn/Radix-primitiver.

UI får konsumera read-model och anropa godkända mutationsgränser, men ska inte
återskapa serverns behörighetsbeslut eller göra ad hoc-frågor mot databasen.

### Domän, state och repositories

- `src/lib/matrundan/types.ts` definierar klientens read-model.
- `src/lib/matrundan/store.tsx` komponerar lokal/live-state och persistence.
- `src/lib/matrundan/live-repository.ts` mappar den säkra live-payloaden till
  `AppState`.
- `src/lib/matrundan/live-mutations.ts` och domänspecifika adminmoduler innehåller
  godkända live-skrivningar.
- `src/lib/matrundan/rpc-client.ts` är den centrala typ-escape hatchen och
  runtime-validerade RPC-gränsen.
- `src/lib/matrundan/example-data.ts` och `demo-data.ts` äger startdata för de
  två lokala lägena.
- Ren domänlogik ska ligga i testbara moduler utan React- eller databasberoende.

Exempel och testsandbox ska återanvända samma produktflöden och lokala
domänmutationer. Separata UI-implementationer per körläge ska undvikas.

### Serverintegrationer

Serverfunktioner kapslar hemligheter och tredjepartsanrop. Geoapify-anrop finns
i `src/lib/matrundan/geoapify.functions.ts`; klienten får endast normaliserade
svar och aldrig API-nyckeln eller råa providerpayloads.

### Databas

Supabase/PostgreSQL lagrar kanoniska entiteter, grupprelationer, medlemskap,
inbjudningar, planering, recensioner, favoriter, aktivitet, notisdata och privat
media. Känslig åtkomst skyddas av RLS, explicita grants och
medlemskapsvaliderande RPC-funktioner.

## 4. Identitet och medlemskap

### Profiler

En profil representerar en autentiserad användare. Profilinformation får visas i
en grupp när betraktaren har rätt att se medlemmen eller en historisk
deltagare.

Självbetjänad kontoradering är serverorkestrerad:

- grupper med andra aktiva medlemmar kräver uttrycklig efterträdare för ägaren;
- ensamägda grupper kräver separat destruktiv bekräftelse och tas bort;
- namn, avatar, kommentarer, favoriter, planeringssvar och privat media tas bort;
- numeriska omdömen och genomförd deltagandehistorik bevaras anonymt som
  **Tidigare medlem**;
- auth-användaren hanteras med service role först efter att databastransaktion
  och privat objektstädning har lyckats.

### Grupper och roller

En användare kan vara aktiv medlem i flera grupper och växla aktiv grupp.
Exempelgruppen är aldrig en databasgrupp och ger inga riktiga rättigheter.

Medlemskap har roll och livscykel. Viktiga invariants:

- endast aktivt medlemskap ger aktuell åtkomst;
- tidigare medlemmar får inte återfå åtkomst genom historiska rader;
- endast aktiva medlemmar visas i aktuella topplistor;
- ägarskap kan inte tyst tas bort eller nedgraderas;
- ägaröverföring är atomisk;
- exakt en aktiv ägare ska finnas per aktiv grupp;
- återinträde återställer inte automatiskt en tidigare ägarroll.

## 5. Kanoniska matställen

### `places`

`places` representerar ett verkligt matställe oberoende av grupp. Ett provider-
ställe identifieras primärt med `(provider, provider_place_id)`.

Namn/adress kan användas som ett kontrollerat reservfall för manuella ställen,
men ersätter inte provideridentiteten.

### `place_sources`

Providerrelaterad metadata hör till det kanoniska stället. Råa
providerpayloads är inte en stabil appmodell och ska inte skickas till klienten.

### `group_places`

`group_places` representerar en grupps relation till ett kanoniskt ställe. Här
hör gruppspecifik information hemma:

- anteckning;
- kategori, kök och inriktning;
- **Passar bäst för** och valfritt **Passar också för**;
- vem som lade till stället och hur relationen uppstod;
- om stället finns i gruppens aktiva lista.

Det ordnade `occasions`-fältet har semantik:

- listan får vara tom tills gruppen känner stället tillräckligt väl;
- första värdet, när det finns, är primärt användningssammanhang;
- andra värdet är valfritt sekundärt sammanhang;
- äldre extra värden ignoreras tills en behörig användare sparar om.

Interna värden är stabila även om svensk copy utvecklas. Gruppens topplista
rankar ett ställe endast i dess primära sammanhang.

Kända ursprung normaliseras som `manual`, `provider` och `shared`. Okända värden
ska falla säkert mot delat/importerat, inte manuellt, eftersom ett manuellt
fallback kan ge felaktig gamification.

### Livscykel i gruppen

**Ta bort från gruppen** är en mjuk livscykeländring på `group_places`, inte en
radering av `places`.

Ett borttaget ställe ska:

- försvinna från aktiva listor, kartor, nästa stopp och slumpning;
- behålla kanoniska besök, deltagare, omdömen och gruppmetadata;
- kunna nås via historiska besök;
- återaktiveras genom det vanliga **Lägg till**-flödet utan dubblett.

Användaren ska inte behöva förstå intern copy som arkivera eller återaktivera.
I sökningen visas tidigare borttagna ställen som vanliga kandidater med
**Lägg till**.

## 6. Gruppens sökområden

### Datamodell

`group_search_areas` innehåller upp till fem verifierade Geoapify-områden per
grupp:

- kort visningsetikett;
- provider och provider place ID;
- latitud och longitud;
- stabil sorteringsordning.

Det finns inget primärt område. Alla sparade områden beskriver tillsammans
gruppens vanliga sökstart och är valda när sökningen öppnas.

`groups.default_search_radius_km` lagrar en gemensam standardradie. Tillåtna
värden är 1, 2, 3, 5, 10, 25 och 50 km.

### Regler

- Endast ägare och admin får ersätta gruppens sökområden och standardradie.
- Samma providerplats får inte förekomma två gånger i samma grupp.
- Hela listan valideras innan tidigare inställningar ersätts.
- Migrationer bevarar befintliga verifierade områden och produktionsrader.
- Första sparade området speglas till äldre `home_location_*`-kolumner under
  övergången, men den nya listan är den kanoniska modellen.
- Overifierad fritext får inte användas som koordinatkälla.
- Kommuner, län, regioner och länder får inte sparas som nya punktcentrum.
  Valideringen använder både Geoapifys typ och platsens etikett eftersom svenska
  kommuner ibland klassificeras som `city`.
- Befintliga breda områden raderas inte automatiskt. De visas med vägledning i
  gruppinställningarna tills en behörig användare byter dem mot en ort, stadsdel
  eller adress.
- En tillfällig annan plats i sökdialogen sparas inte automatiskt i gruppen.
- Sökområden är endast förvalda sökcentrum och aldrig geografiska begränsningar
  för vad gruppen får lägga till eller besöka.

Skrivning går atomiskt genom `replace_group_search_settings`. Nya grupper skapas
med områden och gemensam radie genom `create_group_with_owner_v2`.

### Dolda providersökträffar

`group_hidden_place_suggestions` är en gruppspecifik spärrlista för felaktiga
eller inaktuella träffar från en extern platsleverantör. Identiteten är
`(group_id, provider, provider_place_id)`.

- Döljning påverkar bara söklistan och kartan i den aktuella gruppen.
- Det kanoniska matstället, `places` och andra gruppers sökningar påverkas inte.
- Alla aktiva gruppmedlemmar får läsa spärrlistan så att samma filtrering gäller
  i gruppen.
- Endast ägare och admin får dölja eller återställa en live-träff.
- Direkt tabellåtkomst är spärrad; läsning och skrivning går genom
  medlemskapsvaliderande RPC-funktioner.
- Exempel- och demoläge lagrar motsvarande provideridentitet endast i den
  aktuella webbläsarsessionen och gör inga live-skrivningar.
- Providerträffar som uttryckligen är märkta som nedlagda, övergivna, rivna
  eller borttagna filtreras före sökresultatet. Avsaknad av webbplats eller
  öppettider räcker inte som grund för automatisk bortfiltrering.

## 7. Kanoniska besök

### `visits` och `visit_group_links`

`visits` representerar ett verkligt besök en gång. Gruppsynlighet lagras i
`visit_group_links`:

- exakt en `original`-länk anger registrerande grupp;
- noll eller flera `shared`-länkar visar samma besök i andra grupper.

En databasconstraint ska hindra fler än en originallänk per besök.

### Deltagare

`visit_participants` representerar faktiska autentiserade deltagare.
Registreraren får ingen extra progression om hen inte själv är deltagare.

I en grupps read-model:

- relevanta nuvarande och historiska gruppdeltagare kan visas;
- personer utanför gruppen exponeras inte som identiteter;
- externa personer representeras endast som ett anonymt antal.

### Privat besöksfoto

`visit_media` är gruppspecifik privat media kopplad till besökets originallänk.

- Delade målgrupper får aldrig ursprungsgruppens foto, storage path eller URL.
- Objekt ligger i den privata `visit-photos`-bucketen under validerad grupp- och
  besökssökväg.
- Endast faktisk deltagare eller gruppens ägare/admin får lägga till eller
  ersätta foto.
- Deltagare, registrerare eller gruppens ägare/admin får ta bort foto enligt
  serverns regler.
- Arkiverade grupper och delade länkar är skrivskyddade.
- Bilder omkodas i webbläsaren till JPEG, begränsas i dimension och storlek och
  tappar EXIF/GPS-metadata före uppladdning.

Besöket skapas före medieuppladdningen. Ett mediafel får inte rulla tillbaka det
verkliga besöket.

### Radering av originalbesök

Registreraren eller originallänkens ägare/admin får korrigera historiken genom
att radera ett originalbesök i en aktiv grupp.

Raderingen tar bort besöket överallt, inklusive delningar, deltagare, omdömen,
visibilityrader, media och relevant aktivitet. Det kanoniska matstället och
gruppernas platsrelationer ska lämnas kvar.

Att ta bort en delad länk är en separat, icke-destruktiv handling som bara tar
bort målgruppens relation och målgruppsspecifika aktivitet/visibility.

### Delning

En användare får dela ett besök till en annan aktiv grupp endast när servern
verifierar deltagande och aktivt medlemskap i målgruppen.

Delning ska:

- länka samma kanoniska besök och plats;
- skapa eller återaktivera målgruppens `group_places` vid behov;
- aldrig exponera `source_group_id`;
- endast visa deltagaridentiteter som är relevanta för målgruppen;
- representera andra som anonymt `+N`;
- börja med konservativ kommentarssynlighet.

Tidigare egna besök kan erbjudas vid tillägg av ett säkert identifierat
Geoapify-ställe. Inget tidigare besök eller privat kommentar är förvalt.

## 8. Planering av nästa stopp

`next_stop_date_proposals` och `next_stop_date_responses` är privata för gruppen
och aktuellt nästa stopp.

- En aktiv medlem kan föreslå datum och valfri tid.
- Aktiva medlemmar kan svara **Passar**, **Passar inte** eller **Osäker**.
- Förslagsställare, ägare eller admin får ändra, bekräfta eller ta bort.
- En verklig datum/tidsändring nollställer svar och öppnar ett bekräftat förslag
  igen.
- Oförändrade värden är en no-op.
- Förslaget stängs när nästa stopp byts, tas bort eller registreras som besökt.
- Tidigare medlemmars svar räknas inte i aktuell gruppvy.
- Det sker ingen automatisk majoritetsbekräftelse.

## 9. Omdömen och synlighet

`reviews` är kanoniska per besök och användare. `review_group_visibility` styr
betygs- och kommentarssynlighet per grupp.

Vid delning:

- relevanta betyg kan visas i målgruppen;
- kommentarer är dolda tills författaren uttryckligen väljer annat;
- en användare får ändra visibility endast för sitt eget omdöme;
- aggregat får endast använda betyg som är synliga i aktiv grupp.

Privata kommentarer får inte läcka genom aktivitet, felmeddelanden, aggregat
eller metadata om ursprungsgruppen.

## 10. Säker read-model

`get_group_app_state_v5e(_group_id)` är den primära live-läsgränsen. Den bygger
vidare på v5d och lägger till gruppens `searchAreas` och
`defaultSearchRadiusKm` utan att öppna direkt tabellåtkomst.

Funktionen är `SECURITY DEFINER` med låst `search_path` och ska:

- kräva autentiserad användare;
- kräva aktivt medlemskap i exakt `_group_id`;
- returnera endast en grupps data;
- exponera endast fält som appen behöver;
- bevara tillåtna historiska visningsnamn;
- anonymisera externa deltagare;
- utelämna ursprungsgruppens identitet;
- beräkna endast gruppsynliga omdömen;
- inkludera foto endast för aktuell grupp och låta repositoryt skapa kortlivade
  signerade URL:er.

Känsliga kanoniska tabeller och relationstabeller ska inte återöppnas för direkt
klient-`SELECT` som genväg för nya funktioner.

## 11. Säkra skrivningar

Skrivningar använder godkända RPC-funktioner eller serverfunktioner.

En skrivgräns ska normalt:

1. härleda användaren från `auth.uid()`;
2. verifiera aktivt medlemskap och roll;
3. verifiera att alla ID:n hör till avsedd gruppkontext;
4. validera enums, längder, intervall och immutabla identiteter;
5. utföra hela operationen atomiskt;
6. använda `SECURITY DEFINER` och låst `search_path` när lämpligt;
7. återkalla exekvering från `PUBLIC` och `anon`;
8. ge endast avsedd roll, normalt `authenticated`, rätt att anropa.

Klientangiven användare, författare, ägare, medlem, grupp eller ursprungsgrupp
får aldrig litas på utan servervalidering.

Arkiverade live-grupper är centralt skrivskyddade. Att bara dölja knappar är
inte behörighetskontroll.

## 12. Geoapify och flerområdessökning

Geoapify används för:

- autocomplete av verifierade platser;
- sökning efter matställen runt ett eller flera valda centrum.

`GEOAPIFY_API_KEY` lagras i Lovable Cloud Secrets och läses endast av serverkod.
Den får aldrig förekomma i klientbundle, `VITE_`-variabler, repo,
browserrespons eller loggar.

Sökningen använder en gemensam radie för alla valda centrum. Servern gör ett
begränsat anrop per centrum och:

- validerar maximalt antal centrum och tillåten radie;
- normaliserar resultat till en providerneutral modell;
- deduplicerar primärt på provider + provider place ID;
- behåller kortaste avståndet och närmaste områdesetikett;
- sorterar på kortaste avstånd och därefter namn;
- begränsar totalen till högst 50 unika resultat;
- returnerar fungerande delresultat när ett enskilt område misslyckas;
- visar Geoapify/OpenStreetMap-attribution i liveflödet.

Aktiva gruppställen separeras från kandidater och visas i den kollapsade
sektionen **Redan i gruppen**. Listan och kartan ska använda samma
deduplicerade resultatmodell.

Providerkök och inriktningar mappas genom den centrala `food-tags.ts`-taxonomin.
Okända råkategorier får inte bli en okontrollerad användartaxonomi.

Exempelgruppen anropar inte Geoapify vid runtime och länkar inte fiktiva ställen
till externa karttjänster.

## 13. Karta

MapLibre är kartlager för produktens interna kartor.

- `PlaceMap.tsx` äger den etablerade kartan för gruppens ställen.
- `MultiAreaPlaceMap.tsx` visar valda sökområden, gemensamma radiecirklar och
  deduplicerade sökträffar.
- Kartdata ska byggas från rena, testbara GeoJSON-hjälpare när det är praktiskt.
- Samma ställe får inte bli flera markörer efter deduplicering.
- Kategoriikoner och klustring ska fungera i Chromium och WebKit.
- CSS-temafärger måste konverteras till format som MapLibre accepterar.
- Kartändringar ska klassificeras av `scripts/repo-tools.mjs` så att
  tvärbrowsermatrisen körs.

Diagnostikrutter är interna verktyg och får inte behandlas som produktfunktioner.
De ska skyddas eller tas bort när deras behov upphör.

## 14. Gamification

Gamification är en ren härledd domän i
`src/lib/matrundan/gamification.ts`.

- Inget muterbart poängsaldo eller cachat badgeägande lagras.
- Endast faktiska deltagare får progression.
- Registrering, betyg, kommentarer, klick och administration ger ingen kredit.
- Återbesök räknas.
- Delade besök räknas endast när både gruppens och besökets inställning tillåter
  det.
- Kanoniska besök dedupliceras på `Visit.id` före progression, topplistor och
  milstolpar.
- Aktuella topplistor är privata och innehåller endast aktiva medlemmar.
- Oavgjort använder competition ranking, exempelvis `1, 1, 3`.

Nivågränser, badges och milstolpar definieras i domänkoden och skyddas av
enhetstester. De ska inte dupliceras som en separat muterbar datakälla.

## 15. Aktivitet och notiser

Aktivitet är en privat, användarorienterad historik över meningsfulla
händelser. Mutationer som redan skapar aktivitet ska göra det atomiskt på
servern.

Gamification skapar inte lagrade aktivitetsrader. Härledda nivåer och badges ska
inte skrivas till aktivitet bara för att göras persistenta.

Push-notiser köas via `notification_outbox` i samma databastransaktion som den
utlösande händelsen när möjligt. Utskick sker serverbaserat och användaren styr
prenumeration per enhet och notistyp.

Service workern hanterar notiser men ska inte införa generell asset-cache som
kan hålla kvar gamla appversioner. Notispayloads får inte läcka privata detaljer
från andra grupper.

## 16. UI och tillgänglighet

Gränssnittet är svenskt, varmt, enkelt och återhållsamt. Gruppens nästa stopp,
besök och historik prioriteras före statistik och gamification.

- Återanvänd befintliga shadcn/Radix-mönster.
- Undvik konkurrerande representationer av samma information.
- Primära handlingar ska vara tydliga; avancerade och destruktiva handlingar
  ska vara sekundära och bekräftas lämpligt.
- Bevara tangentbord och ARIA-semantik i dialoger, sheets, tabs, comboboxar och
  kollapsade sektioner.
- Interaktiva mål bör vara minst cirka 44 px.
- Långa svenska etiketter och namn ska radbrytas.
- Horisontell overflow är inte tillåten i huvudflöden vid 360 px.
- Sökområden visas som radbrytande valbrickor i sökningen och vertikala rader i
  gruppinställningarna.
- Mobil layout med tangentbord ska ta hänsyn till `visualViewport` eller
  dynamisk viewport så att sökfält och val inte döljs.

## 17. Versionering och dokumentation

Varje dokument har ett avgränsat ansvar:

- `README.md` – kort aktuell projektöversikt;
- `CHANGELOG.md` – släppta och ännu inte publicerade användarförändringar;
- `src/lib/matrundan/version.ts` – publicerad appversion och in-app-historik;
- detta dokument – varaktiga arkitektur- och säkerhetsbeslut;
- `DEVELOPMENT.md` – runtime, setup och kommandon;
- `docs/development-workflow.md` – process från diskussion till publicering;
- `docs/archive/` – historiska dokument som inte längre är kanoniska.

En publicerad release är ofullständig om appversion, in-app-historik,
changelog och faktisk deploymentstatus inte stämmer överens.

En mergad men ännu inte publicerad funktion ska ligga under **Unreleased** i
changelog och får inte beskrivas som publicerad appversion.

## 18. Verifiering

Normal iteration:

```bash
bun run doctor
bun run verify:changed
```

Ändrade UI-flöden:

```bash
bun run verify:agent
```

Releasekandidat:

```bash
bun run verify:full
```

Redo-CI kör mobil Chromium för UI-ändringar och WebKit/desktop Chromium för
kartrelaterade ändringar.

Utöver automatisk verifiering kräver ändringar:

- browserkontroll vid 360 px för berörda huvudflöden;
- kontroll att `scrollWidth <= clientWidth` för dokument och body;
- tangentbordstest för viewportkänsliga väljare;
- explicit granskning av migrationer, grants och gruppisolering;
- kontroll av exempel, demo och live när runtime-gränsen berörs;
- ärlig redovisning när autentiserat live-test eller verklig enhet saknas.

## 19. Arkitekturchecklista

Före merge av en arkitekturpåverkande ändring:

- Bevaras kanonisk plats- och besöksidentitet?
- Är varje read och write scoperad till rätt grupp?
- Kan en annan grupps namn, medlem, kommentar eller ursprung exponeras?
- Nekas tidigare medlemmar aktuell åtkomst?
- Förblir externa deltagare anonyma?
- Är hemligheter server-only?
- Är RPC-grants och `search_path` korrekta?
- Bevaras befintliga produktionsrader?
- Undviker den publika landningen privat gruppstate?
- Är exempelgruppen isolerad från live och intern demo?
- Återanvänds produktflöden mellan demo och live?
- Fungerar ändrade flöden vid 360 px utan overflow?
- Är relevant Chromium- och WebKit-verifiering aktiverad?
- Är changelog och kanonisk dokumentation uppdaterade?
- Är publicering separerad från merge och verifiering?
