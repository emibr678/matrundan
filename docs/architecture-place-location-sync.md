# Säker omsynk av kanonisk platsdata

Detta beslut kompletterar [`docs/architecture.md`](./architecture.md) för
adress, kartposition och extern platsidentitet. Vid konflikt gäller den
kanoniska arkitekturen och aktuell kod/databas.

## Syfte

Matrundan behöver kunna reparera kanoniska matställen som skapades från äldre
leverantörsdata där exempelvis verksamhetsnamnet sparades som adress. Omsynken
ska hjälpa gruppen att hitta och besöka rätt ställe utan att göra Matrundan till
en generell kartredigerare.

## Lager och ansvar

- `places` innehåller Matrundans kanoniska adress, område, ort och kartposition.
- `place_sources` innehåller externa Geoapify- och OpenStreetMap-identiteter.
- `place_external_info_snapshots` innehåller en privat, serverstyrd och
  normaliserad ögonblicksbild av senast hämtad extern information.
- Gruppens webbplats- och öppettidsöverstyrningar ligger fortsatt i
  `group_places` och påverkas aldrig av en platsomsynk.

Rå Geoapify- eller OSM-payload lämnar inte servergränsen. Klienten får endast
normaliserad adress, område, ort, position, möjlig OSM-identitet, webbplats,
öppettider, tidszon, hämtningstid och attribution som behövs för den aktuella
jämförelsen.

## Läsning och jämförelse

En extern hämtning kräver:

1. autentiserad användare;
2. aktivt medlemskap i den valda gruppen;
3. ett aktivt `group_places` för matstället;
4. en exakt aktiv Geoapify-källa för samma kanoniska plats.

En färsk serverstyrd snapshot får återanvändas. Manuell omhämtning är
frekvensbegränsad. Kartdatan visas som en jämförelse och skriver aldrig över
Matrundans plats automatiskt.

En extern plats kan föreslås endast när den innehåller:

- en trovärdig gatuadress som inte är identisk med verksamhetsnamnet;
- en icke-tom ort;
- giltiga koordinater;
- antingen en komplett och giltig OSM-identitet eller ingen OSM-identitet.

## Explicit uppdatering

Endast gruppens ägare och administratörer får välja **Använd ny adress**.
Handlingen går genom en autentiserad serverfunktion som:

1. verifierar medlemskap, roll och exakt aktiv Geoapify-källa;
2. hämtar platsdetaljerna på nytt från Geoapify;
3. anropar en `service_role`-skyddad RPC med användarens verifierade ID;
4. låser den kanoniska platsraden;
5. validerar adress, ort, position, färskhet och externa identiteter igen;
6. uppdaterar adress, område, ort och position atomiskt;
7. länkar en exakt OSM-identitet endast när den inte redan tillhör ett annat
   aktivt kanoniskt matställe och platsen inte har en annan aktiv OSM-källa.

Vanliga autentiserade klienter har ingen direkt `EXECUTE`-rätt till den
kanoniska uppdaterings-RPC:n och får inte skriva externa snapshots.

## Förhållande till rapportering och OSM

Omsynk och rapportering är olika handlingar:

- När aktuell kartdata verkar korrekt kan en admin uttryckligen använda den.
- När kartdatan också verkar fel går användaren vidare till gruppens privata
  platsdatarapport.
- Rapporten granskas fortsatt av ägare/admin innan något eventuellt förbereds
  för en offentlig OpenStreetMap-note.
- Omsynk skapar aldrig automatiskt en rapport eller en offentlig OSM-note.
- En länkad OSM-identitet ska fortsätta utlösa befintlig atomisk hantering av
  opublicerade `missing_in_osm`-underlag enligt huvudarkitekturen.

## Befintliga felrader

Äldre produktionsrader repareras inte med en blind massuppdatering. Varje plats
måste gå genom samma aktuella hämtning, jämförelse, rollkontroll och uttryckliga
godkännande. Det bevarar kanoniska besök, grupprelationer och historiska källor
samt undviker att felaktig leverantörsdata skrivs in som ny sanning.

## Demo och exempelgrupp

Exempelgruppen och lokal demo gör inga externa anrop och skriver inte till
produktionsdatabasen. Det sekundära omsynkflödet visas därför endast i
autentiserat live-läge för platser med en aktiv Geoapify-källa.

## Produktionsverifiering

Efter att migrationerna har applicerats ska både
`supabase/production-preflight.sql` och
`supabase/production-preflight-place-location.sql` köras skrivskyddat. Alla
rader måste returnera `ok = true` innan appversionen publiceras. Därefter krävs
en autentiserad läsning och en kontrollerad jämförelse i en verklig aktiv grupp;
en kanonisk skrivning görs endast när den uttryckligen har godkänts som ett
manuellt produktionssteg.
