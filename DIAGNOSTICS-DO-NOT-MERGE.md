# Tillfälligt mätverktyg för PR #515

Denna branch ska inte mergas. Produktkandidatens head förblir 6899af48.

`/sokverifiering` använder ordinarie stagingautentisering och en vald testgrupp.
Alla anrop är read-only, avgränsade till ordinarie discovery-RPC på staging main
och immutable preview e1b4fd09. Målens health måste matcha låsta SHA:n.
Samma befintliga användarsession vidarebefordras server-side inom Matrundans
stagingmiljöer. Inga hemligheter, grupp-ID:n eller råsvar rapporteras.

Två varv, ett/fem punktområden, Restaurang/Sushi, första/Visa fler, avsedd kall
och upprepad varm appcache. Högst 240 reserverade krediter, därefter stopp.
Varje discovery-request har dessutom befintligt 25/40-tak. Vid saknat kvitto
reserverar mätaren konservativt hela tillåtna kredittaket och stoppar provet.

HTTP-latensen mellan mätaren och målets riktiga RPC inkluderar nätverk,
autentisering, databas, provider, serialisering. Det är verklig live-HTTP,
men inte isolerad Geoapify-tid. Browserns mättid inkluderar även reläets
autentisering, SHA-kontroll och extra transport; den är inte ordinarie appens
rena UI-latens. Verktygsanropens latens mäts inte som produktlatens.

Två observationer ger endast ett kontrollerat pilotprov, inget stabilt p95.
Cacheträffar redovisas bara där servern faktiskt rapporterar dem; noll
missanrop och noll reservation styrker varm appcache även i main.
