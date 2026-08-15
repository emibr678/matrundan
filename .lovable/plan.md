# Issue #203 – Samla deltagaromdömen i en tydlig besöksvy (UX-rekommendation)

Endast UX-konsultation. Ingen kod, inga migrationer, ingen datamodellsändring: allt nedan
kan byggas på befintliga `Visit.visibleReviews`, `Visit.participants`,
`currentUserParticipationStatus` och befintliga dialoger (`AddVisitReviewDialog`,
`DemoAddVisitReviewDialog`, `EditReviewDialog`, `VisitParticipationControls`).

## 1. Informationshierarki i VisitDetailSheet

Ordning uppifrån, tre mentala steg:

**Vad hände?**
1. Header (oförändrad): Besök-etikett, badges (Delat besök / Utanför progression), platsnamn, adress.
2. Foto (`VisitPhotoManager`).
3. Besökskort: registrerare + måltid/datum (som idag), men **utan** stort betyg i kortet.
4. Deltagarpills + gästnotis (som idag).

**Vad tyckte deltagarna?**
5. Ny sammanhållen sektion **"Gängets omdömen"**:
   - Sammanfattningsrad: stjärnor + snitt helhet, och statusrad "3 av 4 deltagare har lämnat omdöme".
   - Kompakt snittrad för Smak / Prisvärt / Service (ersätter dagens separata "Detaljbetyg").
   - Lista med individuella deltagaromdömen, eget omdöme inkluderat.
   - Egen CTA-rad först i listan när eget omdöme saknas.

**Behöver jag göra något?**
6. Sekundära åtgärder samlade sist: "Till stället", "Lägg till i annan grupp",
   destruktiva åtgärder, och deltagarkorrigering (se punkt 3).

Tas bort som egna block: "Detaljbetyg", "Kommentar från gänget", "Ditt omdöme",
"Din synlighet" och rubriken "Din medverkan". Visitens sammanfattande `comment`
visas endast om den inte redan finns som en reviewkommentar (samma dedupe-regel som
`ownCommentDuplicatesVisitComment`, generaliserad mot alla synliga reviews) och då
som en diskret rad under sammanfattningen, inte som eget kort med rubrik.

## 2. Komprimeringsnivå för reviewkort på mobil (360 px)

Ett reviewkort = en rad i en delad `Card` (inte en egen `Card` per person):
`divide-y divide-border/60` inuti en rounded-2xl-Card, `p-3` per rad.

Radlayout: `grid grid-cols-[2rem_minmax(0,1fr)_auto]`
- avatar-emoji (2rem, inget stort cirkelfält),
- namn (`truncate`) + ev. diskret `Du`-badge,
- stjärnor size 13 + siffra `text-xs`.

Kommentar hamnar på rad två i mittkolumnen, `text-sm text-muted-foreground`,
`line-clamp-3` med "Visa mer" endast när texten klipps. Detaljbetyg per person
visas inte som standard (se punkt 4). Ingen inre nästlad Card, inga ikoner per rad
utöver ev. `MessageCircle` för synlighetsstatus. Detta ger ~64–90 px per omdöme
istället för dagens kortstapel, och inget kräver horisontell plats.

## 3. Egen CTA och deltagarkorrigering

**Saknas eget omdöme och du är deltagare:** första raden i listan är din egen rad:
avatar + "Du" + kort text "Du har inte lämnat omdöme än" + en enda primär knapp
"Lägg till ditt omdöme" (`size="sm"`, höger i raden på ≥390 px, egen rad under texten
på 360 px, min 44 px höjd). Ingen andra CTA någon annanstans i vyn.

**Finns eget omdöme:** vanlig deltagarrad med diskret `Du`-badge. Under raden en
sekundär kontrollrad: `EditReviewDialog`-trigger som liten länkknapp "Ändra"
plus, i live-läge med kommentar, en kompakt switch-rad
"Visa min kommentar i gruppen" med hjälptext `text-[11px]`. Dessa hör till din rad
och ska inte bli en egen sektion.

**Deltagarkorrigering:** "Jag var inte med" flyttas ned till de sekundära åtgärderna
längst ned som `variant="ghost"`, låg visuell vikt, samma bekräftelsedialog som idag.
Declined-status är däremot avvikande och ska vara tydlig: behåll ett litet
`bg-secondary/30`-kort direkt ovanför "Gängets omdömen" med förklaring och
"Jag var med"-knappen — men utan rubriken "Din medverkan".

## 4. Detaljbetyg och kommentarer vid 3+ omdömen

- Detaljbetyg visas primärt som **gruppsnitt** i sammanfattningen (Smak / Prisvärt /
  Service, tre kolumner, samma `Detail`-uttryck som idag men mindre).
- Per person visas detaljbetyg bara på begäran: hela raden är expanderbar
  (`Collapsible`, chevron i högerkanten) och expanderad rad visar de tre siffrorna
  plus full kommentar.
- Lista utan expanderade rader ger en läsbar stapel även vid 5–8 omdömen.
- Vid fler än 4 omdömen: visa 4 rader och "Visa alla N omdömen" som textknapp under
  listan (ingen egen vy, ingen paginering).
- Sortering: din egen rad först (både med och utan omdöme), därefter omdömen efter
  datum/ordning som idag; deltagare utan omdöme listas inte som tomma rader — de
  representeras av räknaren "3 av 4".

## 5. Edge states

- **0 omdömen, du är deltagare:** sammanfattningen visar "Inga omdömen ännu" utan
  stjärnor eller snitt, och listan består bara av din CTA-rad.
- **0 omdömen, du är inte deltagare:** "Inga omdömen ännu från gänget." Ingen CTA.
- **Registrerare men inte deltagare:** besökskortet visar fortsatt
  "X registrerade"; ingen CTA, ingen "Jag var inte med", ingen egen rad i listan.
  Copy ska inte antyda att registreringen ger progression.
- **Declined:** kort enligt punkt 3, sammanfattningen visas normalt, egen rad och CTA
  visas inte alls.
- **Endast dolda omdömen (`ratingVisible`/`commentVisible` false):** räknaren räknar
  bara omdömen gruppen får se; om inget är synligt men omdömen finns visas
  "Inga omdömen är synliga i den här gruppen."
- **Delat besök:** anonyma deltagare fortsätter visas som `+N utanför gruppen` i
  deltagarpills och påverkar inte "x av y"-räknaren.

## 6. Risker att undvika

- Att bara byta rubriker: om "Ditt omdöme" och "Kommentar från gänget" behålls som
  separata block kvarstår röran även med ny sektion.
- Dubbla CTA:er (t.ex. både i din rad och i sekundära åtgärder) — max en primär.
- Ett `Card` per omdöme; det är källan till dagens jättestapel.
- Att `visit.overall`, `visit.taste/value/service` och reviewsnitt visar två
  konkurrerande sanningar. Sammanfattningen ska ha en tydlig källa och samma tal ska
  inte upprepas i besökskortet.
- Att gömma declined-status som en liten rad; avvikande status behöver vikt.
- Att göra "Jag var inte med" så framträdande att den läses som primär åtgärd.
- Overflow på 360 px från långa svenska namn/kommentarer utan `truncate`/`min-w-0`.
- Att förlora tillgänglighet: expanderbara rader behöver `aria-expanded`, switchen sin
  `Label`, och 44 px tryckyta för knappar.
- Att förändra progressionsregler eller ranking; detta är rent presentationsarbete.

## Demo/exempeldata (förberedelse för implementation)

`src/lib/matrundan/example-scenarios.ts` behöver minst ett besök med **tre** faktiska
deltagaromdömen (varierade detaljbetyg, en utan kommentar, en dold kommentar) så att
3+-läget och komprimeringen kan granskas. Befintliga scenarier för
participant-without-review, registrar-not-participant, declined och no-active-reviews
behålls oförändrade; motsvarande kontraktstester uppdateras bara med det nya besöket.

## Teknisk sammanfattning

- Ny presentationskomponent, t.ex. `src/components/matrundan/VisitReviewsSection.tsx`,
  som tar `visit`, `place`, `currentUserId` och renderar sammanfattning + rader.
- `VisitParticipationControls` bantas till declined-kortet plus ghost-knappen och
  slutar äga CTA för nytt omdöme; CTA flyttas in i den nya sektionen.
- Aggregat (antal deltagare med omdöme, snitt per dimension) beräknas i en ren
  hjälpfunktion i `src/lib/matrundan/` med enhetstest, inte inline i JSX.
- Verifiering vid implementation: `bun run verify:agent` plus 360 px-kontroll.
