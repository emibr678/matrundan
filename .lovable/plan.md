# Read-only inspektion: backendkoppling i Lovable preview

Ingen fil, inställning, databas eller integration har ändrats.

## Observerad konfiguration

1. **Preview-backend:** Lovables preview (`id-preview--…lovable.app`) använder fortfarande projektets **inbyggda Lovable Cloud-backend**. Ingen extern Supabase är kopplad. `project_info` rapporterar `Managed by Lovable: true`, `Paused: false`, instansstorlek Tiny.
2. **Project ref/URL i preview/runtime:** `bkyzxkfrenbbkgiymofk` / `https://bkyzxkfrenbbkgiymofk.supabase.co`. Alla sex Supabase-variabler i projektets `.env` (både `SUPABASE_*` och `VITE_SUPABASE_*`) pekar på just denna ref — den är alltså både SSR- och browserbackend i preview.
3. **`supabase/config.toml` → `project_id = "bkyzxkfrenbbkgiymofk"`:** samma ref som Lovable Cloud-instansen. Lovables databas-/migrationsverktyg är bundna till den Lovable-hanterade instansen (sessionsverktygen rapporterar "bound to: Live (ref bkyzxkfrenbbkgiymofk)"). Filen är autogenererad och är i praktiken bara en spegling; att redigera den flyttar inte Lovables migrationer till en annan Supabase-instans.
4. **Externa refs i repot** (`wpihfmwbubvdiaavtpia` staging, `wsikirbxqejjwtgxcvjl` prod) förekommer bara i `src/integrations/supabase/environment-contract.ts` (+ tester) och backup/recovery-workflows. Miljökontraktet låser Supabase-värd endast för origins som klassas som staging/prod — Lovables preview-origin omfattas inte, därför blockeras inte dagens Lovable Cloud-koppling i preview.

## Svar på fråga 4

Tekniskt går det att köra Lovable-editorn/previewn mot extern Supabase Staging `wpihfmwbubvdiaavtpia` — men inte genom att byta backend i Lovable Cloud. Konsekvenser att känna till:

- Lovable Cloud kan inte kopplas bort från projektet. Cloud kan pausas, men projektets Supabase-verktyg (migrationer, SQL, typer, storage, logs) fortsätter att peka på `bkyzxkfrenbbkgiymofk`.
- De sex `VITE_SUPABASE_*`/`SUPABASE_*`-variablerna i preview är autogenererade av Cloud. Om preview ska tala med staging krävs en projektstyrd konfigurationsväg (t.ex. egna variabelnamn som klienten läser i första hand) i stället för att skriva över de autogenererade.
- Efter en paus av Cloud slutar auth, databas och storage i preview att fungera mot Cloud-refen; allt som fortfarande läser de autogenererade variablerna går sönder.
- Ett byte innebär att preview skriver i **delad staging-data** — inte en isolerad databas.

## Rekommenderad ordning (om ni väljer att gå vidare senare)

1. Besluta och dokumentera i arkitekturdokumenten att Lovable-preview ska köra mot extern staging, samt vem som äger migrationerna därefter.
2. Inför en explicit klientkonfiguration som kan peka på staging utan att förlita sig på Cloud-genererade variabler, och utöka miljökontraktet så preview-origin valideras mot staging-värden.
3. Verifiera i preview mot staging: inloggning, gruppdata, demo-läge, RLS-beroende flöden.
4. Först när steg 3 är grönt: pausa Lovable Cloud-resurserna.
5. Ta en färsk backup av Cloud-databasen innan pausen, eftersom Cloud-instansen inte kan tas bort och kan behöva återupptas.

Nästa steg är ert beslut — jag har inte gjort och kommer inte att göra någon ändring inom denna inspektion.
