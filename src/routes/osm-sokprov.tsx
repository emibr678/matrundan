import * as React from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { appPageTitle, IS_STAGING, APP_ENVIRONMENT } from "@/lib/app-environment";
import { useSession } from "@/lib/matrundan/session";
import { canUseStagingTestTools } from "@/lib/matrundan/staging-test-tools";
import {
  searchOsmStagingIndex,
  type OsmStagingSearchResponse,
} from "@/lib/matrundan/osm-staging.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/osm-sokprov")({
  beforeLoad: () => {
    if (!IS_STAGING) throw notFound();
  },
  head: () => ({ meta: [{ title: appPageTitle("OSM-sökprov") }] }),
  component: OsmSearchComparisonPage,
});

const AREAS = {
  stockholm: { label: "Stockholm", lat: 59.3293, lng: 18.0686 },
  varnamo: { label: "Värnamo", lat: 57.186, lng: 14.041 },
} as const;

const QUERIES = {
  pasta: { label: "Pasta", tokens: ["pasta"] },
  falafel: { label: "Falafel", tokens: ["falafel"] },
  ramen: { label: "Ramen", tokens: ["ramen"] },
  asiatiskt: {
    label: "Asiatiskt (endast OSM-taggar)",
    tokens: [
      "asian", "japanese", "chinese", "korean", "thai", "vietnamese",
      "indonesian", "malaysian", "filipino", "taiwanese", "sushi", "ramen",
    ],
  },
} as const;

type Area = keyof typeof AREAS;
type Query = keyof typeof QUERIES;

function OsmSearchComparisonPage() {
  const { user, mode, loading } = useSession();
  const enabled = canUseStagingTestTools({
    environment: APP_ENVIRONMENT,
    signedIn: Boolean(user),
    liveMode: mode === "live",
  });
  const [area, setArea] = React.useState<Area>("stockholm");
  const [query, setQuery] = React.useState<Query>("pasta");
  const [radius, setRadius] = React.useState(5);
  const [response, setResponse] = React.useState<OsmStagingSearchResponse | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [duration, setDuration] = React.useState<number | null>(null);
  const currentRequest = React.useRef(0);

  const reset = () => {
    currentRequest.current += 1;
    setBusy(false);
    setResponse(null);
    setError("");
    setDuration(null);
  };

  async function run(nextPage = false) {
    if (!enabled || busy) return;
    const cursor = nextPage ? response?.cursor : null;
    if (nextPage && (!response?.hasMore || !cursor)) return;
    const request = ++currentRequest.current;
    setBusy(true);
    setError("");
    const started = performance.now();
    try {
      const center = AREAS[area];
      const result = await searchOsmStagingIndex({
        data: { lat: center.lat, lng: center.lng, radiusKm: radius, tokens: [...QUERIES[query].tokens], cursor },
      });
      if (request !== currentRequest.current) return;
      setResponse(nextPage && response ? {
        ...result,
        results: [...response.results, ...result.results],
      } : result);
      setDuration(Math.round(performance.now() - started));
    } catch (caught) {
      if (request !== currentRequest.current) return;
      setError(caught instanceof Error ? caught.message : "Sökningen kunde inte genomföras.");
    } finally {
      if (request === currentRequest.current) setBusy(false);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-2xl px-4 py-8">Kontrollerar inloggningen…</main>;
  }

  if (!enabled) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-semibold">OSM-sökprov</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Den här testsidan kräver inloggat liveläge i staging. Ingen gruppdata visas eller ändras.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl min-w-0 px-4 py-6 sm:py-10" data-osm-search-comparison>
      <h1 className="text-2xl font-semibold">OSM-sökprov</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tillfälligt läsprov för Issue #516. Sökningen använder bara explicita OSM-taggar,
        inte Matrundans färdiga relevansmodell. Inga ställen kan läggas till här.
      </p>

      <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-3">
        <label className="min-w-0 text-sm font-medium">
          Område
          <select
            className="mt-1 w-full min-w-0 rounded-md border bg-background px-3 py-2"
            value={area}
            onChange={(event) => { setArea(event.target.value as Area); reset(); }}
          >
            {Object.entries(AREAS).map(([key, item]) =>
              <option key={key} value={key}>{item.label}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-sm font-medium">
          Sökord
          <select
            className="mt-1 w-full min-w-0 rounded-md border bg-background px-3 py-2"
            value={query}
            onChange={(event) => { setQuery(event.target.value as Query); reset(); }}
          >
            {Object.entries(QUERIES).map(([key, item]) =>
              <option key={key} value={key}>{item.label}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-sm font-medium">
          Radie
          <select
            className="mt-1 w-full min-w-0 rounded-md border bg-background px-3 py-2"
            value={radius}
            onChange={(event) => { setRadius(Number(event.target.value)); reset(); }}
          >
            {[3, 5, 10, 25, 50].map((km) => <option key={km} value={km}>{km} km</option>)}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => void run(false)} disabled={busy}>
          {busy ? "Söker…" : "Sök i OSM-indexet"}
        </Button>
        {duration !== null && <span className="text-sm text-muted-foreground">
          Svarstid: {(duration / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 2 })} s
        </span>}
      </div>

      {error && <p role="alert" className="mt-4 rounded-md border p-3 text-sm">
        {error}
      </p>}
      {response?.status === "not_loaded" && (
        <p role="status" className="mt-4 rounded-md border p-3 text-sm">
          Indexet är inte inläst i Supabase staging ännu. Databasdriftsättning kräver separat godkännande.
        </p>
      )}
      {response?.status === "ok" && (
        <section className="mt-6 min-w-0" aria-label="OSM-träffar">
          <p className="mb-3 text-sm text-muted-foreground">
            {response.results.length} visade objekt · Indexgeneration {response.generation}.
            Antalet är inte samma sak som antal verifierat öppna restauranger.
          </p>
          <ol className="min-w-0 space-y-2">
            {response.results.map((item) => (
              <li key={item.osmType + ":" + item.osmId}
                className="min-w-0 rounded-lg border p-3">
                <p className="break-words font-medium">{item.name || "Matställe utan namn"}</p>
                <p className="mt-1 break-words text-xs text-muted-foreground">
                  {item.osmType}:{item.osmId} · {Math.round(item.distanceM)} m
                  {item.cuisine ? " · " + item.cuisine : " · Köksuppgift saknas"}
                </p>
              </li>
            ))}
          </ol>
          {response.results.length === 0 && <p className="text-sm">Inga explicita OSM-taggar matchade sökningen.</p>}
          {response.hasMore && <Button className="mt-4" variant="outline" disabled={busy}
            onClick={() => void run(true)}>Visa ytterligare 20</Button>}
        </section>
      )}

      <p className="mt-8 text-xs text-muted-foreground">
        © OpenStreetMap contributors · <a className="underline" href="https://www.openstreetmap.org/copyright"
          target="_blank" rel="noopener noreferrer">Källa och ODbL-licens</a>.
        För en verklig jämförelse används PR #515 separat; det här provet ändrar inte Matrundans vanliga sökning.
      </p>
    </main>
  );
}
