import * as React from "react";
import { Button } from "@/components/ui/button";
import { geoapifyDiagnose464 } from "@/lib/matrundan/geoapify.functions";
import type { SearchArea, SearchRadiusKm } from "@/lib/matrundan/types";

// TEMPORARY #464. Manual action only; no database writes or automatic extra requests.
export function SearchDiagnostics464({
  area,
  radiusKm,
  query,
}: {
  area: SearchArea;
  radiusKm: SearchRadiusKm;
  query: string;
}) {
  const [variant, setVariant] = React.useState<
    | "cached"
    | "fresh"
    | "without-name"
    | "without-bias"
    | "limit-50"
    | "offset-20"
    | "circle-bias"
    | "address-bias"
    | "limit-500"
    | "restaurant-only"
    | "parent-categories"
    | "places-post"
    | "geocode-name"
    | "geocode-text"
    | "geocode-assisted"
  >("fresh");
  const [busy, setBusy] = React.useState(false);
  const [report, setReport] = React.useState("");
  const [error, setError] = React.useState("");
  const generation = React.useRef(0);
  React.useEffect(() => {
    generation.current++;
    setReport("");
    setError("");
    setBusy(false);
  }, [area, radiusKm, query]);
  if (
    ![
      "Ox lan",
      "Ox Lan",
      "OX LAN",
      "Ox",
      "Ox L",
      "x Lan",
      "Bröd & Salt",
      "Matrundan464zzIngenTräff",
    ].includes(query.trim())
  )
    return null;
  async function run() {
    const id = ++generation.current;
    setBusy(true);
    setError("");
    setReport("");
    try {
      const result = await geoapifyDiagnose464({
        data: {
          text: query.trim() as
            | "Ox lan"
            | "Ox Lan"
            | "OX LAN"
            | "Ox"
            | "Ox L"
            | "x Lan"
            | "Bröd & Salt"
            | "Matrundan464zzIngenTräff",
          lat: area.lat,
          lng: area.lng,
          radiusKm,
          searchMode: area.searchMode,
          placeId: area.placeId,
          variant,
        },
      });
      if (id === generation.current) setReport(JSON.stringify(result, null, 2));
    } catch {
      if (id === generation.current) setError("Diagnostiken kunde inte köras. Inget har sparats.");
    } finally {
      if (id === generation.current) setBusy(false);
    }
  }
  return (
    <details className="min-w-0 rounded-xl border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Tillfällig sökdiagnostik · #464
      </summary>
      <p className="my-2 break-words text-xs">
        {area.label} · {radiusKm ?? 50} km · {query}
      </p>
      <label className="block text-xs" htmlFor="diagnostic464-variant">
        Jämförelse
      </label>
      <select
        id="diagnostic464-variant"
        className="my-2 min-h-11 w-full rounded border bg-background p-2 text-sm"
        disabled={busy}
        value={variant}
        onChange={(e) => {
          setVariant(e.target.value as typeof variant);
          setReport("");
        }}
      >
        <option value="fresh">Normal request utan cache</option>
        <option value="cached">Normal request med cache</option>
        <option value="without-name">Utan provider-name</option>
        <option value="without-bias">Utan proximity-bias</option>
        <option value="limit-50">50 kandidater</option>
        <option value="offset-20">Nästa sida, offset 20</option>
        <option value="circle-bias">Bias över hela vald radie</option>
        <option value="address-bias">Bias vid Sveavägen 86, samma områdesfilter</option>
        <option value="limit-500">500 kandidater, samma namnfilter</option>
        <option value="restaurant-only">Endast restaurangkategori</option>
        <option value="parent-categories">Matkategorier via föräldrakategorier</option>
        <option value="places-post">Samma Places-sökning via POST</option>
        <option value="geocode-name">Geocoding, strukturerat verksamhetsnamn</option>
        <option value="geocode-text">Geocoding, verksamhetsnamn som text</option>
        <option value="geocode-assisted">Verifierad namnträff via befintlig Places-adapter</option>
      </select>
      <Button type="button" className="min-h-11 w-full" disabled={busy} onClick={() => void run()}>
        {busy ? "Hämtar diagnostik…" : "Kör sökdiagnostik"}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-sm">
          {error}
        </p>
      ) : null}
      {report ? (
        <pre
          className="mt-3 max-h-96 whitespace-pre-wrap break-all rounded bg-muted p-2 text-[11px]"
          aria-label="Sökdiagnostikresultat"
        >
          {report}
        </pre>
      ) : null}
    </details>
  );
}
