
# Matrundan v2 — arkitektur- och migreringsplan

Rekommendationen nedan är ett diskussionsunderlag. Ingen kod skrivs förrän du godkänner riktning och svarat på de öppna frågorna i §11.

## 1. Val av Supabase-strategi: **C (nytt projekt), med förbehåll**

Rekommendation: **Alternativ C — nytt Supabase-projekt för Lovable-versionen**, men återanvänd Google OAuth-klient och Geoapify-konto.

Varför inte A (samma projekt, nya v2-tabeller):
- Två parallella scheman i samma DB gör RLS-granskning svårare och riskerar att en glömd `service_role`-policy från gamla appen läcker in i nya. Auditbarheten blir sämre precis när vi går från service-role-modell till äkta RLS.
- Migrationshistoriken är tung och byggd runt e-post-identitet. Nya migrationer blandas med gammal historik.

Varför inte B (omarbeta befintliga tabeller):
- Att flytta identitet från e-post/appgenererade UUID:n till `auth.users.id` på befintliga tabeller kräver backfills, temporära kolumner och en period där båda apparna skriver. Det är den dyraste vägen, och nyttan (behålla ~låg mängd produktionsdata) är liten.

Varför C:
- Ren RLS-modell från dag ett, ingen risk för service-role-läckage från gamla policies.
- Streamlit-appen kan fortsätta leva orörd tills den stängs av — noll driftrisk.
- "Migrering" reduceras till en engångsexport→import av det fåtal rader som faktiskt är värda att bevara (se §8).
- Kostnad: ett extra gratis Supabase-projekt. Marginellt.

Förbehåll: om du redan har externa integrationer (t.ex. bokmärken, delade länkar) som pekar på det gamla projektets URL, väger det över mot A. Baserat på beskrivningen finns inga sådana.

## 2. Vad som återanvänds

**Oförändrat (kopiera rakt av):**
- Google Cloud OAuth-klient (client ID/secret) — lägg bara till Supabase-projektets `/auth/v1/callback` som redirect URI. Se §4.
- Geoapify-konto och API-nyckel.
- OSM-attributionstexter.

**Som specifikation/koncept (skrivs om i TypeScript):**
- Svensk kategorinormalisering och köksmappning från Geoapify-adaptern.
- `PlaceCandidate` / `PlaceProvider`-gränssnittet — matchar redan vår befintliga `PlacesProvider` i `src/lib/matrundan/places-provider.ts`.
- Transaktionell besöks-RPC (visit + participants + första recension) — bra mönster, portas till en Postgres-funktion.
- Gruppspecifikt dubblettskydd på provider-place-ID (unique constraint `(group_id, provider, provider_place_id)`).
- Rollmodell owner/admin/member och inbjudningsflödet.

**Kasseras:**
- All service-role-logik i klientkoden och medlemskapskontroller i applikationslagret — ersätts av RLS.
- E-post och app-UUID som primär identitet — ersätts av `auth.users.id`.
- SQLite-lokalläge — Lovable-appen kör Supabase i alla lägen utom demo (§9).
- Streamlit `st.login()`-flödet.

## 3. Google Auth-övergång utan att bryta gamla appen

1. Behåll den gamla OAuth-klienten. Lägg till två nya "Authorized redirect URIs":
   - `https://<nytt-projekt>.supabase.co/auth/v1/callback`
   - Lovable preview- och publicerade URL:er (Lovable Auth hanterar detta automatiskt när Supabase kopplas via `supabase--enable`).
2. Inga ändringar i den gamla Streamlit-appens `[auth]`-block behövs.
3. Aktivera Google som provider i det nya Supabase-projektet (via `supabase--configure_social_auth`).
4. Bägge apparna kan därmed logga in samma användare parallellt. E-postmatchning gör det trivialt att koppla en gammal profil till en ny `auth.users.id` om/när du migrerar data.

Alternativ: skapa en ny OAuth-klient enbart för Matrundan v2. Föredras om du vill kunna revokera gammal åtkomst separat eller om Streamlit-appens redirect-URI-lista redan är rörig. Marginell extra insats.

**Rekommendation:** återanvänd befintlig klient. Miljöseparation ligger ändå i Supabase-projektet, inte i OAuth-klienten.

## 4. Geoapify: direktanrop vs Edge Function

**Rekommendation: TanStack server function (createServerFn), inte direktanrop från browsern och inte Supabase Edge Function.**

Skäl:
- Direktanrop från browsern kräver att nyckeln exponeras. Geoapifys origin-restriktioner hjälper men skyddar inte mot kvotmissbruk från legitima origins.
- Vår stack är TanStack Start — server functions är rätt verktyg för app-intern serverlogik. Supabase Edge Functions ska undvikas här (se `tanstack-supabase-integration`).
- Server function kan cachea autocomplete-svar per (query, bbox) i minne/KV och normalisera svaret till `PlaceCandidate` innan det når klienten.

Nyckeln (`GEOAPIFY_API_KEY`) läggs i Project Settings → Secrets, läses via `process.env` inuti handler.

## 5. Föreslaget v2-schema (utan SQL, bara relationer)

```text
auth.users (Supabase-managed)
  └── profiles (1:1, PK = auth.users.id)
        display_name, avatar_url, created_at

groups
  id, name, emoji, city (default), owner_id → profiles.id, created_at

memberships
  (group_id, user_id) composite PK
  role: enum('owner','admin','member')
  joined_at
  → groups.id, → profiles.id

invitations
  id, group_id, email, role, token, invited_by, expires_at, accepted_at
  (accept-flödet kopplar email→auth.users vid inloggning)

places
  id, group_id, name, category, address, city, area, lat, lng,
  added_by → profiles.id, added_at, notes, photo_url
  UNIQUE (group_id, name, address)  -- mjukt dubblettskydd

place_sources
  place_id, provider ('geoapify'|'manual'|'osm'), provider_place_id,
  raw jsonb, fetched_at
  UNIQUE (place_id, provider)
  UNIQUE (group_id, provider, provider_place_id) via denormaliserad group_id

visits
  id, group_id, place_id, date, occasion, created_by → profiles.id, created_at
  overall (numeric) -- gruppens helhetsbetyg, härlett eller sparat

visit_participants
  (visit_id, user_id) PK, → profiles.id

reviews
  id, visit_id, author_id → profiles.id,
  taste, value, service, comment, created_at
  UNIQUE (visit_id, author_id)

favorites
  (user_id, place_id) PK

group_next_place
  group_id PK, place_id, picked_by, picked_at

activity
  id, group_id, kind, actor_id, place_id?, visit_id?, at, payload jsonb
```

Notera:
- `group_id` denormaliseras på `places`, `visits`, `favorites` (via place), `activity` för att förenkla RLS-policies (en enda `has_membership(group_id, auth.uid())`-check per policy).
- Ingen `email`-kolumn på `profiles` — den ligger redan på `auth.users`.
- Nivåer/badges (från gamification-diskussionen) härleds i vyer/SQL-funktioner, sparas inte som kolumner initialt.

## 6. RLS-principer per tabell

Grundregel: **allt public-schema-skrivbart bakom `has_membership(group_id, auth.uid())`**, implementerad som SECURITY DEFINER-funktion mot `memberships` (för att undvika rekursion, jfr `infinite-recursion-in-rls`).

| Tabell | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | egen + medlemmar i samma grupp | egen (self) | egen | — |
| groups | medlem | authenticated (blir owner) | owner/admin | owner |
| memberships | medlem i samma grupp | via invitation-RPC | owner/admin (utom sista owner) | owner/admin eller self |
| invitations | owner/admin i gruppen + inbjuden e-post | owner/admin | owner/admin | owner/admin |
| places | medlem | medlem | medlem (eller added_by/admin) | added_by eller admin |
| place_sources | medlem | medlem | medlem | admin |
| visits | medlem | medlem (via RPC) | created_by/admin | created_by/admin |
| visit_participants | medlem | via visit-RPC | — | via visit-RPC |
| reviews | medlem | author = auth.uid() OCH medlem | author | author/admin |
| favorites | egen | egen | — | egen |
| group_next_place | medlem | medlem | medlem | medlem |
| activity | medlem | via triggers/RPC | — | — |

Skrivningar som spänner över flera tabeller (skapa besök, acceptera inbjudan, skapa grupp+owner-membership) körs via `SECURITY DEFINER` RPC:er som validerar medlemskap explicit — inte via klient-transaktioner.

## 7. Datamigrering: **arkivera, migrera inte automatiskt**

Rekommendation:
1. Behåll gamla Supabase-projektet i read-only-läge (revoke skrivrättigheter, stäng av Streamlit-appen eller sätt banner).
2. Exportera relevanta tabeller till CSV/JSON som arkiv.
3. Om det finns >0 verkligt värdefulla besök: skriv ett engångsskript som mappar `email → auth.users.id` (efter att användarna loggat in en gång på nya appen) och importerar `groups`, `memberships`, `places`, `visits`, `reviews`. Kör manuellt, inte som automatisk migrering.
4. Om värdet är lågt: skapa gruppen på nytt i v2 och låt användarna backfilla några historiska besök manuellt via "Registrera besök"-flödet med bakåtdaterat datum.

Beslutskriterium: kör en snabb `SELECT COUNT(*) FROM visits` och `SELECT COUNT(DISTINCT restaurant_id) FROM visits` i gamla DB. Under ~50 besök → manuell backfill. Över → engångsimport.

## 8. Demo-läget efter Supabase-koppling

Behåll nuvarande `StoreProvider` + `localStorage` som **anonymt demo-läge** som körs när användaren inte är inloggad. Två klara lägen:

- **Demo** (ej inloggad): dagens `DEMO_STATE`, allt i localStorage, ingen Supabase-trafik. Bra för landningssida och för att prova appen utan konto.
- **Live** (inloggad): all data via Supabase + RLS. `StoreProvider` byts mot en tunn Supabase-repository-implementation bakom samma interface.

Nyckelbeslut: gör `StoreContextValue` till ett interface, byt implementation baserat på auth-state. Detta gör att alla vyer förblir orörda.

Ingen datasynk mellan demo och live — demo är sandlåda, inget mer.

## 9. Implementationsordning och rollback

Föreslagen ordning, varje steg är en avslutbar milstolpe:

1. **`supabase--enable`** → Lovable provisionerar nytt projekt.
2. **Migrationer:** schema från §5 + `has_membership`-funktion + grants + RLS-policies. Ingen appkod ändras än.
3. **Auth:** aktivera Google via `supabase--configure_social_auth`. Lägg till `/_authenticated`-layout, publik `/auth`-route.
4. **Repository-lager:** implementera Supabase-versionen av `StoreContextValue`-interfacet vid sidan av demo-versionen. Feature-flagga.
5. **Läsflöden först:** matställen-lista, detaljvy, gruppmedlemmar — verifiera RLS med två testkonton.
6. **Skrivflöden:** lägg till plats, registrera besök (via RPC), favoriter, nästa stopp.
7. **Geoapify server function** ersätter demo-provider bakom samma `PlacesProvider`-interface.
8. **Inbjudningsflöde** (invitations-tabell + accept-RPC + e-postlänk).
9. **Gamification-härledningar** (från tidigare plan) — läggs som Postgres-vyer.
10. **Data-arkivering/backfill** enligt §7.
11. Stäng av Streamlit-appen.

**Rollback:** varje steg är additivt. Feature-flag mellan demo och live gör att vi kan falla tillbaka till demo-läge om något RLS-hål upptäcks. Streamlit-appen rörs inte förrän steg 11, så den är alltid en fallback.

## 10. Vad du behöver konfigurera manuellt

**Du (manuellt):**
- Godkänn `supabase--enable` när steget körs.
- Lägg till Supabase callback-URI i Google Cloud Console (en engångsåtgärd; instruktioner kommer i implementationen).
- Lägg `GEOAPIFY_API_KEY` i Project Settings → Secrets när vi når steg 7.
- Beslut i §11 nedan.

**Lovable/Supabase hanterar automatiskt:**
- Supabase-projektuppsättning, keys, URL:er, JWT-signering.
- Google-provider-konfiguration via `supabase--configure_social_auth` (du fyller i client ID/secret som secrets).
- Redirect URLs för preview och publicerad app.
- Migrationer och grants.

## 11. Öppna frågor innan implementation

1. **Ny eller återanvänd OAuth-klient?** Rekommendation: återanvänd. Bekräfta.
2. **Datamigrering:** ungefärlig storlek på gamla DB (räcker manuell backfill eller behövs engångsimport)?
3. **Demo kvar efter live?** Rekommendation: ja, som anonymt sandlådeläge. Bekräfta.
4. **Startpunkt:** vill du att jag börjar med steg 1–3 (Supabase + auth + tom skala) i första implementationsomgången, eller inkludera läs-flöden (steg 5) direkt?

Efter dessa svar bedömer jag att vi är redo för implementation.
