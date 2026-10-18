import { APP_ENVIRONMENT, type AppEnvironment } from "./app-environment";
import { environmentForRequestUrl } from "./observability";

// A separate document gives the real app its own viewport without changing
// AppShell, responsive breakpoints, authentication or production navigation.
export function handleUxReviewRequest(
  request: Request,
  environment: AppEnvironment = APP_ENVIRONMENT,
): Response {
  // Require both the build's environment and the existing request-origin identity.
  // Query parameters and forwarded headers cannot enable the tool on another host.
  if (
    (environment !== "local" && environment !== "staging") ||
    environmentForRequestUrl(request.url) !== environment
  ) {
    return new Response("Sidan hittades inte", {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  }

  const nonce = crypto.randomUUID();
  return new Response(reviewDocument(nonce), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      "content-security-policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; frame-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`,
      "referrer-policy": "same-origin",
    },
  });
}

function reviewDocument(nonce: string): string {
  return `<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>UX-granskning · Matrundan</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; height: 100dvh; display: flex; flex-direction: column; color: #30281f; background: #eae6df; font: 14px/1.4 system-ui, sans-serif; }
    header { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 16px; padding: 4px 12px; background: #fffaf2; border-bottom: 1px solid #d9d1c5; }
    h1 { margin: 0; font-size: 15px; }
    fieldset { display: flex; flex-wrap: wrap; gap: 0 12px; min-width: 0; margin: 0; padding: 0; border: 0; }
    legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
    label { display: inline-flex; align-items: center; gap: 4px; min-height: 36px; cursor: pointer; }
    input { accent-color: #bd542f; }
    input:focus-visible, select:focus-visible, a:focus-visible { outline: 2px solid #bd542f; outline-offset: 3px; }
    select { max-width: 100%; padding: 4px; font: inherit; }
    a { color: #934020; }
    #stage { flex: 1; min-height: 0; max-width: 100%; overflow: auto; }
    iframe { display: block; width: 360px; height: 800px; margin: 0 auto; border: 0; background: #fffaf2; box-shadow: 0 1px 8px #30281f26; }
    output { font-variant-numeric: tabular-nums; color: #655c51; }
  </style>
</head>
<body>
  <header>
    <h1>UX-granskning</h1>
      <fieldset>
        <legend>Visningsstorlek</legend>
        <label><input type="radio" name="viewport" value="mobile" checked> Mobil 360 × 800</label>
        <label><input type="radio" name="viewport" value="desktop"> Desktop 1280 × 900</label>
      </fieldset>
      <label>Startvy <select id="start-view"><option value="/exempel">Exempelgruppen</option><option value="/">Vanliga appen</option></select></label>
      <output id="viewport" aria-label="Uppmätt viewport" aria-live="polite">Laddar appen…</output>
      <a href="/" target="_blank" rel="noopener">Logga in i appen ↗</a>
  </header>
  <main id="stage" tabindex="0" aria-label="App i vald visningsstorlek">
    <iframe id="review-app" title="Matrundan i granskningsvy" src="/exempel"></iframe>
  </main>
  <script nonce="${nonce}">
    const frame = document.querySelector('#review-app');
    const output = document.querySelector('#viewport');
    function reportSize() {
      try {
        output.textContent = frame.contentWindow.innerWidth + ' × ' + frame.contentWindow.innerHeight;
      } catch {
        output.textContent = 'Appen lämnade denna miljö. Öppna den vanliga appen för inloggning.';
      }
    }
    frame.addEventListener('load', () => {
      reportSize();
      try { frame.contentWindow.addEventListener('resize', reportSize); } catch { /* External login belongs in the ordinary app tab. */ }
    });
    document.querySelectorAll('input[name="viewport"]').forEach(input => {
      input.addEventListener('change', () => {
        const desktop = input.value === 'desktop';
        frame.style.width = (desktop ? 1280 : 360) + 'px';
        frame.style.height = (desktop ? 900 : 800) + 'px';
        requestAnimationFrame(reportSize);
      });
    });
    document.querySelector('#start-view').addEventListener('change', event => {
      // Hardcoded same-origin destinations only; never accept a URL from query parameters.
      const next = event.target.value;
      if (next === '/' || next === '/exempel') frame.src = next;
    });
  </script>
</body>
</html>`;
}
