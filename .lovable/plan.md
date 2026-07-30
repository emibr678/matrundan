## Rekommendation på teknikval

**Ren Web Push med VAPID — inte Firebase, inte OneSignal.**

Firebase och OneSignal ger framför allt värde vid *native* appar (App Store/Play), kampanjverktyg och segmentering. Matrundan är en privat gruppapp där notiser är händelsedrivna och all data redan finns i Lovable Cloud. Firebase/OneSignal skulle betyda ett extra konto, extra SDK i klienten, en tredje part som ser vilka enheter dina användare har — och samma PWA-krav på iOS ändå. Ren Web Push är gratis, standardiserat, ingen tredje part, prenumerationerna ligger i din egen databas.

Viktigt: **på iPhone/iPad fungerar notiser bara när appen lagts till på hemskärmen** (iOS 16.4+). Det gäller oavsett teknikval. Därför ingår PWA-steget.

**E-postnotiser utgår** ur den här planen — de kräver en domän du äger, och det är inte aktuellt. Inställningsmodellen byggs ändå så att en e-postkanal kan läggas till senare utan omskrivning.

## Vad som byggs

### 1. Installerbar app (PWA)
- `public/manifest.webmanifest` med namn, färger, `display: standalone` och ikoner i Matrundans varma stil.
- Manifest- och ikonlänkar i rotens `head()`.
- En service worker **enbart för notiser** (visa notis, hantera klick → öppna rätt vy). Ingen offline-cachning, ingen app-shell-cache — det håller previews och publicerad app fria från stale-cache-problem.
- En diskret "Lägg till på hemskärmen"-guide som bara visas för iOS-användare som försöker slå på notiser utan installerad app.

### 2. Datamodell (nya tabeller)
- `push_subscriptions` — en rad per enhet: användare, endpoint, nycklar, enhetsetikett, senast använd.
- `notification_preferences` — per användare och notistyp: på/av.
- `notification_outbox` — köade utskick (typ, mottagare, grupp, payload, status, försök). Ger idempotens och retry, och gör att en besöksregistrering aldrig kan misslyckas för att en notis inte gick fram.

RLS: användare ser och ändrar bara sina egna rader. Skrivningar till outbox sker enbart via `SECURITY DEFINER`-RPC:er/triggers, aldrig från klient.

### 3. Notistyper (alla fyra du valde)
| Typ | Utlöses av | Mottagare |
|---|---|---|
| Nytt besök registrerat | `create_visit_*` | gruppens aktiva medlemmar utom registreraren |
| Nästa stopp satt/ändrat | `set_next_place` | gruppens aktiva medlemmar utom den som satte |
| Du lades till som deltagare | besöksdeltagare | endast berörd användare |
| Ny medlem i gruppen | accepterad inbjudan | gruppens aktiva medlemmar utom den nya |

Regler: aldrig notis till den som utlöste händelsen, aldrig text som avslöjar annan grupps identitet, alltid gruppnamn + tydlig svensk text, klick leder till rätt vy i rätt grupp.

### 4. Utskick
- Serverfunktion som plockar outbox-rader och skickar. Web Push signeras med VAPID via Web Crypto (Worker-kompatibelt bibliotek, inte Node-`web-push`).
- Prenumerationer som svarar 404/410 tas bort automatiskt.
- Direkt-försök vid händelsen så vanliga notiser kommer på sekunden, plus ett `/api/public/*`-jobb som pg_cron triggar varje minut för eftersläpande köade utskick.
- VAPID-nyckelparet genereras och lagras som hemlighet; den publika nyckeln exponeras (den är avsedd att vara publik).

### 5. Inställningar i profilen
Ny sektion "Notiser":
- Tydlig knapp "Slå på notiser på den här enheten" (hanterar behörighetsdialogen och registrerar enheten).
- Lista över dina registrerade enheter med möjlighet att koppla bort.
- På/av per notistyp, alla fyra på som standard.
- Ärlig hjälptext om iPhone-kravet på hemskärmsinstallation.
- Allt verifierat i 360 px.

### 6. Kvalitet och release
- Enhetstester för mottagarurval (ingen självnotis, bara aktiva medlemmar, respekterar inställningar, dedupe per händelse).
- Kontraktstest mot RPC/RLS: ingen kan läsa andras prenumerationer eller köa utskick till en grupp de inte tillhör.
- Playwright: 360 px utan horisontell overflow i inställningsvyn.
- `bun run verify:changed`, `typecheck`, build.
- Version bumpas till **v1.2.0** i `version.ts`, `version-history.ts`, `CHANGELOG.md` och `README.md`.

## Leveransordning
Allt ovan levereras som ett sammanhållet paket (Paket 7). Om du senare vill ha en påminnelsenotis inför bokat nästa stopp lägger vi till den som en femte typ — modellen är byggd för det.
