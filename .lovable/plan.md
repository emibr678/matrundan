## Bakgrund

I v1.4.0 är alla andra aktiva grupper förvalda när man registrerar ett besök. Det är smidigt när grupper har samma geografi, men skapar brus om grupper täcker olika områden (t.ex. Stockholms skärgård vs Göteborg). Användaren efterfrågar:

1. Ett mindre stökigt sätt att välja grupper än "alla förvalda".
2. Om andra grupper bara ska visas när stället redan finns där.
3. Om stället ska läggas till i valda grupper vid delning.
4. Om man vid tillägg av ett ställe ska kunna synka egna tidigare besök från andra grupper.

## Rekommendation

- Förvalt **inga** grupper. Erbjud en "Välj alla"-länk i avsnittshuvudet.
- **Förvalt grupper där stället redan finns** — det är den tydligaste relevanssignalen.
- Visa **alla** aktiva grupper (inte bara de där stället finns), eftersom delningens poäng är att föra in nya ställen i andra grupper.
- Förtydliga copyn så att det framgår att både besöket och matstället läggs till i valda grupper.
- Lägg till en separat funktion: när man lägger till ett ställe i en grupp, erbjud att dela egna tidigare besök från andra grupper.

## Del 1 – v1.4.1 Smartare delningsförval i VisitDialog

### 1. Ändra förval
- `shareGroupIds` initieras till tom lista i stället för alla `shareableGroups`.
- Lägg till en liten "Välj alla" / "Rensa val"-växel i avsnittshuvudet.
- Om användaren klickar "Välj alla": kryssa i alla grupper.
- Om alla redan är ikryssade: byt text till "Rensa val" och töm listan.

### 2. Förval grupper där stället redan finns
- Utöka `list_visit_share_targets_v4b` (eller skapa en ny RPC) så att varje målgrupp innehåller `placeExistsInGroup: boolean`.
- I `VisitDialog`: när dialogen öppnas, förval grupper där `placeExistsInGroup` är true.
- Om inga sådana grupper finns: inget förvalt.

Alternativ om RPC-ändring anses för stor för denna rättning: hämta informationen från `userGroups` kombinerat med en ny lättviktig serverfunktion. Rekommenderad väg är att utöka den befintliga RPC:n eftersom den redan kör för varje målgrupp.

### 3. Tydligare copy
- Rubrik: "Dela med dina andra grupper" (oförändrad).
- Hjälptext: "Besöket och matstället läggs till i de valda grupperna. Ursprungsgrupp, privata kommentarer och andra gruppers medlemmar syns aldrig."
- Toast: behåll "tillagt i N grupper till" men justera så att det stämmer även när användaren aktivt valt.

### 4. Hantera tom lista
- Om `shareableGroups.length === 0`: visa inget avsnitt (oförändrat).
- Om användaren avmarkerar alla: avsnittet fortsätter visas så att "Välj alla" fortfarande är tillgängligt.

## Del 2 – v1.5.0 Synka tidigare besök när man lägger till ställe

### 1. Nytt steg i AddPlaceDialog
- Efter att användaren bekräftat ett nytt ställe (manuellt eller från Geoapify), kontrollera om den inloggade användaren har tidigare besök på samma canonical `place_id` i andra grupper.
- Visa ett nytt valfritt avsnitt: "Du har besökt det här stället i X andra grupper. Vill du dela besöken till [aktuell grupp]?"
- Lista besöken med datum och målgrupp (endast grupper där användaren är aktiv medlem visas).
- Kryssrutor per besök, inget förvalt.

### 2. Teknisk implementation
- Ny RPC `list_own_visits_for_place_on_add(_place_id uuid, _target_group_id uuid)` som returnerar användarens egna besök på platsen i andra grupper, med flaggan `alreadySharedToTarget`.
- Återanvänd `share_visit_to_group` för varje valt besök.
- Aktivitetslogga varje delat besök i målgruppen.

### 3. Säkerhet och integritet
- Endast besök där användaren är deltagare får delas (samma regel som idag).
- Endast aktiva medlemsgrupper får vara mål.
- Kommentarer följer samma regler som vid vanlig delning (egen kommentar delas endast om användaren väljer det).

## Del 3 – Demo- och exempelläge

- Delningsavsnittet i `VisitDialog` ska fortsätta döljas i demo/exempel eftersom det kräver live-grupper.
- Inga ändringar i demo-data eller exempelgruppens innehåll.

## Del 4 – Verifiering

- `bun run typecheck`
- `bun run verify:changed`
- Playwright-kontroll vid 360 px för den utökade dialogen
- Manuellt test: registrera besök med 0, 1 och flera målgrupper; verifiera att stället dyker upp i målgruppen
- För v1.5.0: manuellt test av synk-flödet med ett ställe som har tidigare besök i annan grupp

## Dokumentation

- Uppdatera `CHANGELOG.md` med v1.4.1 och v1.5.0.
- Uppdatera `src/lib/matrundan/version.ts` och versionshistorik.
- Uppdatera `README.md` om delningsbeteendet ändras på ett sätt som påverkar användarinstruktionerna.

## Notering om scope

Del 1 (v1.4.1) är den omedelbara rättningen av det upplevda problemet. Del 2 (v1.5.0) är ett separat, större feature som bygger vidare på samma princip. Godkänn gärna omfattningen: implementera bara v1.4.1 nu, eller båda delarna i en följd?