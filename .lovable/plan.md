# Diagnos: Google-inloggning returnerar men sessionen saknas

Read-only granskning. Ingen kod, konfiguration, databas eller publicering har ändrats.

## Huvudfynd (verifierat nu)

Lovable Cloud-backenden för projektet är **pausad** (statuskontroll returnerade pausat läge, och en read-only SQL-fråga mot auth-schemat gick inte igenom: anslutningen timeoutade). Detta är den starkaste och enklaste förklaringen till exakt det observerade beteendet:

- Google-steget fungerar (Google är extern och påverkas inte, därför kan kontobehörighet frågas igen),
- men det avslutande steget där auth-tjänsten ska växla providersvaret till en Matrundan-session kan inte fullföljas,
- appen landar därför tillbaka på startsidan utan session, både i publicerat läge och i preview,
- även en tidigare giltig session kan tappas eftersom tokenförnyelse mot auth-tjänsten misslyckas.

Så länge backenden är pausad går det inte att skilja ett eventuellt sekundärt konfigurationsfel från detta.

## Vad kodgranskningen visar (inga projektspecifika fel hittade)

- `src/lib/matrundan/session.tsx` använder den hanterade hjälpfunktionen korrekt: `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`. `redirect_uri` är publik same-origin, inte en skyddad route.
- Sessionslyssnaren är korrekt uppsatt: en `onAuthStateChange` plus ett initialt `getSession()` i `SessionProvider`.
- Ingen kod rensar URL-hash, skriver om history eller loggar ut vid uppstart. Google-flödet anropar inte `resetBeforeAuth`, så ingen oavsiktlig utloggning sker efter callback.
- `public/push-sw.js` har ingen `fetch`-hanterare och ingen cachning, så service workern kan inte kapa `/~oauth`-omdirigeringen (ett känt felläge som alltså inte gäller här).
- Klientkonfigurationen pekar på projektets direkta auth-URL (inte en proxy-URL) och `.env` innehåller endast publik klientkonfiguration.
- Auth-integrationen är oförändrad i den senaste historiken: de senaste commits rör sökområden, tester, formattering och underhålls-UX — inga ändringar i `src/integrations/*`, `session.tsx`, `.env` eller `supabase/config.toml`. Inget i projektets aktuella tillstånd tyder på att auth-koden eller auth-konfigurationen ändrats i samband med incidenten.

## Hypoteser, i styrkeordning

1. **Pausad backend (primär, verifierad).** Auth-tjänsten svarar inte, så ingen session kan skapas eller förnyas. Åtgärd är att återuppta backenden i Cloud-inställningarna — kräver separat godkännande och ingår inte i denna plan.
2. **Google-providern är avstängd eller ändrad i auth-inställningarna** (sekundär). Skulle normalt ge ett tydligt providerfel snarare än tyst återkomst, men kan inte uteslutas medan backenden är nere.
3. **Site URL / tillåtna redirect-URL:er stämmer inte med publicerad domän** (svag). Skulle typiskt ge landning på fel origin eller ett synligt redirect-fel, inte samma beteende på både preview och publicerat.
4. **Klientfel i tokenhantering** (svag/utesluten av granskningen ovan).

## Read-only verifieringssteg (i ordning, efter att backenden är aktiv igen)

1. Kontrollera backendstatus tills den är aktiv och frisk.
2. Läs auth-loggarna kring ett nytt inloggningsförsök och notera om providersvaret och tokenutbytet loggas som lyckat.
3. Read-only SQL: räkna identiteter per provider och senaste `last_sign_in_at` för att se om en Google-identitet faktiskt uppdateras vid försöket.
4. Bekräfta i auth-inställningarna att Google är aktiverad och att Site URL/redirect-listan innehåller den publicerade domänen och previewdomänen.
5. Reproducera i vanlig flik (inte inbäddad preview) med konsol och nätverksflik öppna: kontrollera `/~oauth/initiate`, providerhoppet, callbacken tillbaka till origin och om en session finns i klientlagringen direkt efter landning.
6. Om något steg misslyckas efter att backenden är aktiv: rapportera exakt vilket steg, innan någon ändring föreslås.

Ingen åtgärd, konfigurationsändring eller publicering föreslås utföras inom detta uppdrag.
