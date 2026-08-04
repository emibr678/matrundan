# UX-granskning: matställets detaljvy (mobil, 360 px)

Endast analys. Ingen kod, ingen migration, ingen publicering.

Granskad kod: `src/routes/matstallen.$placeId.tsx`, `PlaceExternalInfo.tsx`,
`PlacePracticalInfoDialog.tsx` (trigger "Ändra"), `PlaceAdminDialog.tsx`
(trigger med aria-label "Ändra gruppens uppgifter om stället"),
`StatusBadge.tsx`, `PlaceCard.tsx`.

## Vad som fungerar idag

- Tydlig identitet högst upp: kategori, namn, klickbar adress till Maps, status.
- "Registrera besök" är en riktig primärknapp (h-12, full bredd) och står före
  sekundära handlingar.
- Betygsblocket visas bara när det finns betyg; besökslistan är rik utan att
  läcka annan grupps data, och externa deltagare visas som anonym räknare.
- Öppettider ligger redan i en kollapsad `details`, praktiska uppgifter ändras
  aldrig automatiskt utan via en jämförelsedialog.
- Skrivskyddade lägen (exempelgrupp, arkiverad grupp, borttaget ställe) har
  förklarande copy istället för döda knappar.
- Touchmål är genomgående minst 44 px och adressen bryter med
  `overflow-wrap:anywhere`.

## Prioriterade UX-problem

1. **Hög (kärnsyfte).** Metadatablocket "Webbplats och öppettider" ligger mellan
   ställets identitet och gruppens handlingar. På 360 px trycker rubrikrad +
   Ändra-knapp + webbplatsrad + öppettidsrad (ca 4 rader plus två avgränsare)
   ned "Registrera besök" under fold. Stödinformation dominerar beslutet.
2. **Hög.** Grupphistoriken syns för sent. Ett tidigare besökt ställe visar
   ingen sammanfattning ("3 besök, senast 12 maj med Anna och Erik") ovanför
   fold; betygssiffran finns men inte relationen till gänget.
3. **Medel–hög.** Två separata redigeringsingångar ("Ändra" i praktiska
   uppgifter, ikonknapp i "Om stället") splittrar redigeringsmodellen. Användaren
   måste veta i vilken sektion ett fält bor för att hitta rätt ingång.
4. **Medel.** Webbplats visas som en hel rad även när den saknas ("Saknas"),
   liksom öppettider. Tomma fält kostar lika mycket vertikal plats som ifyllda.
5. **Medel.** "Föreslå som nästa stopp" och "Favorit" har samma vikt
   (`outline` + `outline`) trots att de hör till olika nivåer: nästa stopp är ett
   gruppbeslut, favorit är privat. Långa svenska labels tvingar dessutom
   radbrytning i tvåkolumnsrutnätet.
6. **Medel.** Primärknappen är identisk för nytt och tidigare besökt ställe.
   För ett ställe med besökshistorik är "Registrera besök igen" den ärligare
   formuleringen.
7. **Låg–medel.** Statusbrickan (`Nytt för gruppen` / `2 av 4 har provat`)
   dubblerar delvis information som senare upprepas i besökssektionen.
8. **Låg.** Konfliktraden "Det finns nya uppgifter om stället" och
   cross-group-förslagen ligger i identitetskortet, alltså i den mest värdefulla
   ytan, trots att de är underhållsarbete.
9. **Låg.** "Rapportera felaktig information" ligger korrekt sist, men saknar
   koppling till den nya samlade redigeringsingången.

## Rekommenderad innehållsordning (topp → botten)

1. Tillbaka
2. Identitetskort: kategori · namn · adress (Maps-länk) · status/nästa stopp
3. Gruppens relation, en till två kompakta rader: betyg + antal besök + senaste
   besöket med deltagare (eller "Ingen i gänget har varit här än")
4. Primär handling: "Registrera besök" / "Registrera besök igen"
5. Gruppbeslut: "Föreslå som nästa stopp" (outline, full bredd)
6. Privat: "Favorit" (ghost/ikon, mindre vikt)
7. Praktiskt: en kollapsad rad "Webbplats och öppettider · Öppet till 21"
8. Besök (lista)
9. Om stället (kök, tillfällen, anteckning, tillagt av) med samlad
   redigeringsingång
10. Betygsdetaljer
11. Underhåll: nya uppgifter/jämför, cross-group-förslag, rapportera fel

## Textbaserat wireframe (360 px)

```text
← Tillbaka
┌──────────────────────────────────────────┐
│ CAFÉ                                     │
│ Kafé Sjöstugan                    [ 🍰 ] │
│ 📍 Storgatan 12, Göteborg ↗              │
│ [Nytt för gruppen]  [⚑ Nästa stopp]      │
├──────────────────────────────────────────┤
│ ★★★★☆ 4,2 · 3 besök                      │
│ Senast 12 maj · Anna, Erik +1            │
├──────────────────────────────────────────┤
│ [        Registrera besök        ]  h-12 │
│ [  ⚑ Föreslå som nästa stopp     ]  full │
│ ♡ Favorit                          ghost │
├──────────────────────────────────────────┤
│ 🌐 Webbplats och öppettider   Öppet 21 ⌄ │  ← kollapsad
└──────────────────────────────────────────┘

Besök (3)                       [lista som idag]

Om stället                              [✎]
  kök · tillfällen · anteckning · tillagt av

Betygsdetaljer

⚠ Det finns nya uppgifter om stället  Jämför
Rapportera felaktig information
```

## Synlighetsnivåer

- **Alltid synligt:** namn, kategori, adress, status, gruppens betyg/besöksrad,
  primärknappen, "Föreslå som nästa stopp".
- **Kompakt:** favorit (ikon + text i ghost), öppet-nu-sammanfattning i den
  kollapsade radens högerkant.
- **Kollapsat:** hela "Webbplats och öppettider" inklusive veckoschema,
  källhänvisning och Ändra.
- **Längre ned:** konfliktrad, cross-group-förslag, rapportering, betygsdetaljer.

## Edge cases

- Saknas både webbplats och öppettider: visa ingen egen rad, bara en dämpad
  textlänk "Lägg till webbplats och öppettider" när användaren får redigera.
- Saknas ett av två: visa den kollapsade raden med det som finns; det tomma
  fältet syns först inne i panelen.
- Stängt idag / kan ha stängt permanent: sammanfattningen visar "Stängt idag";
  permanent-stängt-signalen behåller sin nuvarande amber-behandling och ska
  ligga i identitetskortet, inte i den kollapsade panelen.
- Flera besök: besöksraden visar senaste + totalantal; ingen ny lista.
- Långa namn/adresser: rubrik i två rader tillåts (ingen truncate på
  detaljsidan), adress behåller `overflow-wrap:anywhere`.
- Extern deltagare: fortsatt "+N utanför gruppen" i besökslistan, aldrig i
  toppsammanfattningen.
- Admin vs medlem: samma layout; redigeringsikonen och Ändra-vägen döljs för den
  som saknar rättighet, ingen disabled-knapp.
- Exempelgrupp vs livegrupp: befintlig förklaringsruta behålls men flyttas
  under primärytan så exempelgruppen får samma läsordning som livegruppen.

## Alternativ med verkliga tradeoffs

- **Kollapsad praktisk panel** (rekommenderas) sparar mest höjd men lägger ett
  klick på öppettider. Alternativ: behåll öppettidsraden synlig och kollapsa
  bara webbplats — mindre vinst, ingen extra kostnad.
- **Slå ihop redigeringsingångarna till en** ger en begriplig modell men gör
  dialogen större. Alternativ: behåll två dialoger men flytta båda triggarna
  till samma ikonknapp i "Om stället" med en enkel valmeny.
- **Favorit som ren ikon** sparar en rad men blir mindre upptäckbar; behåll
  därför text vid ikonen.

## Minsta förbättringspaket kontra omstrukturering

**Minsta paket (rekommenderat först, ren presentationsändring):**

1. Flytta "Webbplats och öppettider" nedanför handlingsblocket och gör hela
   sektionen kollapsad med sammanfattning i huvudraden.
2. Lägg till en kompakt grupprelationsrad (betyg · antal besök · senaste besök
   med deltagare) direkt under identiteten.
3. Gör "Föreslå som nästa stopp" full bredd och sänk favorit till ghost.
4. Dölj tomma webbplats-/öppettidsrader.
5. Anpassa primärknappens copy för tidigare besökta ställen.

Detta ger uppskattat 4–6 färre rader ovanför fold och håller sig inom
frontend/presentation, utan datamodell- eller RPC-ändring.

**Större omstrukturering (avvakta):** samlad redigeringsmodell för alla
gruppuppgifter och en egen underhållsvy för konflikter/cross-group-förslag.
Rör fler dialoger och behörighetsvillkor och bör hanteras som eget paket efter
att det minsta paketet är verifierat på 360 px.
