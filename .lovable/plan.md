# Diagnostik: "Internal Server Error" efter synk av 3e22951

Ingen kod ändrad, inget publicerat. Allt nedan är verifierat med faktiska anrop och loggar.

## Status per miljö

| Miljö | Resultat |
| --- | --- |
| Lokal dev (sandbox, `http://localhost:8080/`) | **Fungerar** — HTTP 200, korrekt SSR-HTML, inga fel i dev-server-loggen (bara `inputValidator` deprecation-varningar från `geoapify.functions.ts`) |
| Publicerad app (`https://matrundan.lovable.app/`) | **Nere** — HTTP **502**, svarstext `Internal server error` |
| Stabil produktions-URL (`project--<id>.lovable.app`, t.ex. webhooken `/api/public/hooks/push-dispatch`) | **Nere** — HTTP 502, samma fel |
| Preview (`id-preview--<id>.lovable.app/`) | Svarar **302** (Lovable-inloggningsgrind), dvs. ingen 502 från själva sidan i det anropet. Jag har inte kunnat verifiera preview-SSR bakom inloggningen, så jag påstår inget om att preview är felfri. |

## Exakt felmeddelande (från worker-loggarna, senaste timmen)

```
Error: The compatibility flag nodejs_compat became the default as of 2026-08-04
so does not need to be specified anymore.
    at async serveSSR (index.js:8673:22)
    at async fetchFromDynamicWorkerLoader (index.js:28726:20)
    ...
```

Loggevent: `dwl.proxy.loader.error`, `error_name: "Error"`, `response_status: 502`,
`hostname: matrundan.lovable.app` samt `project--<id>.lovable.app`. Felet träffar
**alla** requests, inklusive `/` och den publika push-webhooken — det är alltså inte
route- eller modulspecifikt.

## Sannolik grundorsak

Felet uppstår i **runtime-lagret som laddar SSR-workern**, inte i Matrundans kod:

- Cloudflare-flaggan `nodejs_compat` blev default 2026-08-04 (dagens datum). Den
  deployade workern anger flaggan explicit, vilket nu avvisas när workern laddas,
  så `serveSSR` kastar innan någon route körs.
- Flaggan finns **inte** någonstans i repot: `rg "nodejs_compat|compatibility_date"`
  ger noll träffar, det finns ingen `wrangler.toml`, och `vite.config.ts` innehåller
  bara `tanstackStart.server.entry`. Flaggan sätts av plattformens build/deploy-kedja
  (nitro/cloudflare-preset).
- Commit `3e22951` (uppdelning av gruppinställningarna i undersidor) kan därför inte
  vara orsaken: samma bundle-hash felar även på webhook-routen och lokal SSR av samma
  kod fungerar. Sammanträffandet i tid beror på att datumbytet inföll idag.

## Slutsats och rekommendation

- Produktion är nere av en plattformsorsak. Ingen kodändring i Matrundan kan åtgärda det,
  och en ny publicering hjälper bara om deploy-kedjan hunnit uppdatera compat-flaggan.
- Rekommendation: avvakta/eskalera till Lovable-plattformen. När jag får klartecken kan
  jag göra en ny ompublicering och sedan verifiera `GET /` samt push-webhooken igen
  (fortfarande utan produktändringar).
- Ingen migrering, commit eller publicering har utförts.
