## Diagnos: preview fastnar på "Hämtar gruppens data…"

### Rotorsak (bekräftad, read-only)

Klienten (`src/lib/matrundan/live-repository.ts` rad 147) anropar RPC:n `get_group_app_state_v5c`, men den funktionen finns **inte** i databasen.

- `pg_proc`-slagning i schema `public`:
  - `get_group_app_state_v5c` → saknas
  - `get_group_app_state_v4b` → finns
  - `list_user_groups_v4b` → finns
  - `upsert_visit_photo`, `delete_visit_photo` → saknas

- `supabase_migrations.schema_migrations` – senaste 15 versionerna slutar på `20260727092000`. Det finns **ingen** rad `20260728093000`. Migration `20260728093000_package_5c_visit_photos.sql` är alltså **inte applicerad** (varken helt eller delvis).

### Varför UI:t hänger på texten

`loadLiveState` fångar RPC-felet, loggar det och **returnerar `null`** utan att kasta. I `AppShell.tsx` innebär det:

- `loadLiveState(...).then(setLiveState)` sätter `liveState = null`.
- `catch`-grenen körs aldrig, så `liveError` förblir `null`.
- Render-grenen `mode === "live" && !liveState` visar då fallback-texten `"Hämtar gruppens data…"` – för alltid.

Det är alltså inte ett hängande nätverksanrop; RPC:n svarar snabbt med fel som klienten sväljer.

### Förväntat konsol-/nätverksfel

Anropet `POST /rest/v1/rpc/get_group_app_state_v5c` returnerar 404 med PostgREST-koden `PGRST202` ("Could not find the function public.get_group_app_state_v5c…"). Loggat i browser-konsolen som `[Matrundan] get_group_app_state_v5c: …`.

`list_user_groups` (v4b) och `Storage.createSignedUrls` för `visit-photos` når aldrig att köras i denna kod­väg, eftersom `loadLiveState` avbryts före signeringen. `visit-photos`-bucket och foto-RPC:erna saknas dessutom eftersom 5C-migrationen inte är körd.

### Migrationstatus för Paket 5C

- `20260728093000_package_5c_visit_photos.sql`: **inte applicerad**.
- Följdeffekter av den uteblivna migrationen:
  - `get_group_app_state_v5c` saknas (blockerar hela live-läget).
  - `upsert_visit_photo` / `delete_visit_photo` saknas.
  - Storage-bucket `visit-photos` och dess policys är overifierade (klienten skulle ändå aldrig nå dit i nuvarande felläge).

### Sammanfattning att rapportera

- Fel: RPC `get_group_app_state_v5c` finns inte → 404 `PGRST202` → `loadLiveState` returnerar `null` → AppShell fastnar på "Hämtar gruppens data…".
- Migration `20260728093000_package_5c_visit_photos.sql` är inte applicerad; senaste applicerade version är `20260727092000`.
- `list_user_groups_v4b` och Storage-signeringen är inte orsaken; de hinner inte köras.

### Föreslagen åtgärd (endast förslag, ej utförd)

Applicera 5C-migrationen (skapar `get_group_app_state_v5c`, `upsert_visit_photo`, `delete_visit_photo` och `visit-photos`-bucket/policys). Överväg också att låta `loadLiveState` kasta så att `AppShell` visar `liveError` istället för att fastna i "Hämtar…"-texten vid framtida RPC-fel.

Inga kodändringar, migrationer eller publiceringar har gjorts.