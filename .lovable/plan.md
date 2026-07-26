# Kartgranskning — Matrundan v0.9.0

Ren produkt-, UX- och arkitekturbedömning. Inga kodändringar föreslås i detta steg — bara riktning och risker.

## 1. Sannolik rotorsak till den suddiga/instabila upplevelsen

Kärnproblemet är inte "en flagga fel" utan en kombination där **Leaflet raster + aggressiva prestandaflaggor + Geoapify raster + retina + mobilbrowser-throttling** samverkar illa:

- **`zoomAnimation:false` + `updateWhenZooming:false` + `updateWhenIdle:true`** är just den kombination som ger "grovt uppskalade tiles ligger kvar". Leaflet fryser den gamla tile-pyramiden under zoom, väntar tills interaktionen är "idle", och begär först då nya tiles. På Android där pinch/scroll-events kommer i skurar räknas kartan aldrig som helt idle → gamla tiles skalas upp med CSS-transform under lång tid. Detta är exakt symptomet du beskriver.
- **Retina @2x + Geoapify raster** dubblar bandbredd och dekodningstid per tile. Android Chrome komprimerar bilder aggressivt vid minnestryck vilket ger den "suddiga etikett"-känslan även när tiles nominellt är laddade.
- **Raster bright-style** har textetiketter inbakade i pixlar. Vid CSS-uppskalning under zoom blir all typografi oskarp — det finns ingen räddning i raster. Vektortiles renderar texten om vid varje zoomnivå och håller sig alltid skarp.
- **markercluster med `animate:false` + många re-renders av hela cluster-lagret** (effekten byggs om varje gång `selected` ändras, rad 375) skapar ryckighet när du klickar en markör.
- **`fitBounds` i `requestAnimationFrame` + samtidig `invalidateSize`** kan trigga dubbelrendering direkt efter mount, vilket förklarar den första "hoppiga" sekunden.
- Overlay-punktrastret (rad 411) ligger ovanpå kartan även när tiles laddats — små men reell perceptuell brus-källa på mobil.

Kort: nuvarande upplägg försöker mildra raster-tilesens svagheter med flaggor som i sin tur skapar just den effekt användaren rapporterar. Raster + Leaflet på mobil har nått taket för vad tuning kan göra.

## 2. Teknikval — rekommendation

**Byt till MapLibre GL JS med Geoapify vector tiles.** Motivering:

- Vektortiles → skarpa etiketter på alla zoomnivåer, ingen CSS-uppskalning under pinch.
- GPU-rendering via WebGL → mjuk pinch/pan även på Android mellanklass, inget "gamla tiles ligger kvar".
- Geoapify tillhandahåller färdiga vektorstilar (`osm-bright`, `positron`, `dark-matter`) via samma API-nyckel som redan används — ingen ny leverantör, ingen ny kostnadsmodell.
- MapLibre är öppen, aktivt underhållen fork av Mapbox GL v1, ~200 kB gzip, ingen licenslåsning.
- Markörer/kluster löses via `maplibre-gl` sources + `supercluster` (samma algoritm som markercluster men körd på main thread eller worker) eller det lättare `@maplibre/maplibre-gl-cluster`-mönstret. Kluster i vektormodellen är snabbare eftersom de är datalager, inte DOM-noder.

**Avfärdade alternativ:**
- *Fortsätta med Leaflet raster*: taket är nått, ytterligare flagg-tuning ger diminishing returns och mer specialfall att underhålla.
- *Geoapifys egen React-komponent*: den är en tunn wrapper runt Leaflet/MapLibre — ingen egen renderer. Ger inget utöver att välja underliggande bibliotek själv, men låser oss till deras versionscykel.
- *Google Maps / Mapbox*: prisstruktur, GDPR-friktion och en till leverantör att godkänna. Onödigt för Matrundans scope.
- *Bara statisk karta (Geoapify Static Maps API)*: skulle lösa stabilitet men bryter kravet på pan/zoom och "välj nästa stopp"-flödet.

Risker med bytet:
- Extra JS-payload (~200 kB gzip). Godtagbart eftersom kartan bara laddas via ClientOnly/lazy import.
- MapLibre kräver WebGL — extremt gammal enhet utan WebGL får då *ingen* karta. Mitigering: fallback till en enkel statisk lista (som redan finns via listvyn).
- Kluster-koden måste skrivas om — inte återanvändbar från markercluster.

## 3. UX per vy

### Matställen (`/matstallen`)

Nuvarande layout blandar två segmenterade kontroller (quick-filter + Lista/Karta) och en dold filter-sheet ovanför en `62vh` karta. På 360 px konsumerar chrome ~55 % av skärmen innan man ens ser kartan.

Rekommenderad riktning:
- **Karta = hel vy** när man valt karta: låt kartan fylla från precis under topbaren till botten, med filter/sök som ett *pillow* överst (flytande) och listan som ett **bottom sheet** i tre snap-lägen (peek 20 %, midi 50 %, full).
- **"Sök i det här området"-knapp** som dyker upp i toppen när kartan panorerats. Detta är standardmönstret på moderna karttjänster och passar direkt Matrundans "överblick"-syfte.
- **Valt kort** flyttas in i bottom-sheetets peek-läge istället för att ligga som ett svävande kort ovanpå kartan (som idag skymmer markörer runt Göteborgs stadskärna vid 360 px).
- **Klusterrendering**: behåll klustring, men lämna över ansvaret till maplibre-datalagret. Klick på kluster → smooth `easeTo` till bounds.

### Lägg till matställe-dialogen (`AddPlaceDialog`)

Kartvyn där är egentligen ett resultat-visualiseringsverktyg, inte en navigationskarta. Här är den nuvarande "Lista/Karta"-toggeln överflödig — resultaten är oftast 5–20 st inom valt sökområde.

Rekommenderad riktning:
- **Ta bort separat kartvy i dialogen.** Ersätt med en **kompakt statisk översikt** (statisk Geoapify Static Maps eller en icke-interaktiv MapLibre-instans, ~140 px hög) ovanför listan, som visar sökområdet och samtliga träffar som färgade prickar. Tap på prick → scrolla listan till motsvarande kort.
- Behåll radie-cirkel och centermarkör; ta bort pinch/pan i dialogens karta. Den ska inte konkurrera med listinteraktionen.
- Detta halverar komplexiteten i dialogen och tar bort en av två platser som lider av raster-suddigheten.

### Gemensamt
- Cap zoom till ~17 (redan gjort) men även **cap minZoom till 10** — Matrundan har ingen use case för världsöversikt och det sparar en hel del tile-requests.
- Ta bort dot-overlay-mönstret ovanpå kartan; det tillför inget när riktiga tiles renderar.
- Bibehåll 44 px touch-targets på alla kontroller, verifiera kart-chrome vid 360 px.

## 4. Minsta hållbara nästa steg vs överbyggnad

**Minsta hållbara (rekommenderat först):**
1. Ersätt Leaflet+raster med MapLibre GL + Geoapify vector `osm-bright`.
2. Portera markörer och kluster till maplibre-datalager (supercluster).
3. Behåll `PlaceMap`-komponentens API oförändrat (`items`, `selectedId`, `onSelect`, `onAction`, `center`, `radiusKm`) — inga callsite-ändringar i `matstallen.tsx` eller `AddPlaceDialogImpl.tsx`.
4. Byt dialogens karta till en kompakt, icke-interaktiv översikt.

Det är detta som löser den rapporterade rendering-instabiliteten. Ingenting mer behövs för att kartan ska kännas produktionsmässig.

**Ej i detta steg (överbyggnad just nu):**
- Bottom-sheet-arkitektur för Matställen. Bra idé, men gör det som en separat UX-iteration efter att renderingen är stabil, så vi inte blandar två stora omtag i samma PR.
- "Sök i det här området"-knappen. Kräver att listan har state kopplad till kartans bounds — separat produktbeslut, större scope.
- Egna kartstilar/design tokens i vector-stylen. Använd Geoapifys standardstil först; anpassa endast om det visar sig krocka med appens visuella språk.
- Offline-tiles, klustrings-worker, dark mode-karta. Inte relevant för Matrundans use case idag.

## 5. Rekommendation och risker

**Rekommendation:** Migrera `PlaceMap` till **MapLibre GL + Geoapify vector tiles** och förenkla `AddPlaceDialog` till en icke-interaktiv översikt. Släpp det som v0.9.1 (kart-stabilitet) utan att röra övrig UX.

**Största risker att kalibrera för:**
- **Bundle-storlek**: ~200 kB gzip extra. Måste laddas via dynamic import + ClientOnly (samma mönster som Leaflet idag), annars degraderas TTI för hela appen.
- **SSR/Worker-boundary**: MapLibre kräver `window` och WebGL — samma försiktighet som Leaflet har idag. Bekräfta att den bara importeras browser-side.
- **Klusterparitet**: markercluster ger vissa gratissaker (spiderfy vid maxzoom, coverage on hover) som inte finns färdiga i supercluster-vägen. Verifiera att Matrundan faktiskt använder dem — vid 360 px är spiderfy sällan värdefullt.
- **Test-observabiliteten**: nuvarande e2e-test (`tests/e2e/mobile-matstallen.spec.ts`) läser `.matrundan-cluster-icon` och `[data-cluster-count]`. Vid migration måste dessa selectors återskapas via maplibre-symbol-lager eller ersättas med data-attribut på canvas-nära DOM-noder. Utan detta går den mobila regressionsvakten sönder.
- **WebGL-avsaknad**: sällsynt men verkligt (gamla WebViews, användare med hårdvaruacceleration av). Fallback = listvy, ingen karta. Acceptabelt för Matrundan.
- **Geoapify vector-quotan**: raster och vector räknas separat i vissa planer. Verifiera att befintlig nyckel har vector-behörighet innan beslut.

**Icke-rekommendation:** att fortsätta finjustera Leaflet-raster-flaggor. Vi har uttömt den vägen, och varje ny flagga skapar ny specialfallsyta att underhålla utan att lösa grundproblemet (raster kan inte re-etikettera vid zoom).
