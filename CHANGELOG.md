# Changelog

Alla noterbara ändringar i Matrundan listas här. Formatet är inspirerat av
[Keep a Changelog](https://keepachangelog.com/sv/1.1.0/) och versionerna
följer [semantisk versionshantering](https://semver.org/lang/sv/).

Den fullständiga historiken till och med version 0.14.0 är bevarad i
[docs/archive/changelog-through-v0.14.md](./docs/archive/changelog-through-v0.14.md).

## [Unreleased]

### Lagt till

- En grupp kan spara upp till fem verifierade sökområden som tillsammans utgör
  den vanliga sökstarten.
- Sökradien 2 km finns nu tillsammans med 1, 3, 5, 10, 25 och 50 km.
- En tillfällig annan plats kan läggas till i en sökomgång utan att sparas i
  gruppinställningarna.
- Kartan visar flera valda sökcentrum och en gemensam radie runt varje område.

### Ändrat

- Alla gruppens sparade sökområden är valda när sökningen öppnas. Det finns
  inget primärt område och samma radie gäller för samtliga valda centrum.
- Sökresultat från flera områden slås ihop, dedupliceras och sorteras efter
  kortaste avståndet till ett valt område.
- Nya och tidigare borttagna ställen visas tillsammans under **Ställen att
  lägga till** med samma **Lägg till**-flöde.
- Aktiva ställen som redan finns i gruppen samlas i den stängda sektionen
  **Redan i gruppen** i stället för att skapa brus bland kandidaterna.
- Sökområden visas som radbrytande valbrickor i sökdialogen och som vertikala
  rader i gruppinställningarna.

### Teknik och säkerhet

- `group_search_areas` lagrar verifierade gruppområden och
  `groups.default_search_radius_km` lagrar den gemensamma standardradien.
- Befintliga verifierade områden migreras utan att äldre produktionsrader tas
  bort. Skrivningar går atomiskt genom rollvaliderade RPC:er.
- `get_group_app_state_v5e` utökar den gruppscopade read-modelen med sökområden
  och standardradie utan att återöppna direkt tabellåtkomst.
- Flerområdessökningen hanterar delvisa providerfel och returnerar högst 50
  unika resultat.
- Flödet är regressionsskyddat vid 360 px och kartan verifieras i Chromium och
  WebKit.

## [1.5.0] – 2026-07-30

### Lagt till

- När du lägger till ett ställe från Geoapify får du frågan om att dela dina
  tidigare besök på samma ställe från andra grupper till den aktuella gruppen.
- Registreringsdialogen visar nu vilka av dina andra grupper som redan har
  stället. Du kan välja alla eller rensa valet med ett klick.

### Ändrat

- Delningsförvalen i registreringsdialogen är smartare: bara grupper där
  stället redan finns är ikryssade från början.
- Tidigare egna besök börjar helt ovalda och erbjuds bara när stället har
  identifierats säkert via Geoapify. Redan delade besök erbjuds inte igen.
- Tydligare progressionscopy på Hem, i statusbadgen och på matställessidan:
  ett ställe räknas som provat så fort någon i gänget varit där.

### Säkerhet

- Arkiverade grupper kan inte ta emot delade besök. Om matstället tidigare
  tagits bort från målgruppens lista återaktiveras det när besöket delas.

## [1.4.0] – 2026-07-30

### Lagt till

- Registreringsdialogen har ett avsnitt "Dela med dina andra grupper" där alla
  dina andra aktiva grupper är förvalda. Besöket sparas kanoniskt en gång och
  delas till valda grupper via det befintliga säkra delningsflödet.
- Egen kommentar delas fortfarande bara efter aktivt val.

## [1.3.1] – 2026-07-30

### Ändrat

- Hem visar "Senast tillsammans" med gruppens senaste besök, deltagare och
  kommentar, så startsidan känns som en gemensam matresa.
- Progressionstexten är omskriven ("Ni har provat X av Y ställen tillsammans")
  med en varm hjälptext när listan nästan eller helt är avklarad.
- Topplistan på Matställen är ihopfälld som standard så gruppens egen lista
  syns tidigare i vyn.
- Varmare svensk copy i tomma tillstånd på Hem, Matställen och
  matställessidan.
- Landningssidans exempelgrupp beskrivs korrekt som ett kompisgäng i Göteborg.

### Fixat

- Knappraden "Nästa stopp"/"Favorit" och långa adresser bryter nu snyggt på
  360 px i stället för att trunkeras.
- Den dubblerade "Registrera besök"-knappen i tomma besökslistan är borttagen.

## [1.3.0] – 2026-07-30

### Tillagt

- Ett avfärdbart kort högst upp på Hem föreslår att slå på notiser för
  inloggade medlemmar som inte redan har en prenumeration på enheten.
- Stöd för installation på hemskärmen: knapp via webbläsarens
  installationshändelse på Android och skrivbord, och en kort Safari-instruktion
  på iPhone och iPad.
- Avsnittet "Appen på mobilen" i Min profil för installation i efterhand.

## [1.2.0] – 2026-07-30

### Tillagt

- Push-notiser för gruppens händelser: nytt registrerat besök, nytt valt nästa
  stopp eller föreslaget datum, när du läggs till som deltagare på ett besök och
  när en ny medlem går med i gruppen.
- Notisinställningar under Min profil: notiser slås på per enhet, och varje
  notistyp kan väljas till eller från. Registrerade enheter kan tas bort.
- Matrundan kan läggas till på hemskärmen via ett webbappsmanifest med ikoner.
  Det krävs för att notiser ska fungera på iPhone och iPad.

### Teknik

- Notiser köas av databasen i `notification_outbox` via triggrar på `activity`
  och `visit_participants`, så köläggningen sker i samma transaktion som
  skrivningen. Utskicket sker serverbaserat med Web Push (VAPID, `aes128gcm`)
  och plockas upp direkt efter händelsen samt av ett schemalagt skyddsnät.
- Service workern hanterar enbart notiser och cachar ingenting, så inga gamla
  filer kan bli kvar hos användaren.

## [1.1.2] – 2026-07-30

### Ändrat

- Ett lösenord som avvisas för att det är för kort eller för lätt att gissa ger
  nu ett tydligt besked i stället för ett generiskt felmeddelande.
- Registreringsformuläret visar lösenordskraven innan formuläret skickas.

## [1.1.1] – 2026-07-30

### Ändrat

- Nya konton bekräftas automatiskt vid registrering, så inget verifieringsmejl
  behöver inväntas innan första inloggningen.
- Registrering med en e-postadress som redan har ett konto ger nu ett tydligt
  besked och växlar till inloggningsvyn i stället för att se ut att lyckas.
- Återställning av lösenord upplyser om att mejlet kan hamna i skräpposten.

## [1.1.0] – 2026-07-30

### Nytt

- Konto kan skapas och användas med e-postadress och lösenord vid sidan av
  Google-inloggningen.
- Glömt lösenord skickar en återställningslänk till sidan `/nytt-losenord`,
  så att kontot och historiken behålls.

### Förbättrat

- Nya lösenord kontrolleras mot kända läckor vid registrering och byte.
- Inloggning med ett annat konto rensar tidigare session, gruppval och
  exempel-läge innan den nya sessionen skapas.

### Borttaget

- Inloggning med sexsiffrig e-postkod, som kräver en egen avsändardomän.

## [1.0.0] – 2026-07-29

### Nytt

- En publik integritetssida beskriver appens datahantering, leverantörer,
  lagring och självbetjänade kontoradering.
- Kontot kan raderas från profilen. Ägarskap överförs innan radering och
  ensamgrupper kräver en extra uttrycklig bekräftelse.

### Förbättrat

- Landningssidan prioriterar inloggning till befintliga grupper och privata
  inbjudningar.
- **Om Matrundan** presenterar syftet och appens tre huvudsteg på ett
  användarvänligt sätt.
- Fredagsgängets matställen, adresser, medlemmar och historik är helt fiktiva.
- Arkivering och återaktivering finns i **Gruppinställningar**.

### Integritet och säkerhet

- Kontoborttagning tar bort namn, profilbild, kommentarer, favoriter,
  planeringssvar och uppladdade bilder.
- Numeriska betyg och deltagande i genomförda besök bevaras anonymt som
  **Tidigare medlem** för att övriga gruppmedlemmars historik ska förbli
  sammanhängande.
- Kontoraderingen använder autentiserade, låsta `SECURITY DEFINER`-RPC:er.
  Service-role-nyckeln används endast i serverkod för bild- och auth-radering.

## [0.20.0] – 2026-07-29

### Nytt

- Registreraren, gruppens ägare eller admin kan radera ett felaktigt
  originalbesök från besöksdetaljen.
- Förslagsställaren, ägare eller admin kan ändra ett föreslaget eller bekräftat
  datum utan att radera förslaget och börja om.

### Förbättrat

- Datumändring nollställer tidigare svar och öppnar ett bekräftat datum igen så
  att gruppen kan svara på nytt.
- Besökshistoriken visas före **Om stället** och detaljerade betyg på
  matställets detaljsida.
- **Lägg till ställe** behåller sökning och utforskning som standard, manuell
  inmatning som sekundärt val och möjligheten att lägga till flera ställen i
  samma omgång.

### Säkerhet

- Originalbesök raderas genom en gruppvaliderad RPC som även tar bort omdömen,
  deltagarkopplingar, delningar och aktivitet. Privat foto städas via den
  befintliga skyddade lagringsvägen.
- Radering och datumändring kräver aktivt medlemskap, rätt roll eller
  ägarskap över handlingen och låsta `SECURITY DEFINER`-funktioner.

## [0.19.1] – 2026-07-29

### Förbättrat

- Hem visar **Ni har provat 6 av 9 ställen** och progressbaren utan ett
  redundant procenttal.
- När användaren söker döljs topplistan, så sökfältet leder direkt till den
  filtrerade listan.
- **Passar för** förklaras med konkreta sorters besök utan det abstrakta
  samlingsordet ”sammanhang”.
- Det frivilliga **Passar också för** öppnas genom en uttrycklig handling i
  stället för att en ny rad dyker upp automatiskt.

### Rättat

- Progressionsraden på Hem klistrar inte längre ihop text och procenttal på
  smala skärmar.
- Det överflödiga valet **Inget andra sammanhang** är borttaget.

## [0.19.0] – 2026-07-29

### Nytt

- Topplistan kan växla mellan **Snabbt & smidigt**, **Vardag & häng** och
  **Något särskilt**.
- Ett ställe rankas endast i sitt primära sammanhang och ordnas efter gruppens
  synliga medelbetyg.

### Förbättrat

- Varje ställe får ett obligatoriskt **Passar bäst för** och högst ett frivilligt
  **Passar också för**.
- Sammanhangen beskriver situationen, inte objektiv kvalitet, prisnivå eller
  ambitionsnivå.
- Befintliga sparade val tolkas i sin nuvarande ordning som primärt och
  sekundärt. Inga produktionsrader skrivs om automatiskt.

### Rättat

- Den fria flervalsmodellen från 0.18.0 har ersatts med den beslutade
  klassificeringen innan topplistorna byggdes vidare.

## [0.18.0] – 2026-07-29

### Förbättrat

- **Tydligare sammanhang.** **Passar för** använder nu **Snabbt & enkelt**,
  **Vardag & häng** samt **Middag & upplevelse**. Kategorierna beskriver vilken
  typ av besök stället passar för – inte dess absoluta kvalitet.
- En mobilvänlig förklaring ger exempel för varje kategori och tydliggör att ett
  ställe kan passa i flera sammanhang.
- Nya ställen får inte längre en kategori automatiskt. Minst ett sammanhang
  måste väljas aktivt innan stället kan läggas till.
- Samma kategorier och hjälp används vid tillägg, administration, filtrering och
  på matställets detaljsida. Befintliga ställens sparade val bevaras.

### Rättat

- Kategoriväljaren och förklaringen verifieras vid 360 px utan horisontell
  overflow.

## [0.17.0] – 2026-07-29

### Förbättrat

- **Kompakt datumplanering.** Hem visar datum och aktuell svarssammanfattning på
  en lugn rad. Svarsalternativ, namn och hantering öppnas i den separata vyn
  **Planera nästa stopp**.
- Bekräftade datum visas utan en tung svarssammanställning på Hem.
- **Aktivt helhetsbetyg.** Besöksregistreringen börjar utan förvalt betyg och
  kan inte sparas förrän användaren själv har valt 1–5.
- Besöksdialogen har en enda primär sparaknapp. För användare med flera grupper
  erbjuds **Lägg till i annan grupp** först efter att besöket har sparats.

### Rättat

- Datumplaneringen och besöksdialogen verifieras vid 360 px utan horisontell
  overflow.

## [0.16.1] – 2026-07-29

### Förbättrat

- **Tydligare Google Maps.** Adressen är åter vanlig information och kompletteras
  av den tydliga länken **Öppna i Google Maps**.
- **Bättre placerad administration.** **Hantera ställe** ligger nu diskret intill
  **Om stället** i stället för ensam längst ned i huvudkortet.

## [0.16.0] – 2026-07-29

### Förbättrat

- **Tydligare ansvar för huvudvyerna.** Hem fokuserar på nästa stopp och
  progression. Gruppen äger aktivitet och visar inte längre nästa stopp en gång
  till.
- **Tydligare Matställen.** Sidan förklarar att listan innehåller vad gänget vill
  prova och har provat, sökningen kommer före topplistan och handlingen heter
  konsekvent **Lägg till ställe**.
- **Tydligare handlingar på matställets detaljsida.** Nästa stopp skiljer på
  handling och status, personlig favorit heter **Favorit** och Maps nås via
  adressen i stället för en likvärdig åtgärdsknapp.
- Flaggan ersätter glittersymbolen för nästa stopp.
- Medlemsraderna på Gruppen har färre överflödiga etiketter.

### Rättat

- Huvudvyerna och matställets detaljsida har ett riktat mobiltest som verifierar
  informationsplacering, copy och avsaknad av horisontell overflow vid 360 px.

## [0.15.0] – 2026-07-28

### Nytt

- **Datumförslag för nästa stopp.** En aktiv gruppmedlem kan föreslå en dag och
  en valfri tid direkt på kortet för gruppens aktuella nästa stopp.
- Varje aktiv medlem kan svara **Passar**, **Passar inte** eller **Osäker** och
  ändra sitt svar så länge förslaget är öppet.
- Gruppen ser både antal och namn för de aktuella svaren.

### Förbättrat

- Förslagsställaren, gruppens ägare eller admin kan bekräfta eller ta bort
  datumet. Det sker ingen automatisk bekräftelse utifrån majoritet.
- Ett öppet eller bekräftat datumförslag stängs automatiskt när nästa stopp
  byts, tas bort från gruppen eller registreras som besökt.
- Datumförslag och svar är privata för gruppen. Direkt tabellåtkomst är
  återkallad och skrivningar går genom medlems- och rollvaliderade
  `SECURITY DEFINER`-RPC:er.
- Läsmodellen räknar endast svar från aktiva medlemmar.
- Fredagsgänget använder samma gränssnitt och sparar planeringen tillfälligt i
  den lokala webbläsarsessionen utan live-skrivningar.

### Rättat

- 360 px-regressionen verifierar att gruppen kan föreslå, svara, bekräfta,
  ladda om och ta bort datumet utan horisontell overflow.
