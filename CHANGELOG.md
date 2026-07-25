# Changelog

Alla noterbara ändringar i Matrundan listas här. Formatet är inspirerat av
[Keep a Changelog](https://keepachangelog.com/sv/1.1.0/) och versionerna
följer [semantisk versionshantering](https://semver.org/lang/sv/).

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
