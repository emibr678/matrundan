## Svar på dina frågor

**Gratis domän?** Nej. Avsändardomänen måste vara en riktig domän ni äger — det finns ingen gratis eller Lovable-delad avsändare. En .se-domän kostar dock bara runt 100–150 kr/år, så det är en låg tröskel den dag ni vill ha svenska, snygga mail utan Gmail-varning.

**Kan admin återställa lösenord i gruppen?** Nej, och det ska inte byggas. En gruppadmin som kan sätta någon annans lösenord kan också ta över kontot och se personens privata omdömen — det bryter mot Matrundans egen integritetsprincip. Det är inte best practice i någon produkt.

**Måste vi kräva Google/Apple då?** Nej. Det viktiga du oroar dig för — "glömt lösenord → tvingas skapa nytt konto → tappar historik" — är redan löst utan egen domän: **standardmailen för autentisering fungerar redan** (det var så inloggningslänken kom fram). Alltså kan "Glömt lösenord" skickas idag. Mailet är på engelska från en delad avsändare tills ni skaffar domän, men det fungerar och räddar kontot.

**Best practice:** e-post + lösenord som bas, Google som snabbval, Apple som tillägg när ni vill. Kontot identifieras av e-postadressen, så en användare som loggar in med Google och senare med samma e-post hamnar på samma konto och behåller sin historik.

## Vad som byggs

**1. Ersätt e-postkod med e-post + lösenord**
`EmailCodeDialog` blir `EmailAuthDialog` med tre lägen:
- Logga in: e-post + lösenord.
- Skapa konto: e-post + lösenord (minst 8 tecken) + visa/dölj-knapp, plus namn så profilen får ett vettigt visningsnamn direkt.
- Glömt lösenord: skickar återställningsmail.

Svensk copy genomgående, tydlig text om att inloggning och gruppinbjudan är två olika saker. All copy behåller Matrundans varma ton.

**2. Ny route `/nytt-losenord`**
Publik sida dit återställningsmailet leder. Läser återställningsläget från URL:en, låter användaren sätta nytt lösenord och skickar sedan vidare till Hem.

**3. Sessionshantering**
`session.tsx` får `signUpWithPassword`, `signInWithPassword` och `sendPasswordReset` istället för kodfunktionerna. Om någon redan är inloggad med ett annat konto när de loggar in med e-post: logga ut den gamla sessionen först, rensa aktiv grupp och läs om medlemskap, så förra kontots grupp inte ligger kvar.

**4. Inbjudningsflödet**
`/inbjudan/$token` erbjuder Google eller e-post/lösenord, och behåller den väntande inbjudningssökvägen genom hela registreringen så att man landar rätt efter att kontot skapats.

**5. Säkerhet**
Slå på kontroll mot kända läckta lösenord vid registrering och lösenordsbyte. Ingen automatisk e-postbekräftelse aktiveras — användaren får bekräfta sin adress som vanligt.

## Vad som inte byggs

- Ingen admin-återställning av andras lösenord.
- Ingen sexsiffrig kod (kräver egen domän).
- Inga ändringar i datamodell, RLS eller RPC:er.

## Teknisk detalj

Ändrade filer: `src/components/matrundan/EmailCodeDialog.tsx` (byter namn och innehåll), `src/lib/matrundan/session.tsx`, `src/routes/nytt-losenord.tsx` (ny), `src/components/matrundan/LandingScreen.tsx`, `src/components/matrundan/AuthMenu.tsx`, `src/routes/inbjudan.$token.tsx`. Auth-inställningen för läckta lösenord sätts på backend. Verifiering: typecheck, lint, build, samt 360 px-kontroll av dialogen och den nya routen. Version bumpas och CHANGELOG uppdateras.

## Senare, när ni har en domän

Då sätter vi upp avsändardomänen och skriver om alla sex auth-mail på svenska i Matrundans ton — och kan då också lägga tillbaka sexsiffrig kod som inloggningsalternativ om ni vill.
