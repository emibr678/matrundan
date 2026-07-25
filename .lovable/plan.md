# Paket 3D – Privat gruppgamification (v0.9.0)

Diskret, gruppcentrerad progression, badges och höjdpunkter. Härleds fullt ut ur befintlig read-model. Ingen global rankning, ingen belöning för admin/klick.

## 1. Produktbeslut

### Nivåer (per grupp, per aktiv medlem)

Nivågrunden är **antal besök där medlemmen är listad som `participant`** i gruppens vy och besöket räknas mot progression (original, eller shared med `countsForProgression=true`). Återbesök räknas. Registreraren får ingen extra kredit utöver deltagande.

Föreslagna trösklar (behåll de föreslagna – ger ~1,5–4 år ambitiös resa vid 1–4 besök/månad):

| Nivå | Trösklad | Namn |
|---|---|---|
| 0 | 0 | Nyfiken |
| 1 | 1 | Provsmakaren |
| 2 | 4 | Krogspanaren |
| 3 | 10 | Matupptäckaren |
| 4 | 20 | Smakjägaren |
| 5 | 40 | Matkonnässören |
| 6 | 75 | Matrundemästaren |

Kommentar: 75 nås på ~19 månader vid 4/mån och ~6 år vid 1/mån. Rimligt. Behålls.

### Badges (per grupp, per medlem)

Alla är idempotenta och deterministiskt härledda. Datumet är tidpunkten för den utlösande händelsen.

1. **Första rundan** – första besöket där medlemmen deltog i gruppen.
2. **Världsvan** – summan av *unika kökstyper* över medlemmens deltagna besök når 5. Kökstyp = `places.cuisines[]`; ett besök på ett ställe med flera cuisines bidrar med alla.
3. **Smakspektrat** (nytt namn istället för "Allätaren") – deltagna besök täcker minst 4 olika värden i unionen av `places.category` ∪ `places.occasions`. Undviker kosthållnings-tolkning.
4. **Stammis** – medlemmen deltar i sitt tredje besök på *samma canonical place* (räknat inom gruppens synliga besök).
5. **Fullträff** – ett ställe där medlemmen är `added_by` på gruppens `group_places`-rad blir senare besökt (original-visit i denna grupp) av minst en annan medlem än förslagsställaren. Delade importer räknas inte. Datumet = det första kvalificerande besöket.

**Full gruppnärvaro** blir en *grupphöjdpunkt* (aktivitetsevent), inte personlig badge.

### Topplistor och höjdpunkter (privat i gruppen)

Sektion **"Gruppens höjdpunkter"** på `/gruppen`, diskret placerad efter Medlemmar. Innehåller:

- **Kompakt topplista**, växlare `I år` / `Totalt`, tre kategorier via segmenterad kontroll:
  - `Deltagna besök` (progression-räknade)
  - `Nya matställen` (unika canonical places medlemmen deltog i första gången i gruppen inom perioden)
  - `Köksbredd` (antal unika cuisines från deltagna besök inom perioden)
- Visar topp 3 aktiva medlemmar + "din placering" om användaren är utanför topp 3. Ties: samma placering, alfabetisk sekundärsortering, ingen medaljhierarki – visa siffra "1." delad. Ingen pallgrafik.
- Tidigare medlemmar (`status='left'`) är exkluderade från topplistan men deras historiska besök räknas fortfarande för aggregat/badges på deras profil.
- **Grupphöjdpunkter** (auto-genererade milstolpar, visas som chip-lista): 10/25/50/100 unika ställen, första besök med full aktiv grupp, årsdag av gruppen, första besöket i ny kategori.

Uttryckligen **inga** kategorier för: antal betyg, antal kommentarer, antal tillagda ställen, favoriter satta, next-picks – för att inte belöna admin/spam.

### UX-placering

- **Hem**: oförändrad. Ingen nivå/badge.
- **Matställen**: oförändrad. Ingen nivå.
- **Gruppen**:
  - Medlemslistan får en kompakt underrad: nivånamn + " · N besök" (ingen "Lv X", inga badge-ikoner).
  - Ny sektion "Gruppens höjdpunkter" (topplista + milstolpar).
- **MemberProfileSheet**: ny topp-block med nivånamn, deltagna besök, unika matställen, köksbredd, badges (emoji + namn). Progressionsstapel mot nästa nivå visas **endast för den egna profilen** (integritetsval).
- **Aktivitet**: nya `activity.kind`-värden för `level-up`, `badge-earned`, `group-milestone` – renderas via befintlig `ActivityRow` med lämplig ikon.

## 2. Exakta regler och edge cases

- **Deltagande = kredit**: kredit ges baserat på `visit_participants`-raden i den kanoniska besöket, filtrerat via gruppens `visit_group_links` + `countsForProgression`. `created_by` utan deltagande ger 0 kredit.
- **Shared-toggle**: `groups.shared_visits_count_for_progression = false` → shared-länkar räknas ej. Original räknas alltid. Toggling räknar om nivåer/badges deterministiskt vid nästa läsning.
- **Radering/borttagning**: om en link tas bort (`remove_shared_visit_from_group`) faller kredit och badge-trigger bort automatiskt. Nivå kan sjunka.
- **Deduplikation**: unikt per `(group_id, canonical visit_id, user_id)` – aldrig dubbelräknat även om samma canonical link förekommer via original + shared (kan inte enligt current constraint, men beräkningen tar `DISTINCT`).
- **Tidigare medlemmar** (`status='left'`):
  - Behåller sina historiska badges och nivå (visas i historik).
  - Exkluderas från nuvarande topplistor.
  - Räknas *inte* som deltagare i "full aktiv grupp"-milstolpen.
- **Fullträff attribution**: förslagsställare = `group_places.added_by` i denna grupp. Om `origin='shared'` från annan grupp får personen ingen fullträff där. Endast första kvalificerande besöket triggar; besök där enda deltagaren är förslagsställaren själv räknas inte.
- **Stammis**: räknat på canonical `place_id` med besök synliga i gruppen (original + räknade shared). Deltagande krävs på alla tre.
- **Ties**: samma värde → samma placering (dense rank), sekundär sort på `display_name` för visning; visas som "1." delat.
- **Perioder**: "I år" = kalenderår i gruppens `home_timezone` (fallback Europe/Stockholm). "Totalt" = alla besök oavsett datum.
- **Cuisines-normalisering**: trim + lowercase innan diff. Redan sparad case bevaras för visning.
- **Progression under sharedToggle-övergång**: beräkning sker on read; ingen migrering av sparad state behövs.

## 3. Databas- och read-model-plan

**Princip: härledd, inte lagrad.** Inga poängkolumner, ingen `member_scores`-tabell.

### Utökad `get_group_app_state` (SECURITY DEFINER, låst search_path)

Returnerar ny nyckel `progression`:

```
progression: {
  levels: [{ threshold, name }, ...],           // konstant, för klienten
  members: [{
    userId, visits, uniquePlaces, uniqueCuisines,
    breadthCategories, level, badges: [{ id, earnedAt }],
    repeatMap: { placeId: count }               // trimmat till toppar för UI
  }],
  leaderboards: {
    visitsYear, visitsAll, newPlacesYear, newPlacesAll,
    breadthYear, breadthAll
  },                                             // sorterade arrays av { userId, value, rank }
  milestones: [{ id, kind, at, payload }]       // t.ex. 10_places, full_group_visit, anniversary
}
```

Aktiva medlemmar filtreras via `status='active'` för topplistor; badges/nivå räknas för alla som har visit_participants-rad i gruppens synliga besök.

Ingen ny tabell krävs. Ett litet **frivilligt** tillägg: `activity`-rader med `kind IN ('level-up','badge-earned','group-milestone')` skapas *deterministiskt av RPC* när `create_visit_with_review`, `share_visit_to_group`, `remove_shared_visit_from_group` eller `update_group_settings(shared_visits_count_for_progression)` upptäcker en ny trigger. Denna insert är idempotent via unikt villkor (se migrering).

### Migration

- Utöka `activity_kind`-domänen om det finns en check-constraint (nuvarande text-kolumn tillåter det – lägg ändå till `CHECK` som listar kända värden inkl. de nya, eller lämna öppet). Om `CHECK` saknas: lägg inte till nu.
- Skapa **partiellt unikt index** för idempotens:
  - `CREATE UNIQUE INDEX activity_unique_levelup ON activity(group_id, actor_id, (payload->>'level')) WHERE kind='level-up';`
  - `CREATE UNIQUE INDEX activity_unique_badge ON activity(group_id, actor_id, (payload->>'badge_id')) WHERE kind='badge-earned';`
  - `CREATE UNIQUE INDEX activity_unique_milestone ON activity(group_id, (payload->>'milestone_id')) WHERE kind='group-milestone';`
- Uppdatera `validate_activity_refs` att acceptera nya `kind`-värden och tillåta `place_id/visit_id` nullbara för milestones.
- Uppdatera skrivande RPC:er (`create_visit_with_review`, `share_visit_to_group`, `remove_shared_visit_from_group`, `update_group_settings`) att köra en intern `_recompute_progression_activity(_group_id)` som gör `INSERT ... ON CONFLICT DO NOTHING` för nya trigger-events. Ingen rad backfillas för historik (bara nya händelser bär activity-rader; historiska badges/nivåer syns i profil ändå via read-model).

### Säkerhet / RLS

- `get_group_app_state` är fortsatt enda vägen till gruppdata – klient kan aldrig fråga direkt på canonical `visits`/`reviews`.
- `REVOKE EXECUTE ... FROM anon, PUBLIC` på nya interna helpers, `GRANT EXECUTE TO authenticated` på RPC:er som klienten redan använder.
- Progression-payload innehåller endast användar-id:n som redan är synliga via `memberships` för samma grupp.

### Prestanda

- Beräkning O(besök × deltagare) per grupp, i praktiken små tal (<10k) i flera år. Enkel SQL/CTE räcker; ingen materialiserad vy nu.
- Om en grupp överskrider 5k besök: lyft ut till `CREATE MATERIALIZED VIEW` refreshad från RPC. Utanför Paket 3D.

## 4. UI-ändringar per fil

- `src/lib/matrundan/types.ts` – nya typer: `LevelDef`, `MemberProgression`, `Badge`, `LeaderboardRow`, `GroupMilestone`. Utöka `ActivityKind` med `'level-up' | 'badge-earned' | 'group-milestone'`. Utöka `AppState` med `progression`.
- `src/lib/matrundan/live-repository.ts` – mappa nya `progression`-nyckeln från RPC.
- `src/lib/matrundan/store.tsx` – selectors: `memberProgression(memberId)`, `leaderboard(category, period)`, `milestones()`.
- `src/lib/matrundan/gamification.ts` – **återinförs** som ren, isolerad modul: nivådefinitioner, badge-metadata (id → namn/emoji/beskrivning), demo-lägets härledning från demo-state (så demo funkar identiskt utan RPC). Live använder RPC-payload; demo använder samma funktioner på `AppState`.
- `src/components/matrundan/MemberProfileSheet.tsx` – nytt topp-block (nivå, statar, badges, progressionsstapel endast för egna profilen).
- `src/routes/gruppen.tsx` – kompakt underrad i medlemslistan; ny sektion `GroupHighlights` (topplista + milstolpar).
- `src/components/matrundan/GroupHighlights.tsx` – **ny** komponent med tabs/segmented + milstolpechips.
- `src/components/matrundan/ActivityRow.tsx` – nya ikoner för `level-up`, `badge-earned`, `group-milestone` + svensk textrendering.
- `src/lib/matrundan/demo-data.ts` – oförändrad struktur; gamification härleds live.
- `README.md`, `CHANGELOG.md`, `src/lib/matrundan/version.ts` → `0.9.0`.

## 5. Delsteg

Två sekventiella steg, publicera efter steg 2.

**3D-1 – Beräkningsgrund + demo (ingen skrivsemantik-migration)**
- Ny `gamification.ts` med nivåer/badges + rena beräkningsfunktioner mot `AppState`.
- Utöka `AppState` med härledd `progression` beräknad klientside i demo *och* live (första iterationen räknar i klienten från `get_group_app_state`-payloaden som redan finns).
- UI: kompakt medlemsrad, `GroupHighlights`-sektion, uppdaterad `MemberProfileSheet`.
- Inga DB-ändringar, inga nya activity-rader ännu. Verifiering på demo + live.

**3D-2 – Serverberäkning + aktivitetsevents + publicering**
- Migration: uppdatera `get_group_app_state` att returnera `progression` server-side (auktoritativ, minskar payload); lägg till idempotens-index; uppdatera skrivande RPC:er att skapa `level-up`/`badge-earned`/`group-milestone`-rader.
- `validate_activity_refs` utökas.
- Byt klienten till att läsa `progression` från RPC istället för att räkna själv.
- Bumpa till `v0.9.0`, README/CHANGELOG, publicera till `https://matrundan.lovable.app`.

## 6. Testplan

Manuella + SQL-testfall (transaktionsomslutna där möjligt):

- **Nivågränser**: skapa besök upp till varje tröskel, verifiera nivånamn byts vid exakt 1/4/10/20/40/75. Off-by-one på 3 vs 4.
- **Återbesök**: 3 besök på samma ställe → Stammis; 2 räcker inte.
- **Shared av/på**: samma medlem 5 delade besök: med toggle på → Provsmakaren + Krogspanaren; toggle av → Nyfiken. Verifiera att level-up-activity inte dubbleras när toggle slås av+på (idempotens-index).
- **Tidigare medlem**: sätt `status='left'`, verifiera exkluderad ur topplistor men syns i profil med historik.
- **Ties**: två medlemmar med 5 besök → båda rank 1, tredje rank 3 (dense), alfabetisk visningssekundär.
- **Fullträff-attribution**: A föreslår ställe, B & C besöker (A ej med) → A får Fullträff. A föreslår, endast A besöker → ingen Fullträff. Shared-import: ingen Fullträff till importören.
- **Kökbredd**: 5 unika cuisines fördelat över 3 besök → Världsvan.
- **Smakspektrat**: 4 unika värden ur `category ∪ occasions`.
- **Idempotens**: kör `_recompute_progression_activity` två gånger; endast en rad per event.
- **Radering**: ta bort en link som gav Krogspanaren → nivå sjunker, activity-raden ligger kvar (historisk sanning) men räknas inte längre för nuvarande nivå.
- **Milstolpar**: 10 unika ställen → grupp-milstolpe; årsdag vid `now() >= createdAt + 1 år`.
- **RLS**: verifiera att `get_group_app_state` fortsatt kräver `has_membership`; direkt SELECT på canonical tabeller från klient är förbjuden.
- **UI 360 px**: `GroupHighlights` scrollar inte horisontellt; medlemsraden trunkeras korrekt.

## 7. Versionsförslag

- Efter 3D-1: intern preview, ingen versionsbump (eller `0.9.0-rc.1` om önskat).
- Efter 3D-2: **v0.9.0** publiceras till `https://matrundan.lovable.app`.

## Öppna frågor (svara innan implementation börjar)

1. Godkänner du namnbytet **"Allätaren" → "Smakspektrat"**, eller föredrar du annat (t.ex. "Brett gomkast", "Utforskaren")?
2. Ska progressionsstapel mot nästa nivå synas för *andra* medlemmar (transparens) eller *bara egen profil* (integritet – planens förval)?
3. Vill du att level-up/badge-events *backfillas* som historisk aktivitet vid deploy, eller bara framåt (planens förval: framåt)?
