# Backup och återställning

**Status:** aktivt driftkontrakt efter plattformsmigrationen  
**Scope:** portabel production-backup, privat media, off-site-retention och verifierad restore till separat testmål

## Driftmål

För Matrundans nuvarande skala gäller:

- **RPO: 24 timmar** – högst ett dygns nya data får behöva återskapas manuellt efter ett katastroffel;
- **RTO: 24 timmar** – en verifierad återställning ska normalt kunna göras tillgänglig inom ett dygn.

Målen omprövas om användning, kritikalitet eller datamängd växer. En backup räknas inte som användbar bara för att ett jobb skapade filer; generationen ska vara checksummeverifierad, lagrad off-site och återställningsbar i en faktisk restoreövning.

## Kanonisk driftkedja

Tre GitHub Actions-workflows äger dagens backup- och recoveryflöde:

- `offsite-backup.yml` skapar production-generationer och lagrar dem i den privata off-site-destinationen. GitHub Actions-artifacts är inte backupmål.
- `recovery-offsite-restore.yml` återställer en explicit off-site-generation till en tom, lokal och ephemeral Supabase/Docker-stack. Production är aldrig restoremål för drillen.
- `recovery-db-diagnostics.yml` är ett separat manuellt, read-only felsökningsverktyg för databasanslutning. Det skapar ingen backup och gör ingen restore.

Den tidigare `recovery-restore.yml` hörde till migrationsfasen och skapade en ny backup direkt från vald live-Supabase-källa före lokal restore. Efter att den schemalagda off-site-kedjan och off-site-restoren etablerats är den inte längre en separat driftgrind och ska inte ligga kvar som ett alternativt recoveryflöde.

## Backupgenerationen

`matrundan-backup-v1` innehåller:

- `roles.sql` – Supabase CLI:s portabla rolldump;
- `schema.sql` – schemaögonblick för jämförelse och leverantörsportabilitet; repoets migrationer är fortsatt primär schema-source-of-truth;
- `data.sql` – applikationsdata;
- `auth.sql` – separat, känslig export av relevanta Auth-tabeller;
- `auth-schema.json` – kompatibilitetssnapshot för Auth-schemat;
- `inventory.json` – säkra radantal och databasstorlek, utan privata payloads;
- `media/` – aktiva privata Storage-bytes som refereras av `visit_media`, med SHA-256-manifest;
- `tooling.txt` – verktygsversioner som användes vid exporten;
- `backup-manifest.json` – generationens identitet, source-ref, release-SHA, filstorlekar och SHA-256-checksummor.

Orphanade Storage-objekt som inte längre refereras av `visit_media` är inte produktdata och återställs inte. Secrets, JWT/sessiontokens, OAuth client secrets, signerade URL:er och runtime-credentials hör aldrig hemma i backupgenerationen.

## Manuell verktygsanvändning

Backupverktygen skriver lokalt med restriktiva rättigheter och `backups/` är Git-ignorerad. Databasdumpen kräver Session Pooler/direct-anslutning, Supabase CLI, Docker-kompatibel runtime, PostgreSQL 17-klient och repoets Bun-version.

```bash
SUPABASE_DB_URL="..." \
  bash scripts/backup-supabase.sh backups/2026-09-07T080000Z

SOURCE_SUPABASE_URL="https://<project-ref>.supabase.co" \
SOURCE_SUPABASE_SERVICE_ROLE_KEY="..." \
  bun scripts/visit-photo-backup.mjs export backups/2026-09-07T080000Z

MATRUNDAN_BACKUP_SOURCE_REF="<project-ref>" \
MATRUNDAN_BACKUP_APP_VERSION="<version>" \
MATRUNDAN_BACKUP_RELEASE_SHA="<40-char-sha>" \
  bun scripts/backup-manifest.mjs create backups/2026-09-07T080000Z

bun scripts/backup-manifest.mjs verify backups/2026-09-07T080000Z
```

En lokal generation är inte off-site-backup förrän den har lagrats krypterat utanför den aktiva Supabase-miljön. Backupformatet ska vara leverantörsportabelt även när R2 eller annan objektlagring används som transportadapter.

## Restoreordning

Restoreövning ska göras mot en separat tom testmiljö, aldrig direkt mot staging eller production. `recovery-offsite-restore.yml` använder en lokal Supabase-stack i Docker och förstör den efter körningen.

Normal ordning är:

1. välj en explicit committed off-site-generation och verifiera dess manifest/checksummor;
2. starta en tom lokal Supabase-stack på PostgreSQL 17 och applicera repoets migrationer;
3. verifiera Auth-schema-kompatibilitet före import;
4. återställ Auth-data och applikationsdata;
5. återställ privata Storage-bytes och verifiera SHA-256;
6. kör inventory-/integritetskontroller och `supabase/production-preflight-all.sql` mot restoremålet;
7. verifiera autentiserad gruppread mot den återställda miljön;
8. dokumentera generation, release-SHA, start/sluttid och resultat så faktisk RTO är känd;
9. förstör den lokala stacken och privata temporärfiler.

När ett verkligt permanent restoremål behöver skapas återetableras environment-specifika Auth-providerinställningar, callbacks och secrets från driftkonfiguration – aldrig från backupfilerna. En sådan katastrofrestore är en separat driftåtgärd och omfattas inte av den vanliga restoreövningen.

### Recovery-runnerns kontrakt

Recovery-workflows kör explicit på GitHub-hostad `ubuntu-24.04`. Runnern är
ephemeral och ger en tydlig trust boundary för produktionshemligheter.
Repository-variabler får inte styra `runs-on`, och en privat utvecklingsmaskin
ska inte registreras som alternativ recovery-runner.

Recoveryflödet verifierar bland annat Linux/Docker, repoets låsta verktygsversioner, PostgreSQL 17, tillgängligt diskutrymme och tomt lokalt restoremål innan privata backupbytes används.

`Recovery DB diagnostics` får användas när anslutning till staging eller production behöver felsökas utan service-role, backup eller restore. Workflowet är `main`-låst och ska endast rapportera den minimala read-only nätverks-/serverinformation som behövs för diagnos.

Mediarestore är idempotent på byte-nivå: ett redan korrekt målobjekt lämnas orört, annars laddas backupens objekt upp och verifieras efteråt.

## Säkerhet och retention

Backupgenerationen innehåller privata gruppdata, e-post/Auth-data, lösenordshashar och foton. Den ska därför:

- krypteras i vila hos off-site-leverantören och transporteras över TLS;
- vara åtkomlig endast för backup-/restoreidentiteten;
- aldrig läggas i Git, PR-artifacts, publika buckets eller vanlig apptelemetri;
- ha flera generationer så att en logisk korruption inte omedelbart ersätter enda goda kopian;
- verifieras med `backup-manifest.mjs verify` efter överföring och före restore.

Initial retention är **7 dagliga + 4 veckovisa generationer**. Den kan justeras när faktisk datamängd och lagringskostnad motiverar det, men minst två separata återställningspunkter ska alltid finnas.
