# Changelog

Alla noterbara ändringar i Matrundan listas här. Formatet är inspirerat av
[Keep a Changelog](https://keepachangelog.com/sv/1.1.0/) och versionerna
följer [semantisk versionshantering](https://semver.org/lang/sv/).

## [0.9.0] – 2026-07-25

### Nytt
- **Privat, gruppcentrerad gamification (Paket 3D).** Nivåer, badges och
  topplistor är helt härledda från gruppens besök, deltagare, kanoniska
  platser och gruppinställningar. Inga poängsaldon eller nya
  activity-typer lagras.
- **Nivåserie:** 0 Nyfiken, 1 Provsmakaren, 4 Krogspanaren,
  10 Matupptäckaren, 20 Smakjägaren, 40 Matkonnässören,
  75 Matrundemästaren. Progressionsstapel visas bara på egen profil.
- **Fem badges:** Första rundan, Världsvan (5 unika kökstyper efter
  normalisering), Brett register (4 unika `places.category`), Stammis
  (3:e progression-räknade besöket på samma kanoniska plats) och
  Fullträff (ett `manual`/`provider`-ställe man föreslagit besöktes med
  minst en annan gruppmedlem, `linkType='original'`).
- **Privata topplistor på Gruppen-sidan** (sektionen ”Gruppens höjdpunkter”):
  Deltagna besök, Nya ställen och Köksbredd, i två perioder
  (I år / Totalt), med competition-ranking (1, 1, 3). Sektionen visas
  alltid med en lugn tomstatus i nya grupper.
- **Gemensamma milstolpar:** 10/25/50/100 besökta ställen, årsdagar och
  ”Första besöket med hela gänget” (aktiva medlemmar som referensmängd,
  se README).

### Domänmodell
- **Delade besök respekteras överallt:** gruppinställningen
  `sharedVisitsCountForProgression` styr både nivåer, badges och
  topplistor via `countsForProgression`.
- **Defensiv deduplicering** på `Visit.id` innan all progressions-,
  topplista- och milstolpsberäkning. En oväntad dubblettpost räknas
  aldrig två gånger.
- `live-repository` normaliserar `group_places.origin='shared_visit'`
  (och okända värden) till `Place.origin='shared'` så att Fullträff inte
  utlöses för importerade eller delade platser.

### UI
- Medlemslistan visar ”{Nivå} · {N} besök” som underrad; senaste besök
  som diskret tredje rad; högerkolumnen visar bara favoritantal.
- MemberProfileSheet: badgekort bryter beskrivningar och intjänandedatum
  på flera rader utan horisontell overflow.
- Höjdpunktssektionen ligger efter Gänget och håller 360 px utan
  horisontell scroll även med alla kategori-/periodknappar.

## [0.8.1] – 2026-07-25

### Nytt
- **Ny återanvändbar Plats-komponent** (`GeoapifyLocationInput`) med
  Geoapify-autocomplete. Endast verifierade val (label + koordinater +
  provider + place_id) sparas som gruppens förvalda sökområde.
- **Gruppinställningen ”Förvalt sökområde”** ersätter fritext-”Hemområde”
  och används automatiskt som sökcentrum i Lägg till matställe.

### Förbättrat
- Alla dialoger klarar 360 px utan horisontell scroll (`w-[calc(100vw-1rem)]`).
- Standardsökradien i Lägg till matställe startar på 1 km för mer relevanta
  träffar.
- Resultatkort staplar innehåll och knapp på mobil – ingen text kapas.
- Äldre fritext-hemområden visas som ”obekräftade” tills ägaren väljer ett
  nytt verifierat område. Sparning påverkar dem inte automatiskt.
- I live-läge gissar Lägg till matställe aldrig koordinater från fritext –
  ett val från listan krävs.

### Säkerhet
- DB-check på `groups` tillåter bara tre tillstånd för sökområdet: tomt,
  legacy-label eller komplett verifierat Geoapify-val med giltiga koordinater.
- `create_group_with_owner` kräver antingen alla eller inga
  home-parametrar och validerar leverantör + koordinatintervall.
- `create_group_with_owner`, `update_group_settings` och
  `get_group_app_state` har `EXECUTE` återkallat från `PUBLIC`/`anon`;
  endast `authenticated` kan anropa dem.

## [0.8.0] – 2026-07-25

### Nytt
- **Riktig platssök via Geoapify i live-läget.** Autentiserad serveradapter
  (`geoapifyAutocompleteLocation`, `geoapifySearchPlaces`) läser
  `GEOAPIFY_API_KEY` enbart på servern – nyckeln finns aldrig i klientbundeln.
- **Bekräftelsesteg** innan ett sökresultat läggs till: användaren väljer
  Passar för och kan skriva en anteckning till gruppen. Inget sparas direkt
  från resultatlistan.
- **Autocomplete för Plats-fältet** med tangentbordsstöd (piltangenter, Enter,
  Escape), ARIA-combobox och stabil dropdown som även visar “Inga träffar”
  när sökningen är klar utan resultat.
- **Race-skyddad sökeffekt** via inkrementell request-id – bara det senaste
  svaret uppdaterar resultatlistan. Försök igen bumpar en retry-nonce så
  effekten verkligen körs om (platsupplösning + matställessökning) och
  visar loading tills svaret kommer.
- **Dubblettskydd** via unikt index på `(provider, provider_place_id)` och
  atomär RPC `create_or_link_provider_place`.

### Förbättrat
- Avgränsade sökradier 1/3/5/10/25 km samt “Större område · inom 50 km”.
  Servervalidatorn accepterar `1|3|5|10|25|null` – 50 skickas som `null`
  och tolkas som en 50 km-cirkel runt centrum. Inga påståenden om
  rikstäckning kvar i UI:t.
- Kartprototypen är borttagen från sökflödet – enhetlig listvy även på
  360 px, 44 px träffytor, tydliga felmeddelanden med “Försök igen” och
  “Lägg till manuellt”.
- Fokus återgår till det “Lägg till”-alternativ som öppnade bekräftelsen
  när användaren backar tillbaka. Val av autocomplete-förslag stänger inte
  dialogen.
- Tydlig attribution: “Platsdata från Geoapify och © OpenStreetMap-bidragsgivare.”
- Demo-läget är oförändrat och fortsätter använda den lokala provider-datan.

## [0.7.1] – 2026-07-25

### Rättat
- Registrering av besök fungerar igen efter kanonisk migration:
  `validate_visit_participant()` slår upp originalgruppen via
  `visit_group_links` (`link_type='original'`) istället för den borttagna
  kolumnen `visits.group_id`, och kräver aktivt medlemskap i den gruppen.
- Städade bort en dubblerad valideringstrigger (`trg_activity_validate_refs`)
  på `activity`; kvar finns endast `trg_activity_validate`.

### Nytt
- **Spara och lägg till i annan grupp:** ny sekundär knapp i
  `VisitDialog` (live-läget, ≥2 aktiva grupper). Besöket sparas en gång i
  aktuell grupp; därefter öppnas befintliga `ShareVisitDialog` med det
  kanoniska visit-id:t, som använder de säkra delnings-RPC:erna.

## [0.7.0] – 2026-07-25


### Nytt
- **Dela besök mellan grupper utan duplicering.** Ny kanonisk datamodell:
  `places` (globala matställen), `group_places` (grupprelation),
  `visits` (globala besök), `visit_group_links` (kopplingar per grupp,
  `original` eller `shared`) och `review_group_visibility`
  (per-grupp-synlighet av rating/kommentar).
- **`share_visit_to_group`** kopplar in matstället i målgruppen om det
  saknas, skapar en `shared` länk och sätter synlighet för de recensioner
  vars författare är medlemmar i målgruppen (rating synligt, kommentar
  dolt som default; egen kommentar kan följa med via en checkbox).
- **`remove_shared_visit_from_group`** tar bort en shared-koppling utan
  att röra canonical visit/place, deltagare eller recensioner.
- **`set_review_group_visibility`** låter recensionens författare styra
  synligheten av rating/kommentar per grupp.
- **`list_visit_share_targets`** returnerar bara användarens aktiva
  grupper med synliga deltagares namn, `+N` för externa och antal
  relevanta betyg – aldrig andra gruppers namn eller `source_group_id`.
- **Gruppinställning:** "Räkna delade besök i progression" (av/på) via
  `update_group_settings`.
- **`get_group_app_state`** returnerar `linkType`, `linkedBy`, `linkedAt`,
  `externalParticipantCount`, `countsForProgression` per besök, plus
  reviews med `id`, `userId`, `ratingVisible`, `commentVisible` för
  synlighetskontrollen.

### Säkerhet
- `authenticated` har inga direkta rättigheter på `visits`,
  `visit_participants`, `reviews`, `group_places`, `visit_group_links`
  eller `review_group_visibility`. All läsning går via
  `get_group_app_state`; skrivningar går via SECURITY DEFINER-RPC:er med
  låst `search_path`. `anon` kan inte EXECUTE någon av RPC:erna.
- `source_group_id` finns i databasen men lämnar aldrig servern.
- Aggregat (snitt, detaljbetyg) räknas bara på recensioner som är
  synliga i gruppen; externa deltagare räknas anonymt.
- Unikt index säkrar exakt en `original`-koppling per besök.

### Förbättrat
- `VisitDetailSheet` har delnings- och unlink-åtgärder, badge för delat
  besök, neutral `+N`-visning och en switch för att dölja/visa egen
  kommentar per grupp.
- Live-mutationer utanför `StoreProvider` (delning, unlink, synlighet,
  progression-inställning) triggar en global `matrundan:reload` som
  laddar om gruppens tillstånd utan sidladdning.

## [0.6.1] – 2026-07-25

### Fixat
- Mobil layout: globala skydd mot horisontell overflow (`overflow-x: clip`,
  `text-size-adjust: 100%`, `max-width: 100%` på media) samt kompaktare
  grupphero och medlemsrader så att långa namn trunceras och badges wrappar
  utan att kort tvingas bredare än viewport.
- Utloggning lämnade tidigare gruppens live-state kvar i store: `StoreProvider`
  remountas nu deterministiskt via `key` när läget växlar mellan
  `demo` / `live:<groupId>`. `signOut` rensar även `userGroups`, aktiv grupp
  och navigerar tillbaka till `/`.

### Auth-konfiguration
- Google är aktiverad som managed OAuth-provider i Lovable Cloud för detta
  projekt. Om inloggning ändå visar Lovables egen inloggning beror det på att
  förhandsvisnings-URL:en (`id-preview--…lovable.app`) kräver Lovable-session –
  publicera appen eller använd published/custom domain för att testa slutanvändar-flödet.

## [0.6.0] – 2026-07-25



### Nytt
- Riktiga engångsinbjudningar: `create_group_invitation` genererar en 256-bitars
  token; endast SHA-256-hash lagras. Länken visas bara en gång.
- `/inbjudan/$token`-route med förhandsvisning (`get_invitation_preview`) och
  tillstånd för giltig, utgången, återkallad, redan använd och e-postmatchning.
- `accept_group_invitation` – idempotent, återaktiverar historiska medlemskap,
  matchar e-postbundna länkar mot inloggat konto och skapar en member-joined-post.
- Egen profil: `update_profile`-RPC med validering, valfri `avatar_emoji`.
- Gruppadministration via RPC: `update_group_settings`, `set_member_role`,
  `remove_group_member`, `leave_group`, `transfer_group_ownership`.
- Skapa ytterligare grupp direkt från kontomenyn.

### Förbättrat
- Historiska medlemskap: `memberships.status` + `left_at`; bara aktiva medlemmar
  får åtkomst via `has_membership`/`has_group_role`/`shares_group`.
- Direktskrivning mot `memberships` och `invitations` från klienten är stängd;
  allt går via RPC:er med `REVOKE EXECUTE FROM PUBLIC, anon`.
- Ägar-skyddet (`protect_owner_membership`) tillåter atomisk ägaröverföring via
  en sessions-flagga men blockerar fortfarande klientdirektskrivningar.
- Aktuell ägare härleds från medlemsraden; `groups.created_by` betyder alltid
  ursprunglig skapare.
- Matrundan skickar inte e-post själv; ”Öppna e-post” fyller i en mailto med
  färdig svensk text.

### Säkerhet
- `invitations`-tabellen är inte längre direkt läsbar från klienten;
  `token_hash` kan inte längre exponeras. Inbjudningar hämtas endast via
  `list_group_invitations`/`get_invitation_preview`.
- Direkta INSERT/UPDATE/DELETE på `memberships` och `profiles` är återkallade
  för inloggade användare; all administration går via RPC:erna.
- Databasgaranti: exakt en aktiv ägare per grupp (`memberships_one_active_owner_per_group`).
- `shares_group` kräver att viewern är aktiv medlem men matchar target även
  om target lämnat gruppen – så tidigare medlemmars namn/avatar kan visas
  diskret i historisk data utan att ge dem åtkomst tillbaka.

### Känt
- Delade besök mellan grupper, Geoapify och gamification är fortfarande utanför scope.
- Gruppborttagning ingår inte i detta paket.

## [0.5.0] – 2026-07-25

### Nytt
- Lägg till matställe direkt mot Supabase i live-läge via ny
  `create_place`-RPC (med dubblettskydd på namn + adress per grupp).
- Registrera besök atomärt via `create_visit_with_review`-RPC: besök,
  deltagare, författarens omdöme, aktivitetspost och automatisk rensning
  av gruppens ”nästa stopp” sker i samma transaktion.
- Favoritmarkera matställen via `toggle_favorite`-RPC.
- Sätt, byt och rensa gruppens nästa stopp via `set_next_place`-RPC.
- Aktivitetsflödet uppdateras automatiskt av RPC:erna – klienten skapar
  inte längre aktivitetsposter direkt (INSERT på `activity` är
  återkallad från `authenticated`).

### Förbättrat
- Alla skrivningar går genom SECURITY DEFINER-funktioner som validerar
  gruppmedlemskap, kategorier, tillfälle och betygsintervall på servern.
- Vy och store laddas om automatiskt efter en lyckad live-mutation utan
  sidladdning.
- Tydliga laddnings- och feltillstånd på ”Lägg till matställe” och
  ”Spara besök”, med disable av CTA:er under pågående skrivning.
- Repository-lagret är utökat med `live-mutations.ts` som håller RPC-anrop
  åtskilda från läslogiken i `live-repository.ts`.

### Känt
- Inbjudningar av nya medlemmar och profilredigering landar i Supabase
  först i ett senare paket.
- Geoapify/OSM-platssökning och gamification är fortfarande inte med.

## [0.4.0] – 2026-07-25

### Nytt
- Google-inloggning via Lovable Cloud (Supabase Auth) med hanterad
  OAuth-broker – ingen egen Google Cloud-konfiguration behövs.
- Nytt Supabase-schema för profiles, groups, memberships, invitations,
  places, place_sources, visits, visit_participants, reviews, favorites,
  group_next_place och activity, härdat med RLS så att bara gruppmedlemmar
  når gruppdata.
- Onboarding för första gruppen (namn, emoji, valfritt hemområde) via
  `create_group_with_owner`-RPC.
- Live-läge som läser gruppens matställen, besök, deltagare, omdömen,
  favoriter, aktivitet och ”nästa stopp” från Supabase; demo-läget finns
  kvar oförändrat.
- Gruppväxlare i headern när man är med i flera grupper.

### Förbättrat
- Repository-lager (`live-repository.ts`) separerar demo- och live-källa så
  att vykomponenterna är oförändrade.
- Explicit sandlåde-läge via `?demo=1` i URL:en, oberoende av inloggning.
- Databashärdning: ägar-medlemskap kan inte demoteras eller raderas via
  klienten, cross-group-inkonsistens blockeras med composite foreign keys
  och triggers, identitetsfält (`group_id`, skapare, författare) är
  immutabla efter insert, och `anon`-rollen har ingen åtkomst till
  gruppens tabeller.

## [0.3.0] – 2026-07-24

### Nytt
- Klickbara medlemsprofiler med besök, favoriter, smakprofil och
  medlemsspecifikt aktivitetsflöde.
- Geografisk sökning i utforskningen med gemensamt platsfält, valbar
  sökradie och en tydligt märkt kartprototyp.
- Navigerbart aktivitetsflöde: aktiviteter öppnar rätt matställe, besök
  eller medlemsprofil.
- Djuplänkade besök – aktivitetens ”registrerade besök” och besökskort på
  matställets sida öppnar samma besöksdetalj.
- Vyn ”Om Matrundan” med aktuellt versionsnummer, kort sammanfattning och
  fullständig versionshistorik.

### Förbättrat
- Tydligare informationshierarki för betyg: gruppens helhetsbetyg lyfts
  fram med snitt och antal betyg, medan smak, prisvärdhet och service
  samlas under ”Betygsdetaljer”.
- ”Nästa stopp”-kortet på hemfliken är nu en tillgänglig länk till
  matställets detaljsida, medan ”Registrera besök” förblir en separat
  primär handling.
- Rena URL:er: när en profil eller ett besök stängs försvinner tillhörande
  query-parameter helt.
- Svensk talformatering med decimalkomma används konsekvent för betyg.
- ”Passar för” har en gemensam kort hjälptext i stället för tooltips per
  kategori.

## [0.2.0] – 2026-07-23

### Nytt
- Registrering av besök med deltagare, tillfälle och valfria detaljbetyg.
- Gruppvyn med gänget, delade favoriter och aktivitet.
- Filter och sortering av matställeslistan bakom en tydlig filterpanel.

### Förbättrat
- Responsiva layouter: bottennavigation på mobil, topmeny på desktop.
- Tillgänglighet: aria-pressed på val, större träffytor och tydligare fokus.

## [0.1.0] – 2026-07-23

### Nytt
- Första Lovable-prototypen av Matrundan.
- Lokal demodata i `localStorage`.
- Grundläggande provider-arkitektur för framtida platssökning.