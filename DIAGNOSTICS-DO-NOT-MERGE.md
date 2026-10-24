# Tillfälligt mätverktyg för PR #515

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
