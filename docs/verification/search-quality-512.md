# Verifieringsunderlag för sökkatalogen — Issue #512

24 oktober 2026. Baslinje: main `ead5a34a717004a22c60c4ab9dd57a81d201d34f`. Implementationen granskas i [PR #515](https://github.com/emibr678/matrundan/pull/515). Aktuell exact-head-CI, preview, interaktiva stagingprov och eventuella mergeblockerare redovisas i PR-kvittot. Ingen merge, databasdriftsättning, Lovable-synk eller publicering ingår.

## Metod och vad siffrorna betyder

Återspelning av redan insamlade `matrundan-geoapify-komplettering-3.json` (23 oktober), SHA-256 `240e37764b753c72498cf1da805bb01cb270f4d8f77d04076a1c0403ac0df83a`. Inga nya provideranrop görs av verifieringsscriptet. Sex 2-km-områden: Södermalm, Enskede, Göteborg, Malmö, Uppsala och Värnamo.

Observerade svar förenas per område på Geoapify-ID. Kandidatpoolerna sorteras på approximativt avstånd och filtreras/pagineras enligt begärd kategori. Detta är en rekonstruerad, begränsad observationspool, **inte** en inspelning av de nya unionernas framtida API-ordning. Tabellen summerar område × provider-ID; samma verksamhet kan ha flera ID:n och förekomma i flera områden. Därför skiljer sig talen från tidigare analys med heuristisk platsgruppering. Den heuristiken används inte som produktidentitet.

Serverns verkliga discovery-handler, normalisering, cache, budget och cursor körs för både main och kandidaten med isolerade HTTP-/RPC-fixtures. Kanoniska RPC-fixtures är tomma i kvantitetsjämförelsen. Jämförelsen använder gamla etiketter för oförändrade historiska ID:n; nya avsikter markeras som ej erbjudna i main.

Källstöd räknas med deklarerade kategorier, explicita cuisine-token och endast explicita `.only`-profiler. Källöverensstämmelse är ingen oberoende menybedömning eller global precision/recall. De fasta regressionerna testar dessutom positiva och negativa kontrastfall, namnassociationer, historiska etiketter och verkliga exportexempel. Namnlösa objekt avvisas av normaliseringen och räknas separat.

## Fullständig täckningsmatris

38 huvudval + 42 kompletterande direktval + känd Matvagn. ”Första” avser ett serversteg per område: upp till 20 direktträffar och högst en 50-sida metadata. UI visar 20 handlingsbara rader och buffrar resten. ”Forts.” avser uttryckliga fortsättningssteg tills den observerade poolen tar slut (högst 100 steg i detta prov). Ingen automatisk bakgrundsskanning görs för strukturerade val.

| Begrepp | Yta | Strategiklass | Källstödda namngivna ID:n | Main första | Kandidat första | Kandidat forts. | Kvar missade |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| Restaurang | Huvudval | Direkt typ | 2304 | 120 | 120 | 2304 | 0 |
| Café | Huvudval | Direkt typ | 655 | 113 | 113 | 655 | 0 |
| Bageri | Huvudval | Direkt typ | 121 | 85 | 85 | 121 | 0 |
| Snabbmat | Huvudval | Direkt typ | 635 | 99 | 99 | 635 | 0 |
| Pub och bar | Huvudval | Uttalad union/familj | 272 | 77 | 91 | 272 | 0 |
| Svenskt | Huvudval | Direkt + metadata | 38 | Ej val | 24 | 38 | 0 |
| Italienskt | Huvudval | Direkt + metadata | 207 | 90 | 91 | 207 | 0 |
| Japanskt | Huvudval | Direkt + metadata | 93 | 68 | 70 | 93 | 0 |
| Koreanskt | Huvudval | Direkt + metadata | 20 | 16 | 16 | 20 | 0 |
| Kinesiskt | Huvudval | Direkt + metadata | 68 | 58 | 58 | 68 | 0 |
| Thailändskt | Huvudval | Direkt + metadata | 108 | 62 | 74 | 108 | 0 |
| Vietnamesiskt | Huvudval | Direkt + metadata | 45 | 40 | 40 | 45 | 0 |
| Indiskt | Huvudval | Direkt + metadata | 133 | 82 | 82 | 133 | 0 |
| Mellanöstern | Huvudval | Uttalad union/familj | 91 | 2 | 57 | 91 | 0 |
| Libanesiskt | Huvudval | Direkt + metadata | 28 | Ej val | 24 | 28 | 0 |
| Mexikanskt | Huvudval | Direkt + metadata | 43 | Ej val | 35 | 43 | 0 |
| Medelhavsmat | Huvudval | Direkt + metadata | 13 | 6 | 6 | 13 | 0 |
| Grekiskt | Huvudval | Direkt + metadata | 48 | 38 | 42 | 48 | 0 |
| Franskt | Huvudval | Direkt + metadata | 26 | 22 | 22 | 26 | 0 |
| Spanskt | Huvudval | Direkt + metadata | 15 | 12 | 12 | 15 | 0 |
| Amerikanskt | Huvudval | Direkt + metadata | 22 | 16 | 16 | 22 | 0 |
| Persiskt | Huvudval | Direkt + metadata | 21 | 18 | 18 | 21 | 0 |
| Asiatiskt | Huvudval | Uttalad union/familj | 431 | Ej val | 110 | 431 | 0 |
| Pizza | Huvudval | Direkt + metadata | 369 | 114 | 127 | 369 | 0 |
| Burgare | Huvudval | Direkt + metadata | 263 | 90 | 97 | 263 | 0 |
| Sushi | Huvudval | Direkt + metadata | 191 | 90 | 104 | 191 | 0 |
| Ramen | Huvudval | Direkt + metadata | 26 | 24 | 24 | 26 | 0 |
| Pasta | Huvudval | Råmetadata | 18 | 1 | 2 | 18 | 0 |
| Kebab | Huvudval | Direkt + metadata | 121 | Ej val | 70 | 121 | 0 |
| Falafel | Huvudval | Råmetadata | 37 | 1 | 10 | 37 | 0 |
| Sallad | Huvudval | Direkt + metadata | 46 | Ej val | 11 | 46 | 0 |
| Smörgåsar | Huvudval | Direkt + metadata | 82 | Ej val | 40 | 82 | 0 |
| Grillat/BBQ | Huvudval | Direkt + metadata | 26 | 4 | 9 | 26 | 0 |
| Fisk och skaldjur | Huvudval | Direkt + metadata | 39 | 14 | 22 | 39 | 0 |
| Tapas | Huvudval | Direkt + metadata | 34 | 30 | 30 | 34 | 0 |
| Fika | Huvudval | Uttalad union/familj | 748 | 0 | 116 | 748 | 0 |
| Helt vegetariskt | Huvudval | Renodlad profil | 26 | Ej val | 26 | 26 | 0 |
| Helt veganskt | Huvudval | Renodlad profil | 27 | Ej val | 27 | 27 | 0 |
| Turkiskt | Komplement | Direkt + metadata | 14 | Ej val | 6 | 14 | 0 |
| Etiopiskt | Komplement | Direkt + metadata | 6 | Ej val | 6 | 6 | 0 |
| Afrikanskt | Komplement | Direkt + metadata | 5 | Ej val | 2 | 5 | 0 |
| Tyskt | Komplement | Direkt + metadata | 2 | Ej val | 1 | 2 | 0 |
| Danskt | Komplement | Direkt + metadata | 1 | Ej val | 1 | 1 | 0 |
| Portugisiskt | Komplement | Direkt + metadata | 2 | Ej val | 1 | 2 | 0 |
| Brasilianskt | Komplement | Direkt + metadata | 1 | Ej val | 1 | 1 | 0 |
| Peruanskt | Komplement | Direkt + metadata | 4 | Ej val | 3 | 4 | 0 |
| Argentinskt | Komplement | Direkt + metadata | 0 | Ej val | 0 | 0 | 0 |
| Karibiskt | Komplement | Direkt + metadata | 1 | Ej val | 0 | 1 | 0 |
| Pakistanskt | Komplement | Direkt + metadata | 1 | Ej val | 1 | 1 | 0 |
| Afghanskt | Komplement | Direkt + metadata | 3 | Ej val | 0 | 3 | 0 |
| Indonesiskt | Komplement | Direkt + metadata | 3 | Ej val | 2 | 3 | 0 |
| Malaysiskt | Komplement | Direkt + metadata | 0 | Ej val | 0 | 0 | 0 |
| Filippinskt | Komplement | Direkt + metadata | 0 | Ej val | 0 | 0 | 0 |
| Österrikiskt | Komplement | Direkt + metadata | 1 | Ej val | 1 | 1 | 0 |
| Ryskt | Komplement | Direkt + metadata | 2 | Ej val | 0 | 2 | 0 |
| Latinamerikanskt | Komplement | Direkt + metadata | 1 | Ej val | 0 | 1 | 0 |
| Europeiskt | Komplement | Direkt + metadata | 3 | Ej val | 2 | 3 | 0 |
| Internationellt | Komplement | Direkt + metadata | 45 | 30 | 31 | 45 | 0 |
| Steakhouse | Komplement | Direkt + metadata | 12 | Ej val | 11 | 12 | 0 |
| Mathall/food court | Komplement | Direkt + metadata | 0 | Ej val | 0 | 0 | 0 |
| Deli | Komplement | Direkt + metadata | 1 | Ej val | 0 | 1 | 0 |
| Wings | Komplement | Direkt + metadata | 0 | Ej val | 0 | 0 | 0 |
| Nudlar | Komplement | Direkt + metadata | 5 | Ej val | 3 | 5 | 0 |
| Dumplings | Komplement | Direkt + metadata | 7 | Ej val | 4 | 7 | 0 |
| Tacos | Komplement | Direkt + metadata | 3 | Ej val | 2 | 3 | 0 |
| Texmex | Komplement | Direkt + metadata | 8 | Ej val | 3 | 8 | 0 |
| Soppa | Komplement | Direkt + metadata | 8 | Ej val | 2 | 8 | 0 |
| Fish and chips | Komplement | Direkt + metadata | 7 | Ej val | 2 | 7 | 0 |
| Korv | Komplement | Direkt + metadata | 11 | Ej val | 5 | 11 | 0 |
| Kaffe | Komplement | Direkt + metadata | 239 | 90 | 93 | 239 | 0 |
| Te | Komplement | Direkt + metadata | 9 | Ej val | 6 | 9 | 0 |
| Dessert | Komplement | Direkt + metadata | 4 | Ej val | 0 | 4 | 0 |
| Tårta | Komplement | Direkt + metadata | 26 | Ej val | 8 | 26 | 0 |
| Våfflor | Komplement | Direkt + metadata | 2 | Ej val | 0 | 2 | 0 |
| Crêpes | Komplement | Direkt + metadata | 5 | Ej val | 3 | 5 | 0 |
| Donuts | Komplement | Direkt + metadata | 0 | Ej val | 0 | 0 | 0 |
| Frozen yoghurt | Komplement | Direkt + metadata | 0 | Ej val | 0 | 0 | 0 |
| Bubble tea | Komplement | Direkt + metadata | 5 | Ej val | 5 | 5 | 0 |
| Kyckling | Komplement | Direkt + metadata | 8 | Ej val | 4 | 8 | 0 |
| Glass | Komplement | Direkt + metadata | 34 | Ej val | 28 | 34 | 0 |
| Matvagn | Komplement | Känd intern typ | 0 | 0 | 0 | 0 | 0 |

Alla sex områdens delresultat finns i [CSV-matrisen](search-quality-512.csv). Noll observerade objekt styrker ingen faktisk täckning; exempelvis Danskt måste också bedömas med det fasta kollisionsfallet och dokumenterat kategoristöd.

## Prestanda och kostnad mot main

30 oberoende mätningar per cell, nearest-rank p50/p95 och högsta observerade värde. VM/module-initiering ligger utanför tidtagningen; verklig serverhandler, normalisering, cache och JSON-serialisering ligger inom. **HTTP/RPC har noll simulerad nätverkslatens. Dessa millisekunder mäter lokal processkostnad, inte Cloudflare-/Geoapify-svarstid.** Kall cache använder ny instans; varm cache förhämtar samma request; Visa fler förbrukar första sidans riktiga cursor. Göteborg används för ett område så båda versionerna har en faktisk nästa sida. Femområdesprovet använder Göteborg, Södermalm, Malmö, Uppsala och Enskede. Hela unionen ingår.

| Version | Områden | Cache | Handling | p50 ms | p95 ms | Max ms | Missanrop p50/max | Reservkrediter p50/max |
| --- | ---: | --- | --- | ---: | ---: | ---: | --- | --- |
| main | 1 | cold | search | 3.87 | 4.77 | 4.97 | 1/1 | 1/1 |
| main | 1 | cold | more | 2.17 | 3.10 | 3.34 | 1/1 | 1/1 |
| main | 1 | warm | search | 1.71 | 2.37 | 2.44 | 0/0 | 0/0 |
| main | 1 | warm | more | 1.38 | 3.13 | 3.52 | 0/0 | 0/0 |
| main | 5 | cold | search | 10.48 | 17.98 | 18.40 | 5/5 | 5/5 |
| main | 5 | cold | more | 4.54 | 5.70 | 6.06 | 3/3 | 3/3 |
| main | 5 | warm | search | 5.40 | 7.10 | 9.73 | 0/0 | 0/0 |
| main | 5 | warm | more | 2.93 | 4.24 | 9.87 | 0/0 | 0/0 |
| candidate | 1 | cold | search | 6.76 | 19.88 | 30.13 | 2/2 | 5/5 |
| candidate | 1 | cold | more | 3.66 | 5.01 | 11.47 | 2/2 | 5/5 |
| candidate | 1 | warm | search | 3.27 | 3.83 | 3.87 | 0/0 | 0/0 |
| candidate | 1 | warm | more | 2.31 | 3.44 | 3.94 | 0/0 | 0/0 |
| candidate | 5 | cold | search | 18.14 | 29.06 | 29.17 | 10/10 | 25/25 |
| candidate | 5 | cold | more | 9.40 | 18.31 | 19.48 | 8/8 | 23/23 |
| candidate | 5 | warm | search | 8.80 | 9.75 | 13.07 | 0/0 | 0/0 |
| candidate | 5 | warm | more | 5.01 | 6.95 | 7.82 | 0/0 | 0/0 |

Kandidaten gör mer arbete än main och har högre lokal CPU-kostnad samt fler kalla provideranrop. För riktad sökning med metadata är den första kallomgångens övre Places-reservation 2 anrop/5 krediter per område, 10/25 över fem områden. Metadata-only kräver normalt 1/4; direkt typ eller `.only`-profil 1/1. Namnsökning använder befintlig separat budgeterad väg. Varm cache gav 0 missanrop och 0 reservkrediter. Cacheträffar räknas separat i kandidatens `budgetUsage.cacheHits`.

Gränserna är fortsatt 25 missanrop, 40 konservativt reserverade krediter, 10 s helhetsdeadline och samtidighet 2. HTTP-förfrågningens timeout begränsas nu också av återstående helhetstid. Områdesgeometri belastar samma budget och kan göra en omgång partiell. Visa fler är en uttrycklig ny handling; den skannar inte obegränsat. En gemensam fortsättningspool för övriga matställestyper återfår bland annat källstödd Sushi/fisk på café/pub utan större automatisk hämtning.

**Faktisk debitering är inte verifierad.** Reservationer är konservativa övre beräkningar enligt befintligt kontrakt; de är inte en leverantörsfaktura. Misslyckade/avbrutna försök reserveras också.

Föreslagna tekniska acceptansgränser: lokal p95 <50 ms för ett område och <100 ms för fem; varm p95 <20 ms; noll okontrollerade anrop över 25/40 och högst en automatisk metadatasida per område. För verklig edge/UI föreslås p95 ≤5 s för ett punktområde, ≤8 s för fem, samt högst 10 s providerarbete + transport/rendering; varm återhämtning p95 ≤2 s. Dessa nätverksgränser är **mål som måste prövas med riktiga mätningar**, inte påstått uppnådda resultat eller en ny produktpolicy. En observerad regression ska redovisas tillsammans med täckningsvinsten.

## Testmatris och granskningsrisker

| Grind | Fasta kontroller / evidens |
| --- | --- |
| Hela katalogen | Alla 81 identiteter och samtliga alias nås inom två begreppsförslag. 38/42/1-fördelning och tre grupper kontrolleras. |
| Direkt, familj och metadata | Sushi/Thai-snabbmat, Grillat, Fisk, Pasta, Falafel, Asiatiskt, Mellanöstern, Kebab och kompletterande begrepp. 43 fasta verkliga exportexempel samt syntetiska kontrastfall. |
| Relevans | Italienskt är inte Pasta/Pizza; namn ger inget maträttsbevis; Indiskt blir inte Asiatiskt; Fika är café/bageri. |
| Profiler | `yes`, saknat stöd, namn, cuisine=vegan och annan profil avvisas; endast explicit `only` godtas. |
| Historik | FOOD_TAGS behåller 37 poster; nya smala Svenskt/Mexikanskt och profiler använder nya ID:n. Gamla samlingsetiketter räcker inte. Ingen migration eller omklassificering. |
| Relaterat | Korrekt mål-ID/etikett, aktivt val, ingen automatisk Bowl/Poké→Sallad, inga dolda kostalternativ. Matvagn erbjuder känd typ och aktiv väg till Snabbmat. |
| Paginering | Full råsida utan träff behåller cursor; direkt/metadata/typ/område fortsätter oberoende; annan scope återställer. Tom första sida har Sök vidare. |
| Fel | 400/401/429/500, abort, partiellt strömfel, gruppvägran, budget 0, kredit-/anropstak, samtidighet. Felande stream förskjuts inte. |
| Identitet | Exakt OSM-typ+ID deduplicerar olika provider-ID:n. Annan typ/ID och obevisad identitet hålls isär. Inget fuzzy-merge. Befintliga kanoniska/gruppscopade regressionsfall kvarstår. |
| Grupper och rådata | Medlemskontroll före provideranrop, rätt grupp-ID till alla RPC:er, SQL jämför lagrade etiketter. Råpayload lämnar inte discovery-handlern; querybevis sparas inte som cuisine. |
| Geografi | Fem områdens budget och blandad point/boundary, rätt filter och separata cursors; inga påhittade boundary-avstånd. |
| UI | Reproducerbart nytt Playwright-flöde vid 360 och 1280 px: alias, extra begrepp, profiler, Brunch, Bowl/Poké, Matvagn, träff och tillägg. Cloudflare-interaktion och exakt head dokumenteras separat i PR. |

Reproducerbart kommando:

```sh
bun scripts/verify-search-quality-512.ts /path/to/matrundan-geoapify-komplettering-3.json /path/to/main-checkout /tmp/search-verification.json
```

Råexporten krävs för full återspelning och är inte incheckad. De 43 begränsade fasta exemplen med attribution finns i `src/lib/matrundan/testing/search-observations-512.json`. Ingen ny generell inventering eller bred API-körning behövs.
