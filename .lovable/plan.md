
# Delade besök mellan grupper — analys & rekommendation

Ingen kod, ingen migration, ingen versionsbump. Detta är beslutsunderlag inför nästa paket.

## 1. Produktprincip

**Ja, men som sekundär funktion — inte kärnflöde.** Kärnflödet förblir lägg till → välj → besök → betygsätt inom en grupp. Delning är en efterhandshandling på ett redan registrerat besök, inte en variant av besöksregistreringen. Att bygga in delning i själva registreringsdialogen skulle blåsa upp den mest använda vyn för ett kant-case.

**UX-benämning:** "**Lägg till i annan grupp**" på besöket. Undvik "Dela" (antyder social feed / publikt), "Importera" (antyder kopia), "Koppla" (för tekniskt). Formuleringen speglar att gruppen får besöket i sin historik utan att något dupliceras.

Motivering till att bygga det: det matchar en verklig situation (överlappande umgängen) och blockeras idag av datamodellen. Om vi inte löser det kommer användare att dubbelregistrera samma kväll i två grupper, vilket ger ihåliga betyg och trasig progression.

## 2. Datamodell

Rekommendation: **dela upp både `places` och `visits` i canonical + gruppspecifik del**. Detta är den enda modellen som skalar både till "samma ställe i flera grupper" och "samma besök i flera grupper" utan dubbelräkning.

```text
places_canonical
  id, provider ('geoapify'|'manual'), provider_place_id (nullable för manual),
  name, address, city, area, lat, lng, category (kanonisk),
  created_by, created_at
  UNIQUE (provider, provider_place_id) där provider_place_id IS NOT NULL

group_places  (ersätter dagens places-roll som "gruppens lista")
  id, group_id, place_id → places_canonical.id,
  cuisines[], occasions[], notes, photo_url, added_by, added_at
  UNIQUE (group_id, place_id)

visits  (blir gruppoberoende händelse)
  id, place_id → places_canonical.id,
  visited_on, meal_type, created_by, created_at
  (INGEN group_id längre)

visit_participants
  (visit_id, user_id) — deltagarfaktum, oberoende av grupp

reviews
  id, visit_id, user_id, overall, taste, value, service, comment
  UNIQUE (visit_id, user_id)  — en review per person per besök, återanvänds i alla grupper

visit_group_links  (kärnan i delningen)
  id, visit_id, group_id, linked_by, linked_at,
  is_origin bool  — true för gruppen där besöket först registrerades
  UNIQUE (visit_id, group_id)

groups
  ... + count_shared_visits_in_progression bool default true
       (gruppinställningen från §5)
```

Konsekvenser:
- Ett besök har alltid minst en `visit_group_links`-rad (origin). Att "ta bort kopplingen" = radera länken; besöket lever kvar så länge origin-länken finns.
- Att radera besöket helt får bara origin-länkens skapare/admin i origingruppen.
- Reviews är knutna till besöket, inte till grupp — samma review "syns" i alla länkade grupper men räknas bara där integritetsfiltret §3 släpper igenom den.
- Ett Geoapify-ställe får en enda canonical rad även när tio grupper sparat det.

**Autoskapa gruppens place-post?** Ja. När en användare lägger till besöket i målgrupp G och `group_places(G, place)` inte finns, skapa den automatiskt med defaultvärden (`added_by = linked_by`, `added_at = linked_at`, tomma cuisines/occasions/notes). Alternativet — "du måste först lägga till stället" — är onödig friktion när canonical-datan redan finns. Gruppen kan sedan redigera sin group_places-rad fritt.

## 3. Integritet och behörighet

**Vem får koppla?** Länkaren måste (a) vara medlem i målgruppen OCH (b) vara deltagare i besöket ELLER besökets `created_by`. Räcker som regel — övriga deltagare behöver inte godkänna, eftersom filtret nedan skyddar deras data.

**Vad ser målgruppen?**
- **Deltagare:** endast de som är nuvarande medlemmar i målgruppen listas med namn/avatar. Övriga döljs helt bakom en neutral rad "**+ N personer utanför gruppen**" — inte anonymiserade profiler (som lockar till gissning), inte helt osynliga (som gör betyg oförklarliga). Antalet är tillräckligt för kontext.
- **Reviews:** endast reviews från deltagare som är medlemmar i målgruppen. Övrigas kommentarer och betyg visas inte alls i målgruppens vy — de tillhör en annan grupps sammanhang.
- **Besöksdatum, måltid, ställe, gruppens egna medlemmars betyg:** synligt.

**Ta bort länken:** länkaren själv OCH målgruppens owner/admin. Origin-länken (`is_origin = true`) kan inte tas bort — bara besöket i sin helhet kan raderas, och då av origin-gruppens vanliga regler.

**Ex-medlemmar:** en review från någon som var medlem vid besökstillfället men lämnat gruppen — se §4.

## 4. Betyg och statistik

Regel för gruppens ställe-betyg och besökslistor:

> En review räknas i grupp G om (a) besöket är länkat till G och (b) reviewerns user_id finns i `memberships(G)` **just nu**.

Konsekvenser, medvetna:
- Lämnar en medlem gruppen försvinner hens bidrag från gruppens sammanställning framåt. Det är korrekt — gruppen är levande, inte ett arkiv. Historikvyn (enskilt besök) visar fortfarande att besöket ägde rum.
- Dubbelräkning omöjliggjord av `UNIQUE (visit_id, user_id)` på reviews och `UNIQUE (visit_id, group_id)` på länken.
- Om samma restaurang redan har egna besök i målgruppen räknas allt in — det är samma canonical place, alla besök därav i gruppens historik bidrar.

## 5. Progression, nivåer, badges

**Gruppinställning `count_shared_visits_in_progression`** (default: **på**). Motivering för default på: den vanligaste situationen är att gruppen faktiskt tycker "vi har varit där tillsammans, det räknas". Grupper som vill hålla progression strikt till egenregistrerade besök kan slå av.

**Per-besök-override:** nej. Kompliceras UX och öppnar för missbruk ("jag inkluderar mina, exkluderar dina"). Gruppnivå räcker.

När inställningen är **på**:
- Deltagande i länkade besök räknas mot medlemmars nivåer.
- Unika ställen och kategori-/kök-badges räknas.
- Ställe räknas som "besökt av gruppen".

När **av**:
- Länkade besök syns i historik och på ställets detaljvy, men räknas inte i nivåtröskel, badges eller "besökt av gruppen"-status.

**Dubbel-progression-skydd:** en medlem kan bara få progression från ett besök en gång per grupp (naturligt via `UNIQUE (visit_id, group_id)` i länken + unik user per visit_participants).

**Topplista:** stryks som primär vy även fortsatt. Grupphöjdpunkter (§ tidigare gamification-diskussion) står sig. Delade besök gör en klassisk leaderboard än mer missvisande, eftersom aktiviteten inte längre är jämförbar mellan medlemmar med olika grupptillhörigheter.

## 6. UX-flöde

Från besökets detaljvy (VisitDetailSheet):

1. Sekundär knapp: **"Lägg till i annan grupp"**. Visas bara om användaren är deltagare/skapare och är medlem i ≥1 annan grupp där besöket inte redan är länkat.
2. Bottom sheet listar bara valbara grupper. Grupper där besöket redan är länkat visas överst som "Redan tillagt" (disabled). Grupper där användaren saknar deltagande i besöket filtreras bort helt.
3. Förhandsvisning: "I *Fredagsgänget* kommer detta synas som besök på **Bar Central**, 12 sep, med **Emil, Karin**. + 1 person utanför gruppen. Din review räknas mot gruppens betyg." Vid `count_shared_visits_in_progression=false` byts sista meningen mot "Räknas inte mot gruppens progression."
4. Bekräfta → länken skapas, group_places autoskapas vid behov, "next-picked" påverkas ej, aktivitetsrad läggs i målgruppen: "*Emil* lade till ett besök på *Bar Central* från en annan grupp."
5. I målgruppen märks det med diskret chip "delat besök" på besökskortet.
6. **Ta bort:** samma sheet, "Ta bort från *Fredagsgänget*". Bekräftelsedialog: "Besöket finns kvar i *Emil & Karin*. Denna gruppens sammanställning uppdateras."

Kanter:
- Ställe finns redan i målgruppen → använd befintlig `group_places`-rad, ingen dubblett.
- Besöket redan länkat → knappen visar det, inget nytt anrop.

## 7. Migration

Additivt går, men **brytande är renare och rätt val nu** eftersom Paket 1–2 bara har testdata och v2-schemat annars bär group-centrerade kolumner för alltid. Konkret:

1. Ny migration: skapa `places_canonical`, `group_places`, `visit_group_links`, ny `visits`/`reviews` utan `group_id`.
2. Backfilla: varje befintlig `places`-rad → en `places_canonical` + en `group_places`. Varje `visits` → ny visits-rad + en `visit_group_links(is_origin=true)`. `reviews` tappar `group_id`/`place_id` (härleds via visit).
3. Dra tillbaka gamla `group_id`-kolumner och tabeller.
4. RPC:er (`create_place`, `create_visit_with_review`, `toggle_favorite`, `set_next_place`) skrivs om mot nya modellen. `create_visit_with_review` skapar också origin-länken.

Estimerat en migration + en RPC-omskrivning. Går att göra i ett steg utan mellantillstånd i klienten eftersom repository-lagret redan är centralt.

## 8. Paketering

**Delningsmodellen måste ligga före gamification.** Gamification räknar på ett datamodell-lager som ändras här — bygger vi badges/nivåer först får vi räkna om dem direkt efteråt.

Delningsmodellen ligger dock **inte** naturligt med inbjudningar/administration — de rör olika ytor och är oberoende. Föreslagen ordning:

- **Paket 3a: Inbjudningar & medlemsadministration** (som planerat A + B, minus gamification).
- **Paket 3b: Canonical places + delade besök** (schema-refaktor + UX).
- **Paket 4: Gamification** på det stabila schemat.

3a och 3b kan i praktiken parallelliseras eftersom ytorna inte överlappar, men 3b måste stängas före 4.

## 9. Slutlig rekommendation

- **Produktregel:** delning är en tillåten efterhandshandling på ett befintligt besök, aldrig en variant av besöksregistrering.
- **Datamodell:** `places_canonical` + `group_places`; gruppoberoende `visits` + `visit_group_links` med `is_origin`. Reviews knutna till visit + user, filtreras per grupp vid läsning.
- **Integritet:** endast deltagare som är nuvarande medlemmar i målgruppen visas namngivna och räknas; övriga aggregeras till "+N personer utanför gruppen". Ingen godkännande-flow.
- **Statistik:** review räknas där besöket är länkat och reviewern är medlem *nu*.
- **Progression:** gruppinställning `count_shared_visits_in_progression`, default på, ingen per-besök-override.
- **UX-benämning:** "Lägg till i annan grupp".
- **Implementeringsordning:** 3a Inbjudningar/admin → 3b Canonical places + delade besök → 4 Gamification.

## Öppna frågor att avgöra före implementation

1. **Default för gruppinställningen:** på eller av? (Rekommendation: på.)
2. **"+ N personer utanför gruppen":** visa antal exakt, eller bara "andra personer" utan siffra? (Siffra läcker inget i praktiken men är ett produktbeslut.)
3. **Ex-medlemmars bidrag:** verkligen försvinna framåt, eller frysas som "historisk medlem"? (Rekommendation: försvinna. Enklare, ärligare.)
4. **Radering av besök:** endast origin-gruppens skapare/admin, eller får senaste kvarvarande länkgrupp ta över? (Rekommendation: bara origin — enklare regel.)
5. **Brytande migration nu:** bekräfta att testdata i Paket 1–2 får rensas.
6. **Ska "Lägg till i annan grupp" kunna göras även av en deltagare som inte skapade besöket?** (Rekommendation: ja, om hen är deltagare och medlem i målgruppen.)

Bekräfta punkterna ovan så packeterar jag 3a och 3b som konkreta implementationsplaner.
