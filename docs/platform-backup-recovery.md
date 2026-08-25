# Backup och återställning

**Status:** driftkontrakt för #207 – Frikoppla drift från Lovable Cloud och etablera portabel plattform  
**Scope:** portabel backup, privat media och restoreövning; inga produktionsskrivningar genom dokumentet

## Driftmål

För Matrundans nuvarande skala gäller initialt:

- **RPO: 24 timmar** – högst ett dygns nya data får behöva återskapas manuellt efter ett katastroffel;
- **RTO: 24 timmar** – en verifierad återställning ska normalt kunna göras tillgänglig inom ett dygn.

Målen omprövas om användning, kritikalitet eller datamängd växer. En backup räknas inte som användbar bara för att ett jobb skapade en fil; generationen måste kunna verifieras med checksumma och en faktisk restoreövning måste ha lyckats.

## Vad en backupgeneration innehåller

`matrundan-backup-v1` består av:

- `roles.sql` – Supabase CLI:s portabla rolldump;
- `schema.sql` – schemaögonblick för jämförelse och leverantörsportabilitet; repoets migrationer är fortsatt primär schema-source-of-truth;
- `data.sql` – applikationsdata enligt Supabase CLI:s dataexport;
- `auth.sql` – separat, känslig export av `auth.users`, `auth.identities` och, när tabellen finns, `auth.mfa_factors`;
- `inventory.json` – endast säkra radantal och databasstorlek, inga privata payloads;
- `media/` – aktiva privata Storage-bytes som refereras av `visit_media`, med separat SHA-256-manifest;
- `tooling.txt` – verktygsversioner som användes vid exporten;
- `backup-manifest.json` – generationens releaseidentitet, RPO/RTO, filstorlekar och SHA-256-checksummor.

Orphanade Storage-objekt som inte längre refereras av `visit_media` är inte produktdata och återställs inte. Secrets, JWT/sessiontokens, OAuth client secrets, signerade URL:er och runtime-credentials hör aldrig hemma i backupgenerationen.

## Skapa en generation

Backupverktygen skriver lokalt med restriktiva rättigheter och `backups/` är Git-ignorerad. Databasdumpen kräver en Session Pooler/direct-anslutning, Supabase CLI, Docker-kompatibel runtime, `psql`, `pg_dump` och repoets Bun-version.

```bash
SUPABASE_DB_URL="..." \
  bash scripts/backup-supabase.sh backups/2026-08-23T080000Z
```

Exportera därefter aktiva privata besöksfoton. Service-role får endast tillföras som runtime-secret och ska inte skrivas till fil eller logg.

```bash
SOURCE_SUPABASE_URL="https://<project-ref>.supabase.co" \
SOURCE_SUPABASE_SERVICE_ROLE_KEY="..." \
  bun scripts/visit-photo-backup.mjs export backups/2026-08-23T080000Z
```

Skapa och verifiera slutmanifestet:

```bash
MATRUNDAN_BACKUP_SOURCE_REF="<project-ref>" \
MATRUNDAN_BACKUP_APP_VERSION="1.38.2" \
MATRUNDAN_BACKUP_RELEASE_SHA="<40-char-sha>" \
  bun scripts/backup-manifest.mjs create backups/2026-08-23T080000Z

bun scripts/backup-manifest.mjs verify backups/2026-08-23T080000Z
```

En generation är **inte off-site-backup** förrän den därefter har lagrats krypterat utanför den aktiva Supabase-miljön. GitHub Actions-artifacts är inte backupmål. R2 eller annan objektlagring får vara transportadapter, men backupformatet ovan ska inte bero på leverantören.

## Återställningsordning

Restoreövning ska göras mot en separat tom testmiljö, aldrig mot staging eller production. För den kostnadsfria pre-cutoverövningen används en ephemer lokal Supabase-stack i Docker; den förbrukar inget extra Supabase-projekt och förstörs efter körningen. Normal ordning är:

1. verifiera `backup-manifest.json` innan någon import;
2. starta en tom lokal Supabase-stack och applicera repoets aktuella migrationer i ordning;
3. återställ den separata Auth-exporten och därefter `data.sql` med triggers avstängda under importen där det krävs;
4. återställ privata Storage-bytes med `visit-photo-backup.mjs restore`; verktyget kräver att återställd `visit_media` redan matchar backupen;
5. återetablera environment-specifika Auth-providerinställningar, callbacks och secrets från driftkonfiguration när ett permanent restoremål används – aldrig från backupfilerna;
6. kör `supabase/production-preflight.sql`, radantals-/integritetskontroller och autentiserad smoke mot en verklig återställd testgrupp;
7. dokumentera faktisk start/sluttid, backupgeneration och resultat så att uppmätt RTO är känd.

`Recovery restore drill` (`.github/workflows/recovery-restore.yml`) är den manuella pre-cutovergrinden för denna övning. Den får endast köras från en uttryckligen angiven exakt `main`-SHA, läser Staging med hemligheter från GitHubs `staging`-environment och återställer bara till runnerns lokala Docker-stack. Backupgenerationen ligger endast på runnerns temporära disk, laddas inte upp som Actions-artifact och tas bort tillsammans med den lokala stacken efter körningen. PR-kod får därmed inte staging-hemligheterna.

Mediarestore är idempotent på byte-nivå: ett redan korrekt målobjekt lämnas orört, annars laddas backupens objekt upp och verifieras med SHA-256 efteråt.

## Säkerhet och retention

Backupgenerationen innehåller privata gruppdata, e-post/Auth-data, lösenordshashar och foton. Den ska därför:

- krypteras i vila hos off-site-leverantören och transporteras över TLS;
- vara åtkomlig endast för backup-/restoreidentiteten;
- aldrig läggas i Git, PR-artifacts, publika buckets eller vanlig apptelemetri;
- ha flera generationer så att en logisk korruption inte omedelbart ersätter enda goda kopian;
- verifieras med `backup-manifest.mjs verify` efter överföring och före restore.

Initial retention för den schemalagda kedjan blir **7 dagliga + 4 veckovisa generationer**. Den kan minskas eller ökas när faktisk datamängd och lagringskostnad är känd, men minst två separata återställningspunkter ska alltid finnas.

## Kvar innan #207:s backupgrind är stängd

Verktyg och format räcker inte som driftkvittens. Före cutover återstår att:

- koppla generationerna till ett verifierat off-site-mål;
- köra minst en riktig backup av den blivande source-of-truth-miljön;
- återställa den till en tom separat testmiljö;
- verifiera Auth-identiteter, privat media, radantal, RLS/RPC och autentiserad app-smoke;
- automatisera daglig körning och larma när senaste lyckade generation är äldre än RPO.
