# Serverfunktioner och CSRF

Detta dokument kompletterar `docs/architecture.md` med det varaktiga säkerhetsbeslutet för TanStack Start-serverfunktioner.

## Beslut

Matrundans egen `src/start.ts` ska registrera TanStack Starts `createCsrfMiddleware` för alla requests där `handlerType === "serverFn"`.

CSRF-middleware ska ligga i den globala `requestMiddleware`-kedjan och får inte tas bort när autentiserings- eller felmiddleware ändras.

## Varför skydden är separata

Bearertoken, `auth.uid()`, aktivt medlemskap, rollkontroller och validerade RPC:er avgör **vem** som får utföra en handling och **vilken grupp** handlingen får påverka.

CSRF-skyddet avgör separat **varifrån webbförfrågan får startas**. Autentisering och gruppkontroller ersätter därför inte ramverkets origin-skydd.

## Invariants

- Serverfunktioner ska endast acceptera origins som ramverkets CSRF-policy godkänner.
- Bred CORS eller generella origin-undantag får inte införas för att kringgå skyddet.
- Supabase-token ska fortfarande bifogas genom `attachSupabaseAuth` i `functionMiddleware`.
- CSRF-avvisningar får inte omvandlas till en lyckad applikationsrespons.
- Grupp-, roll- och inputvalidering ska köras även när origin är godkänd.
- Ett kontraktstest ska stoppa borttagning eller oavsiktlig omordning av den globala middlewarekonfigurationen.

## Verifiering

Minimikontroller:

1. `src/lib/matrundan/csrf-middleware-contract.test.ts` är grön.
2. TypeScript och produktionsbuild är gröna med den installerade TanStack Start-versionen.
3. Utvecklingsservern visar inte varningen att serverfunktioner saknar CSRF-middleware.
4. Befintliga same-origin-serverfunktioner och autentisering fungerar i browsermatrisen.
5. Vid framtida ändringar av origins, proxy eller autentisering ska ett riktat cross-origin-test läggas till innan release.
