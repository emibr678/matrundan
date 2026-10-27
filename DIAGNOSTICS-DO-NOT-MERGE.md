# Tillfälligt mätverktyg för PR #515

## Manuell Overpass-diagnostik, 27 oktober

`/sokverifiering` är nu en fristående staging-only testyta för användarens mobil.
Inga anrop sker före manuellt klick. Minimal OSM-fråga först; därefter fasta
Pasta/Falafel/Kebab/Ramen-frågor i Stockholm eller Värnamo, punkt 5 km.
Webbläsaren anropar endast den fasta Private.coffee-adressen, utan session,
cookies, gruppuppgifter eller referrer. Samma fråga kan öppnas som kodad GET i
ny flik. Manuell JSON-bekräftelse från den fliken markeras separat från ett
maskinellt avläst svar. JavaScript kan inte säkert skilja CORS från DNS/TLS.

45 sekunders klienttimeout, 10/15 sekunders querytimeout, 16 MiB serverbudget,
512 KiB svarstak och 50 resultat plus count. Högst 10 anrop från sidan per
sidvisning, inga automatiska återförsök. Allt resultat är flyktig sidstatus;
inga databas- eller platsattribut skrivs. Kvotbesked och partiellt svar stoppar
fortsättningen. Nya flikars manuella anrop räknas inte i sidans räknare.

Branchens sökkod är äldre än aktuell PR #515 och får inte användas som aktuell
produktjämförelse. Detta är ingen Overpass-integration i Matrundans sökning.
**Branchen ska aldrig mergas till main.** Den äldre Geoapify-mätfunktionen finns
kvar som historiskt underlag men anropas inte av den nya sidan.

## Tidigare Geoapify-upplägg (historik)

Denna branch ska inte mergas. Den mäter oförändrad main ead5a34 och exakt
produktkandidat 593d5efe genom ordinarie stagingautentisering och gruppkontroller.
Inga privata grupp-ID:n, sessioner eller råsvar returneras eller lagras i kvittot.
Endast två fasta egna stagingorigins kan anropas. Målens health måste matcha låsta SHA:n.
HTTP-klienten använder explicit mål-Origin för befintlig CSRF-validering och giltig
användarsession för ordinarie JWT- och gruppkontroller. Inga kontroller stängs av.
Redirects följs inte; Workers stödda manual-läge kontrolleras med HTTP-status.

Endast diagnostikversionen använder global_fetch_strictly_public så att same-zone-
anrop går genom den publika frontdörren. Main och produktkandidaten ändras inte.

Första matrisen finns i docs/verification/search-live-515-before.json: 64 giltiga
observationer med två prov per cell på tidigare produkt-head 6899af48. Mätkodens
avvisade försök finns separat och räknas inte som söklatens eller produktfel.
188 verifierade providerreservkrediter + 40 försiktighetskrediter utan kvitto
rymdes inom första omgångens 240-tak.

Den nu aktiva efterkontrollen har ett separat tak på 90 reservkrediter. Den kör
main och ny kandidat: Sushi med ett område två varv; Sushi med fem områden och
direkt Restaurang med ett område ett varv. Varje varv mäter första och riktig
cursor-fortsättning, kall och upprepad varm appcache. Alla är punktområden, 5 km.
Inga gruppinställningar eller platser skrivs av mätverktyget.

HTTP-latens inkluderar måltransport, auth, databas, provider och svarskropp;
isolerad providerlatens finns inte. Browsermättid inkluderar reläets extra auth,
health-kontroll och transport, inte ordinarie appens rena rendering. Verktygets
kontroll-API-latens används aldrig som produktlatens. Noll missanrop och noll
reservation styrker varm appcache; main rapporterar inget separat cacheträffantal.
Urvalet ger inga tillförlitliga p95 per cell. Faktisk leverantörsdebitering är inte verifierad.
