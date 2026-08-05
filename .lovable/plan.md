# UX-bedömning: matställets detaljkort (mobil 360–390 px)

Endast analys och rekommendation. Ingen kod, ingen migration, ingen publicering.
Avgränsat till frontend/presentation i `src/routes/matstallen.$placeId.tsx` och
`src/components/matrundan/PlaceLocationRefresh.tsx`.

## Vad koden faktiskt gör idag

Kortets topp är en `flex items-start gap-3` med `PlaceThumb size="detail"`
(h-16/h-20) till vänster och en textkolumn med kategori, `h1` och en villkorad
badgerad. **Adress och webbplats ligger utanför** flexraden, som ett eget block
under hela raden. Därför:

- Bilden är alltid 64–80 px hög, medan textkolumnen ofta bara är ca 46 px
  (kategori + ett namnrad). Skillnaden blir synligt tomrum till höger om bilden,
  och adressen börjar först under bilden.
- Badgen `Nästa stopp` renderas inne i textkolumnen och fyller bara delvis
  tomrummet, vilket gör att kortets höjd hoppar mellan tillstånd.
- `PlaceLocationRefresh` är en fullbredds `details`-rad ("Kontrollera kartdata")
  direkt under öppettider, alltså underhållsfunktion i den mest värdefulla ytan.

## Rekommendation 1 – stabil, kompakt topprad

Flytta adress och webbplats **in i samma textkolumn** som kategori och namn, och
byt flexraden mot ett grid som gör bilden till en egen kolumn:

- `grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3`
- kolumn 1: `PlaceThumb` med `shrink-0`
- kolumn 2: kategori → namn (`h1`, tillåt två rader, ingen truncate) → adressrad
  (Maps-länk, `[overflow-wrap:anywhere]`) → webbplatsrad endast när den finns.

Då blir textkolumnen alltid minst lika hög som bilden och tomrummet försvinner
oavsett om badgen finns. Långa namn/adresser växer nedåt i kolumnen istället för
att lämna hål. Saknad webbplats renderar ingen rad.

**"Nästa stopp":** lägg den som en liten överlappande badge nere till vänster på
bilden (`absolute -bottom-1 left-0` inuti thumbens `relative`-container, redan
`relative` idag). Bilden har fast höjd, så badgen tar noll extra höjd och
reserverar inget utrymme när den saknas. Alternativ om överlapp känns för
dekorativt: en badgerad **under** hela gridet, som renderas bara när minst en
badge finns — enkelt, men flyttar statusen längre från namnet.

`Inte längre i gruppens lista` (och ev. permanent stängt) bör inte överlappa
bilden, utan ligga i en villkorad rad under gridet: det är ett läge som
förtjänar full bredd och radbrytning.

Ingen konflikt med favoritknappen: den ligger i raden ovanför kortet och
påverkas inte. Överlappande badge håller sig inom kortets `overflow-hidden`.

## Rekommendation 2 – platsdatakontrollen som ikonknapp + sheet

Vedertaget mönster för sekundärt underhåll på mobil: **ikonknapp som öppnar ett
bottom-sheet** (samma `Sheet`-primitiv som redan används i projektet), inte
popover (för lite plats för jämförelse + två knappar) och inte permanent
details-rad.

- Placering: i öppettids-/webbplatsblockets högerkant, som en 44 px `ghost`
  ikonknapp bredvid den befintliga "Ändra"-ingången — alltså i praktisk
  metadata, inte i identiteten.
- Ikon: `RefreshCw` (synk/uppdatera). Undvik `MapPin`, den läses som "visa
  karta".
- Tillgängligt namn: `aria-label="Kontrollera adress och kartposition"`.
- Diskret tillstånd: när en avvikelse hittats, visa en liten prick/punkt eller
  texten `Ny adress` intill ikonen. Ikonen får inte i sig trigga externa anrop.
- Sheet-innehåll (oförändrad logik, bara flyttad): rubrik "Adress och
  kartposition", jämförelse "I Matrundan" / "I kartdatan", förklaringen att
  inget ändras automatiskt, `Använd ny adress` (endast ägare/admin), `Sök igen`
  och rapportvägen "Kartdatan stämmer inte".
- Återkoppling: laddning i sheetet ("Kontrollerar kartdatan…"), toast vid
  tillämpad adress som idag, `role="status"` på fel.
- Bevarat: hämtning sker först när sheetet öppnas; ikonen visas bara i live-läge
  med aktiv Geoapify-källa och `canReport`, så exempel-/demo-läge gör inga
  externa anrop och ser ingen ikon. Samma produktkomponent i alla lägen.

## Mobil-wireframe (360 px)

```text
← Tillbaka                                        [♡]
┌──────────────────────────────────────────────┐
│ ┌────────┐  CAFÉ                             │
│ │  🍰    │  Kafé Sjöstugan                   │
│ │ [⚑Nästa]  📍 Storgatan 12, Göteborg ↗      │
│ └────────┘  🌐 sjostugan.se ↗                │
│                                              │
│ 🕐 Öppettider · Öppet till 21   [Ändra] [⟳] │
├──────────────────────────────────────────────┤
│ 👥 ★★★★☆ 4,2 · 3 besök                       │
│    Senast 12 maj · Anna, Erik                │
├──────────────────────────────────────────────┤
│ [         Registrera besök igen        ] h-12│
│ [   ⚑ Föreslå som nästa stopp          ]     │
└──────────────────────────────────────────────┘
```

`[⟳]` = ikonknappen som öppnar sheetet nedan:

```text
╭─ Adress och kartposition ────────────────────╮
│ Inget ändras automatiskt. Jämför innan du    │
│ väljer.                                      │
│ I Matrundan:  Storgatan 12, Göteborg         │
│ I kartdatan:  Storgatan 12 A, Göteborg       │
│ [ Använd ny adress ]                         │
│ Kartdatan stämmer inte ·  Sök igen           │
╰──────────────────────────────────────────────╯
```

## Edge cases att täcka i genomförandet

- Saknad webbplats: ingen rad, ingen platshållare.
- Mycket långt namn: två rader tillåts; adressen behåller
  `[overflow-wrap:anywhere]`, inget horisontellt spill vid 360 px.
- Badge saknas: kortets höjd oförändrad (överlappande badge reserverar inget).
- Ej ägare/admin: sheetet visar förklaring istället för disabled-knapp.
- Ingen säker adress i kartdatan: bara rapportvägen i sheetet.
- Arkiverad grupp / borttaget ställe / exempelgrupp: ingen ikon, befintlig
  förklaringsruta oförändrad.

## Omfattning

Ren presentationsändring i två filer plus en liten sheet-komponent. Ingen
ändring av datamodell, RPC, behörighetsregler eller externa anrop.
