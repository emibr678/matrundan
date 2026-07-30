## Mål

1. Gör det självklart att ett besök kan följa med till dina andra grupper — alla andra aktiva grupper är förvalda.
2. Förtydliga att progression betyder "någon i gänget har provat", inte "alla har provat".

## Del 1 – Delning direkt i besöksdialogen

**Idag:** besöket sparas, sedan dyker en toast upp med "Lägg till i annan grupp" som lätt missas. Delning sker till en grupp i taget via `ShareVisitDialog`.

**Nytt flöde i `VisitDialog`:**
- När dialogen öppnas hämtas dina andra aktiva grupper (befintlig `list_visit_share_targets`-logik, men utan visit-id: se teknisk not nedan).
- Ett nytt avsnitt "Dela med dina andra grupper" visas ovanför sparaknappen med en kryssruta per grupp, **alla förvalda**.
- Kort hjälptext: "Besöket läggs till i dessa grupper. Ursprungsgrupp, privata kommentarer och andra gruppers medlemmar syns aldrig."
- Egen kommentar delas inte som standard (oförändrad integritetsregel); en enkel växel "Dela även min kommentar" visas bara om du skrivit en kommentar.
- Vid spara: besöket skapas en gång (kanoniskt) och delas sedan till varje ikryssad grupp via befintlig `share_visit_to_group`. Misslyckas en enskild delning sparas besöket ändå och en varning visas med vilka grupper som inte kunde uppdateras.
- Toast blir "Besök registrerat · tillagt i 2 grupper till". Den gamla toast-genvägen tas bort när avsnittet finns; "Lägg till i annan grupp" finns kvar i `VisitDetailSheet` för besök i efterhand.
- Om du inte är medlem i någon annan grupp visas inget avsnitt alls.

## Del 2 – Progressionscopy

Progressionen räknar redan ett ställe som provat så fort **någon** i gruppen varit där — den är korrekt, bara otydlig.

- Hem: hjälptext under progressbaren förtydligas, t.ex. "Ett ställe räknas som provat så fort någon i gänget varit där."
- `StatusBadge`: "X av Y har provat" behålls men får en tydligare läsning — statusen "Nytt för gruppen" respektive "Provat i gänget" (i stället för att "Alla har provat" känns som ett krav). Detaljvyn får en kort rad som förklarar att alla inte behöver besöka samma ställe.
- Inga ändringar i beräkningslogik, gamification eller databas.

## Tekniska noter

- Delmålslistan behöver hämtas **innan** besöket finns. Nuvarande RPC `list_visit_share_targets_v4b` kräver `_visit_id`. Enklaste hållbara lösningen utan ny RPC: spara besöket först (som idag) och därefter direkt läsa mållistan och dela till de förkryssade grupperna i samma sparaflöde. Kryssrutorna i dialogen fylls då från `list_user_groups_v4b` (dina aktiva grupper), och grupper där besöket redan är länkat filtreras bort efter sparandet.
- Inga schema- eller RLS-ändringar. Delning går fortsatt genom `share_visit_to_group` med serverkontrollerad medlemskapsvalidering och `source_group_id` server-only.
- 360 px verifieras för den utökade dialogen (Playwright-screenshot + scrollWidth-kontroll).
- Version bumpas till v1.4.0 med uppdaterad `version.ts`, in-app-historik och `CHANGELOG.md`; `bun run verify:changed` körs före leverans.
