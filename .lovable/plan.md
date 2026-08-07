# Issue #148 – UX-bedömning: Lägg till matställe

## Verifierat läge

Checkouten står på Lovables arbetscommit `8936006` ("Work in progress"), inte
`8e3f9a6`. Innehållet stämmer däremot med PR-branchens nuläge: `place-search-intent.ts`
med `genericPlaceSearchSuggestions` finns, `SearchAreaControlsV16` finns med pills och
radie, och `PlaceDiscoveryV16` renderar i dag **Sök** (fritext) *före* `Sök i`. Bedömningen
nedan gäller den koden.

## Kort bedömning

Riktningen är rätt, och det viktigaste felet är just nu ordningen: fritextfältet ligger
först och sökområdena presenteras som en sekundär inställning. För en ny användare är
"var" den nödvändiga förutsättningen och "vad" den fria delen. Ingen ny designspråk
behövs – allt kan lösas med befintliga primitiv (Label, Input, pill, Select, popover).

## Rekommenderad informationshierarki

```text
Sök i                                   inom 2 km  ▾
[ Göteborg ✕ ] [ Majorna ✕ ] [ Lindholmen ✕ ]
+ Lägg till område eller adress
Ändringar här gäller bara den här sökningen.
────────────────────────────────────────────
Sök matställen
[🔍 Namn, kök eller typ                     ]
 ▸ autocomplete: Kök och typer / Matställen
────────────────────────────────────────────
Resultat (lista/karta, bulk) – oförändrat
```

1. `Sök i` först: rubrik, radie som kompakt inline-trigger till höger på samma rad,
   pills på egen rad, därefter den diskreta åtgärden `+ Lägg till område eller adress`.
2. Geo-autocomplete visas först när åtgärden aktiveras (och autofokuseras), inte som
   ett permanent fält. Vid fem områden ersätts åtgärden av dagens 5-av-5-status.
3. `Sök matställen` som eget block med tydlig egen label – aldrig bara "Sök".
4. Resultat, karta, bulkläge och platsdetaljer lämnas orörda.

## Spacing och kompakthet

- Blockavstånd `space-y-4` mellan `Sök i` och `Sök matställen`; internt `space-y-2`.
- Pills behåller nuvarande 32 px höjd med 44 px effektiv tryckyta via `after:-inset`.
- Radietriggern som `variant="ghost" size="sm"` med texten `inom 2 km`, höger­ställd på
  rubrikraden – begriplig men visuellt underordnad pills.
- Hjälptexten om att ändringar bara gäller sökningen flyttas under åtgärdsraden och
  visas bara när minst ett område finns, för att spara höjd vid 360 px.
- Långa adresser: fortsatt `truncate` + `title`, ingen wrap i pills.

## Autocomplete för matställen

Ett listbox med två grupper, generellt först eftersom det styr hela resultatlistan:

```text
Kök och typer
  🔍 Italienskt              Kök
  🔍 Café                    Typ
Matställen
  🍝 Trattoria Da Vinci      Linnégatan 12 · Göteborg
  ☕ Kafé Marmelad           Majorna · ~1 km
```

- `Kök och typer` = `genericPlaceSearchSuggestions(query)`, max 4, lupp-ikon och
  gruppetikett (`Kök`/`Inriktning`/`Typ`) som sekundär text.
- `Matställen` = befintliga `results` från samma providersökning (live: Geoapify multi,
  demo: `getPlacesProvider`), max 5, kategori-emoji + trovärdig rad av
  adress/område/ort med `distanceKm` som fallback. Inga separata provideranrop, och
  därmed inga externa anrop i demo.
- Val i `Kök och typer` sätter query-texten och kör vanlig sökning.
- Val i `Matställen` filtrerar bara listan till den träffen (eller markerar den och
  scrollar till den) – det får **aldrig** röra `selectedAreaIds`, `temporaryAreas` eller
  `radiusKm`.
- Tillstånd: `Söker…` när `loading`, `Inga träffar` när båda grupperna är tomma,
  och vid providerfel visas bara `Kök och typer` (felet ägs av resultatlistan).
- Query som matchar både typ och verksamhetsnamn visar båda grupperna; generellt först.

## Tillgänglighet och 360 px

- Återanvänd combobox-kontraktet från `GeoapifyLocationInput`: `role="combobox"`,
  `aria-expanded`, `aria-controls`, `aria-activedescendant`, ArrowUp/Down över båda
  grupperna, Enter väljer, Escape stänger.
- Gruppera med `role="group"` + `aria-label`, rubrikerna som icke-fokuserbara rader.
- Listan renderas absolut positionerad inom `relative min-w-0`-wrapper med `w-full`,
  ingen egen bredd, så 360 px inte ger horisontell overflow.

## Vad Agent mode bör ändra

- `src/components/matrundan/PlaceDiscoveryV16.tsx`: byt ordning så
  `SearchAreaControlsV16` renderas före fritextblocket; byt label till
  `Sök matställen`; ersätt råa `Input` med den nya autocomplete-komponenten och skicka
  in `results`/`loading` som specifika förslag.
- `src/components/matrundan/SearchAreaControlsV16.tsx`: rubrikrad `Sök i` med
  inline-radie, pills direkt under, geo-fältet bakom `+ Lägg till område eller adress`
  som togglas i lokalt state och autofokuseras; behåll dagens 5-av-5-status och
  toast-regler.
- `src/components/matrundan/SearchAreaPill.tsx`: oförändrad.
- Ny `src/components/matrundan/PlaceSearchInput.tsx`: presentationskomponent för
  fältet + grupperad listbox, utan egna dataanrop.
- Uppdatera `src/components/matrundan/place-discovery-search-flow-ui-contract.test.ts`
  och `search-area-settings-ui-contract.test.ts` för ny ordning och gruppetiketter.

Ingen backend-, RPC- eller databasändring. Ingen boundary/polygon (#149).
