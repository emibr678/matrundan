import * as React from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { appPageTitle, IS_STAGING } from "@/lib/app-environment";
import {
  OVERPASS_ENDPOINT,
  OVERPASS_RESULT_LIMIT,
  PROBE_AREAS,
  PROBE_CUISINES,
  probeQuery,
  probeUrl,
  runOverpassProbe,
  type ProbeArea,
  type ProbeCuisine,
  type ProbeReceipt,
  type ProbeSelection,
} from "@/lib/overpass-diagnostic";

export const Route = createFileRoute("/sokverifiering")({
  beforeLoad: () => {
    if (!IS_STAGING) throw notFound();
  },
  head: () => ({
    meta: [
      { title: appPageTitle("Manuellt Overpass-prov") },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: OverpassDiagnostic,
});
const button =
  "min-h-11 rounded-md border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";
const MAX_REQUESTS = 10;

function OverpassDiagnostic() {
  const [ready, setReady] = React.useState(false);
  const [area, setArea] = React.useState<ProbeArea>("stockholm");
  const [cuisine, setCuisine] = React.useState<ProbeCuisine>("pasta");
  const [receipt, setReceipt] = React.useState<ProbeReceipt | null>(null);
  const [running, setRunning] = React.useState(false);
  const [requests, setRequests] = React.useState(0);
  const [verified, setVerified] = React.useState(false);
  const [openedMinimal, setOpenedMinimal] = React.useState(false);
  const [confirmedInTab, setConfirmedInTab] = React.useState(false);
  const [stopped, setStopped] = React.useState(false);
  const active = React.useRef<AbortController | null>(null);
  const mounted = React.useRef(true);
  React.useEffect(() => {
    setReady(true);
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current?.abort();
    };
  }, []);
  const selection = { area, cuisine };
  const enabled = ready && (verified || confirmedInTab) && !stopped && requests < MAX_REQUESTS;
  const chosenArea = PROBE_AREAS[area];
  async function run(query: ProbeSelection) {
    if (active.current || stopped || requests >= MAX_REQUESTS) return;
    if (query !== "minimal" && !enabled) return;
    const controller = new AbortController();
    active.current = controller;
    setRunning(true);
    setRequests((count) => count + 1);
    setReceipt(null);
    try {
      const result = await runOverpassProbe(query, controller.signal);
      if (!mounted.current) return;
      setReceipt(result);
      if (query === "minimal" && result.complete) setVerified(true);
      if (result.httpStatus === 429 || result.outcome === "partial") setStopped(true);
    } finally {
      active.current = null;
      if (mounted.current) setRunning(false);
    }
  }
  return (
    <main className="mx-auto min-h-dvh max-w-3xl space-y-5 bg-background px-4 py-6 text-foreground">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Matrundan Staging · Tillfällig diagnostik
        </p>
        <h1 className="font-display text-2xl">Manuellt Overpass-prov</h1>
        <p className="rounded-md border border-amber-600/40 bg-amber-100/40 p-3 text-sm">
          Den här branchen har äldre sökkod. Provet jämför inte resultaten med aktuell PR #515 och
          ska aldrig mergas till main.
        </p>
        <p className="text-sm text-muted-foreground">
          Ett klick gör ett anrop direkt från din webbläsare. Bara den fasta frågan skickas, utan
          Matrundans cookies, session, gruppuppgifter eller referer. Inget sparas.
        </p>
      </header>

      <section className="space-y-3 rounded-lg border p-4" aria-labelledby="connection-heading">
        <h2 id="connection-heading" className="font-semibold">
          1. Kontrollera anslutningen
        </h2>
        <button
          className={`${button} bg-primary text-primary-foreground`}
          disabled={!ready || running || stopped || requests >= MAX_REQUESTS}
          onClick={() => void run("minimal")}
        >
          Kör minimalt anrop
        </button>
        {running && (
          <p className="text-sm">Anrop pågår. Status och Avbryt finns under provvalen.</p>
        )}
        <p className="text-sm">
          Hämtar endast ett fast OSM-ID. Även en tom elements-lista kan vara ett giltigt JSON-svar.
        </p>
        {ready && !stopped && (
          <a
            className="block text-sm font-medium text-primary underline"
            href={probeUrl("minimal")}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            onClick={() => setOpenedMinimal(true)}
          >
            Öppna samma minimala fråga i ny flik
          </a>
        )}
        <p className="text-xs text-muted-foreground">
          En ny flik behöver inte CORS för att visa svaret. Om JSON visas där men anropet här
          misslyckas talar det för en skillnad i CORS eller hur anropen hanteras; det bevisar inte
          ensamt orsaken.
        </p>
        {openedMinimal && !verified && !confirmedInTab && (
          <button
            className={button}
            disabled={running || stopped}
            onClick={() => setConfirmedInTab(true)}
          >
            Jag ser giltig OSM-JSON i den nya fliken
          </button>
        )}
        <p className="text-sm font-medium">
          {verified
            ? "Anslutning verifierad på sidan."
            : confirmedInTab
              ? "Giltig JSON bekräftad av dig i ny flik; inte avläst av sidan."
              : "Anslutning ännu inte verifierad."}
        </p>
      </section>

      <section className="space-y-3 rounded-lg border p-4" aria-labelledby="search-heading">
        <h2 id="search-heading" className="font-semibold">
          2. Prova explicita OSM-taggar
        </h2>
        <p className="text-sm text-muted-foreground">
          Låses upp efter giltig OSM-JSON på sidan eller din uttryckliga bekräftelse från den nya
          fliken.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="block">Fast område</span>
            <select
              className="min-h-11 w-full rounded-md border bg-background px-2"
              value={area}
              disabled={running}
              onChange={(event) => setArea(event.target.value as ProbeArea)}
            >
              {Object.entries(PROBE_AREAS).map(([id, item]) => (
                <option key={id} value={id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="block">Exakt cuisine-tagg</span>
            <select
              className="min-h-11 w-full rounded-md border bg-background px-2"
              value={cuisine}
              disabled={running}
              onChange={(event) => setCuisine(event.target.value as ProbeCuisine)}
            >
              {Object.entries(PROBE_CUISINES).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Centrum {chosenArea.lat}, {chosenArea.lon} · 5 km · restaurant/fast_food · högst{" "}
          {OVERPASS_RESULT_LIMIT} objekt. Inga köksassociationer eller menyantaganden.
        </p>
        <button
          className={`${button} bg-primary text-primary-foreground`}
          disabled={!enabled || running}
          onClick={() => void run(selection)}
        >
          Sök {PROBE_CUISINES[cuisine]} i {chosenArea.label}
        </button>
        {enabled && (
          <a
            className="block text-sm font-medium text-primary underline"
            href={probeUrl(selection)}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            Öppna samma taggfråga i ny flik
          </a>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer py-2">Visa den fasta taggfrågan</summary>
          <pre className="whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">
            {probeQuery(selection)}
          </pre>
        </details>
      </section>

      <section className="space-y-3 rounded-lg border p-4" aria-labelledby="result-heading">
        <h2 id="result-heading" className="font-semibold">
          Svar från senaste anropet
        </h2>
        <p role="status" className="text-sm">
          {running
            ? "Anrop pågår… avbryts senast efter 45 sekunder."
            : (receipt?.message ?? "Inget anrop har gjorts.")}
        </p>
        {running && (
          <button className={button} onClick={() => active.current?.abort()}>
            Avbryt anrop
          </button>
        )}
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">HTTP-status</dt>
            <dd>{receipt?.httpStatus ?? "Ej avläst"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Svarstid inkl. läsning</dt>
            <dd>{receipt ? `${receipt.elapsedMs} ms` : "Ej uppmätt"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Giltig OSM-JSON</dt>
            <dd>
              {receipt?.validOsmJson == null ? "Ej avläst" : receipt.validOsmJson ? "Ja" : "Nej"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Komplett svar</dt>
            <dd>{receipt ? (receipt.complete ? "Ja" : "Nej") : "Ej avläst"}</dd>
          </div>
        </dl>
        {receipt && (
          <>
            <p className="text-sm">
              {receipt.validOsmJson
                ? `Visar ${receipt.elements.length} OSM-objekt${receipt.total !== null ? ` av ${receipt.total} matchande` : " (totalantal ej rapporterat)"}.`
                : "Objektantal ej uppmätt."}
            </p>
            {receipt.capped && (
              <p className="rounded border border-amber-600/40 p-2 text-sm">
                Resultattaket är nått. Detta är ett begränsat urval; inga fler sidor hämtas.
              </p>
            )}
            {receipt.sourceTime && (
              <p className="break-all text-xs text-muted-foreground">
                OSM-källtid: {receipt.sourceTime}
              </p>
            )}
            {receipt.excerpt && (
              <pre className="whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">
                {receipt.excerpt}
              </pre>
            )}
            <ul className="space-y-3">
              {receipt.elements.map((element) => (
                <li
                  key={`${element.type}/${element.id}`}
                  className="space-y-1 rounded-md border p-3 text-sm"
                >
                  <p className="break-words font-semibold">
                    {element.tags.name || "Namnlöst OSM-objekt"}
                  </p>
                  <a
                    className="break-all text-primary underline"
                    href={`https://www.openstreetmap.org/${element.type}/${element.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                  >
                    {element.type}/{element.id}
                  </a>
                  {Object.entries(element.tags)
                    .filter(([key]) =>
                      [
                        "amenity",
                        "cuisine",
                        "opening_hours",
                        "check_date",
                        "disused",
                        "end_date",
                      ].includes(key),
                    )
                    .map(([key, value]) => (
                      <p className="break-all" key={key}>
                        <span className="text-muted-foreground">{key}: </span>
                        {value}
                      </p>
                    ))}
                </li>
              ))}
            </ul>
            <details className="text-sm">
              <summary className="cursor-pointer py-2">Visa kvitto och körd fråga</summary>
              <pre className="whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">
                {JSON.stringify(receipt, null, 2)}
              </pre>
            </details>
          </>
        )}
        {stopped && (
          <p className="text-sm font-medium">
            Provet stoppat efter kvotbesked eller ofullständigt svar. Gör inga fler anrop.
          </p>
        )}
      </section>
      <footer className="space-y-2 break-words text-xs text-muted-foreground">
        <p>
          Anrop från sidan i denna sidvisning: {requests}/{MAX_REQUESTS}. Inga automatiska
          återförsök. Anrop i nya flikar räknas inte här.
        </p>
        <p>
          OSM-taggar bevisar inte aktuellt menyutbud eller att verksamheten är öppen. Resultaten
          sparas inte som platsattribut.
        </p>
        <p className="break-all">
          Källa: © OpenStreetMap contributors · Endpoint: {OVERPASS_ENDPOINT}
        </p>
        <p className="break-all">
          Diagnostikbranch: diagnostics/live-verification-515 · Head:{" "}
          {import.meta.env.VITE_MATRUNDAN_RELEASE_SHA}
        </p>
      </footer>
    </main>
  );
}
