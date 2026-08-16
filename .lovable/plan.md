# Issue #204 – Synliggör besök som väntar på ditt omdöme (UX-råd)

Endast konsultation. Ingen kod, ingen datamodellsändring: pending härleds i klienten ur
befintlig read-model (`currentUserParticipationStatus === "participant"` och inget eget
aktivt omdöme i `visibleReviews`), samma regel som `VisitReviewsSection` redan använder
för sin CTA.

## 1. Hierarki och placering på Hem

Rekommenderad ordning uppifrån:

1. `AppNudges` (oförändrad, enhetslokal push/installationshjälp)
2. **Ny pending-yta** — "Väntar på ditt omdöme"
3. Nästa stopp
4. Progress
5. Senast tillsammans
6. Aktivitet

Motivering: pending är verklig gruppdata om något som redan hänt och har en tydlig
avslutbar åtgärd, till skillnad från nudges. Den ska ligga ovanför "Nästa stopp" eftersom
den är färdigställande snarare än planerande — men den ska vara visuellt lättare än
Nästa stopp-kortet, som förblir vyns visuella huvudperson.

Viktigt: blanda inte in pending i `AppNudges` och ge den ingen 30-dagars-snooze. Ytan
försvinner av sig själv när omdömet finns eller när deltagandet korrigeras. Om ytan känns
för framträdande på Hem är alternativ B att lägga den direkt under Nästa stopp; undvik
placering längst ned, då tappar den sin funktion.

Ingen dismiss-knapp. En kompakt yta utan pending-data renderas inte alls.

## 2. Kompakt kort för 1 respektive flera pending-besök

Gemensam ram: en `Card rounded-2xl border-border/70 p-4`, med en liten
`text-xs font-medium tracking-wide text-muted-foreground`-etikett med `Star`-ikon
(samma mönster som "Nästa stopp"/"Senast tillsammans" använder).

**Exakt 1 pending:** en rad med platsnamn (`font-display text-lg`, `overflow-wrap:anywhere`),
under det datum + tillfälle i `text-sm text-muted-foreground`, och en enda primär
knapp `Lägg till ditt omdöme` full bredd (`min-h-11`) under. Inga stjärnor, ingen
gruppsummering — detta är en åtgärd, inte en sammanfattning.

**2–3 pending:** samma kortram, men listan är kompakta rader (delad Card-känsla med
`divide-y divide-border/60`): plats + datum i mittkolumnen, en liten sekundär knapp
`Ge omdöme` (`size="sm"`, min 44 px tryckyta) i högerkanten. Ingen primär full-breddsknapp
per rad, för att undvika en knappstapel.

**4+ pending:** visa de 2 senaste raderna och en textlänk
`Se alla N besök som väntar` som går till `/besok` (gärna med ett pending-filter i
befintlig sökparameter-stil). Ingen paginering, ingen egen vy, ingen feed.

Vid 360 px: rubrik och rader staplar naturligt; högerknappen får `shrink-0` och
namnet `min-w-0 truncate`. Inget kräver horisontell plats.

## 3. Markering i Besökshistoriken

Behåll dagens kort exakt som de är och lägg till markeringen på rad tre, i samma
område som deltagarpills, inte i rubrikraden:

- en liten `Badge variant="outline"` med texten `Ditt omdöme saknas`,
  `rounded-full text-[11px]`, låg färgvikt (border + `bg-secondary/60`, ingen accentfärg,
  ingen prick/röd markör).

Alternativt kan den ligga först i pill-raden så den läses i samma svep som deltagarna.
Den ska inte påverka kortets höjd nämnvärt och absolut inte konkurrera med platsnamn,
datum eller betygsblocket till höger. Ingen extra CTA i historikkortet — hela kortet är
redan klickbart och öppnar besöket.

## 4. Vad CTA från Hem bör öppna

Öppna **besöksdetaljen** (`/besok?visit=<id>`), inte reviewdialogen direkt.

Skäl: besöket är gemensam kontext. Användaren behöver ofta se datum, deltagare och
gängets omdömen innan hon sätter betyg, och kan därifrån även välja
"Jag var inte med". En dialog rakt på skulle be om betyg utan sammanhang och göra
"Jag var inte med" onåbar. Detaljen har redan en tydlig primär CTA i
"Gängets omdömen", så steget känns inte som en omväg.

Tillägg som gör hoppet smidigt utan ny UX-modell: när detaljen öppnas från en pending-yta
kan "Gängets omdömen"-sektionen scrollas in i vy (`scrollIntoView` på sektionen), så att
den egna CTA-raden syns direkt. Ingen auto-öppnad dialog — det bryter mot "ingen
blockerande modal".

## 5. Undvik tre konkurrerande CTA:er

Regel: **en åtgärdsknapp per vy, inte per yta.**

- Hem: knappen finns bara i pending-kortet.
- Besök (historik): endast en diskret badge, ingen knapp.
- Besöksdetalj: exakt den befintliga CTA:n i "Gängets omdömen"; ingenting nytt läggs till.

Dessutom: pending-kortet på Hem ska inte upprepas i "Senast tillsammans" även när det är
samma besök. Om det senaste besöket också är pending visar "Senast tillsammans" fortsatt
bara minnet — åtgärden ligger i pending-kortet ovanför. Det är den enda dubbleringsrisken
i dagens Hem-vy.

## 6. Copy-förslag (naturlig svenska)

- Etikett/rubrik Hem: `Väntar på ditt omdöme`
- Understödjande text vid 1: `Du var med på besöket – lägg gärna till din upplevelse.`
- Understödjande text vid flera: `Tre besök väntar på din upplevelse.` (siffra i klartext
  eller numeriskt, men samma mönster)
- Primär knapp: `Lägg till ditt omdöme` (samma ord som i besöksdetaljen)
- Sekundär radknapp vid flera: `Ge omdöme`
- Länk vid 4+: `Se alla besök som väntar`
- Badge i historiken: `Ditt omdöme saknas`
- Tomt läge: ingen text alls, ytan visas inte.

Undvik: "Du har X olästa", "Glöm inte", "Påminnelse", procent eller streak-språk. Tonen
ska vara inbjudande, inte krävande.

## Edge states och avgränsningar

- Deltagare med declined-status är aldrig pending.
- Registrerare som inte är deltagare är aldrig pending.
- Delade besök där progression är avstängd kan fortfarande vara pending om användaren är
  identifierad deltagare; texten ska inte antyda progression.
- Arkiverad grupp och skrivskyddad exempelgrupp visar ingen pending-yta med aktiv CTA.
- Exempelgruppen bör ha minst ett pending-besök så ytan är granskningsbar i demo, utan att
  ändra befintliga scenarier.
- Utanför scope: push, notiser, badge på flikar, blockerande modaler, ranking, ny
  datamodell.

## Teknisk skiss (för kommande implementation)

- Ren hjälpfunktion, t.ex. `pendingOwnReviewVisits(state)` i `src/lib/matrundan/`, med
  enhetstest; ingen DOM- eller routerberoende logik.
- Ny presentationskomponent `PendingOwnReviewCard` i `src/components/matrundan/`,
  renderad i `src/routes/index.tsx` mellan `AppNudges` och Nästa stopp.
- `src/routes/besok.tsx` får badgen via samma hjälpfunktion.
- Verifiering vid implementation: `bun run verify:agent` plus 360 px-kontroll.
