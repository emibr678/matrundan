## Bakgrund (verifierat)

Nätverksloggen visar att din registrering svarade `identities: []`. Det är Supabases sätt att signalera "e-postadressen finns redan" utan att avslöja det för utomstående — därför kom inget nytt verifieringsmail och inloggningen misslyckades tills du återställde lösenordet. Projektet har ingen egen e-postdomän, så alla mail går från standardavsändaren och hamnar lätt i skräppost.

## Vad som ändras

### 1. Konto aktiveras direkt vid registrering
- Slå på automatisk bekräftelse av e-post i backendens autentiseringsinställningar.
- Effekt: den som skapar konto loggas in direkt, inget verifieringsmail behövs.
- Återställning av lösenord fortsätter fungera via mail (det flödet är redan verifierat av dig).
- Texten i registreringsvyn ändras från "du får en verifieringslänk" till att kontot skapas direkt.

### 2. Tydligt besked när e-postadressen redan finns
- Efter registrering kontrolleras svaret: om användaren saknar identiteter finns kontot redan.
- Visa: "Det finns redan ett konto med den e-postadressen."
- Växla automatiskt till inloggningsvyn med e-posten förifylld, med "Glömt lösenord?" synligt intill.

### 3. Skräppost-hint där mail faktiskt skickas
- I "Glömt lösenord"-bekräftelsen: kort hjälptext om att mailet kan hamna i skräpposten och att avsändaren är en standardadress.
- Ingen hint där den inte längre behövs (registrering skickar inget mail efter ändring 1).

## Tekniska detaljer

- `supabase--configure_auth`: `auto_confirm_email: true`, övriga inställningar oförändrade (HIBP-kontrollen behålls påslagen).
- `src/lib/matrundan/session.tsx`: `signUpWithPassword` returnerar ett tydligt resultat för "kontot finns redan" (`data.user && data.user.identities?.length === 0`) i stället för att tolkas som lyckad registrering.
- `src/components/matrundan/EmailAuthDialog.tsx`: hanterar det nya resultatet, byter läge till inloggning med bevarad e-post, uppdaterade svenska texter samt skräppost-hint i återställningsläget.
- Version bumpas till 1.1.1 i `src/lib/matrundan/version.ts` (in-app-changelog) och `CHANGELOG.md`.
- Verifiering: `bun run typecheck`, `bun run build` samt kontroll av dialogen vid 360 px.

## Noteras

Utan egen e-postdomän kommer återställningsmailen fortsatt från standardavsändaren och riskerar skräppost. Vill du helt undvika det senare krävs en egen domän — det ligger utanför den här ändringen.