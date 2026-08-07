# Plan: Mindre UX-justeringar efter previewgranskning av PR #108

## Bakgrund

Read-only previewgranskningen av PR #108 / issue #108 identifierade inga blockerare, men två små förbättringar som förbättrar konsekvensen mellan förhandsdialogen och den ordinarie detaljsidan, särskilt vid 360 px:

1. **Webbplats-etikett**: I förhandsdialogen klipps "Webbplats ej angiven" till "Webbplats …" på smal skärm, medan detaljsidan redan använder den kortare etiketten "+ Webbplats". Samma korta etikett bör användas i dialogen.
2. **Rubrikstorlek på mobil**: "Päronträdets Trattoria" bryts till två rader i dialogens rubrikblock vid 360 px, vilket gör identitetsblocket märkbart högre. En något mindre rubrikstorlek på mobil skulle jämna ut höjden.

## Mål

Gör PR #108:s förhandsdialog mer konsekvent med den ordinarie detaljsidan och mer kompakt vid 360 px, utan att ändra någon funktionell logik eller lägga till nya funktioner.

## Tekniska åtgärder

### 1. Kortare webbplats-etikett i förhandsdialogen

- Fil: `src/components/matrundan/AddPlaceResultDialogsV16.tsx` (antaget placering för `PendingPlaceSummary`)
- Ändra etiketten för saknad webbplats från "Webbplats ej angiven" till "+ Webbplats" så den matchar detaljsidan och inte klipps på 360 px.
- Behåll befintlig klickbarhet för att lägga till/länka webbplats om sådan finns.

### 2. Jämnare rubrikstorlek på mobil

- Fil: samma komponent som ovan
- Justera rubrikstorleken för platsnamnet i förhandsdialogen så den är något mindre på smala skärmar (t.ex. `text-xl sm:text-2xl` istället för fast `text-2xl`), för att undvika tvåradig brytning av långa namn vid 360 px.
- Säkerställ att hierarkin (kategori över namn) och `PlaceIdentityMark`-stil bevaras.

## Avgränsningar

- Ingen ändring av sökresultatlistan (`SearchResultSectionsV16.tsx`) – den är redan kompakt och korrekt.
- Ingen ändring av den ordinarie detaljsidan (`src/routes/matstallen.$placeId.tsx`) – den är redan godkänd.
- Ingen ny funktionalitet, databasändring, migration eller publicering.

## Verifiering

1. Kör `bun run typecheck`.
2. Granska preview vid 360 px och desktop för:
   - Matställen → Lägg till ställe → sök "Päronträdets Trattoria" → öppna träffen.
   - Kontrollera att "+ Webbplats" visas konsekvent i dialogen.
   - Kontrollera att rubrikblocket inte är märkbart högre än tidigare.
   - Kontrollera att ingen horisontell overflow introduceras.
3. Jämför med den ordinarie detaljsidan för samma plats efter tillägg.

## Dokumentation

- Ingen dokumentationsuppdatering krävs för dessa små justeringar.
- PR #108 uppdateras med notis om justeringarna.
