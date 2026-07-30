## Problem

När kontoregistrering avvisas av backend på grund av lösenordskravet visas det generiska meddelandet "Något gick fel. Försök igen om en stund.". Felöversättningen i `EmailAuthDialog.tsx` matchar bara texter som innehåller "pwned" eller "compromised". Kontrollen mot kända läckor (aktiverad i v1.1.0) avvisar i stället med felkoden `weak_password` och en engelsk text i stil med "Password is known to be weak and easy to guess", som ingen regel fångar. Samma sak gäller backends minimilängd, som svarar "Password should be at least N characters".

## Åtgärd

1. **Felöversättning (`src/components/matrundan/EmailAuthDialog.tsx`)**
   - Läs även felkod (`weak_password`, `over_email_send_rate_limit`, `user_already_exists`) utöver meddelandetext, eftersom Supabase-fel bär en `code`.
   - Lägg till träffar för "weak", "easy to guess", "should be at least", "password should contain".
   - Text vid svagt lösenord: "Lösenordet är för lätt att gissa eller finns i kända läckor. Välj ett längre och mer unikt lösenord."
   - Behåll befintlig fallback för verkligt okända fel.

2. **Förebyggande hjälptext i registreringsläget**
   - Visa en diskret hjälptext under lösenordsfältet vid "Skapa konto": minst 8 tecken och undvik vanliga lösenord, eftersom nya lösenord kontrolleras mot kända läckor.
   - Ingen ny validering utöver befintlig minimilängd; kontrollen mot läckor sker fortsatt i backend.

3. **Version och dokumentation**
   - Bumpa till 1.1.2 i `src/lib/matrundan/version.ts` med changelog-post om tydligare lösenordsbesked.
   - Lägg till motsvarande post i `CHANGELOG.md`.

4. **Verifiering**
   - `bun run typecheck` och `bun run build`.
   - Kontroll av registreringsdialogen vid 360 px utan horisontell overflow.

## Avgränsning

Inga ändringar i auth-inställningar, databas eller sessionslogik. Endast presentation av fel samt versionsdokumentation.
