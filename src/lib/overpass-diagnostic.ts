/** Temporary browser diagnostic. Never merge or save these facts to places. */
export const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
export const OVERPASS_TIMEOUT_MS = 45_000;
export const OVERPASS_RESULT_LIMIT = 50;
const MAX_RESPONSE_BYTES = 512 * 1024;
export const PROBE_AREAS = {
  stockholm: { label: "Stockholm", lat: 59.3293, lon: 18.0686 },
  varnamo: { label: "Värnamo", lat: 57.186, lon: 14.041 },
} as const;
export const PROBE_CUISINES = {
  pasta: "Pasta",
  falafel: "Falafel",
  kebab: "Kebab",
  ramen: "Ramen",
} as const;
export type ProbeArea = keyof typeof PROBE_AREAS;
export type ProbeCuisine = keyof typeof PROBE_CUISINES;
export type ProbeSelection = "minimal" | { area: ProbeArea; cuisine: ProbeCuisine };
export type OsmProbeElement = {
  type: "node" | "way" | "relation";
  id: number;
  tags: Record<string, string>;
};
export type ProbeReceipt = {
  at: string;
  query: string;
  httpStatus: number | null;
  elapsedMs: number;
  validOsmJson: boolean | null;
  complete: boolean;
  outcome: "success" | "http" | "json" | "partial" | "network" | "timeout" | "cancelled" | "size";
  message: string;
  excerpt?: string;
  elements: OsmProbeElement[];
  total: number | null;
  sourceTime: string | null;
  capped: boolean;
};

export function probeQuery(selection: ProbeSelection): string {
  if (selection === "minimal") return "[out:json][timeout:10][maxsize:16777216];node(1);out ids;";
  const area = PROBE_AREAS[selection.area];
  if (!area || !Object.hasOwn(PROBE_CUISINES, selection.cuisine))
    throw new Error("Okänt fast diagnostikprov");
  return `[out:json][timeout:15][maxsize:16777216];
nwr(around:5000,${area.lat},${area.lon})
  ["amenity"~"^(restaurant|fast_food)$"]
  ["cuisine"~"(^|;)[[:space:]]*${selection.cuisine}[[:space:]]*(;|$)",i];
out tags center ${OVERPASS_RESULT_LIMIT};
out count;`;
}
export function probeUrl(selection: ProbeSelection): string {
  return `${OVERPASS_ENDPOINT}?${new URLSearchParams({ data: probeQuery(selection) })}`;
}
async function boundedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) return text + decoder.decode();
    bytes += chunk.value.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new RangeError("Svarstaket överskreds");
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
}
export async function runOverpassProbe(
  selection: ProbeSelection,
  cancellation: AbortSignal,
): Promise<ProbeReceipt> {
  const query = probeQuery(selection);
  const started = performance.now();
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  cancellation.addEventListener("abort", cancel, { once: true });
  if (cancellation.aborted) controller.abort();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, OVERPASS_TIMEOUT_MS);
  const receipt: ProbeReceipt = {
    at: new Date().toISOString(),
    query,
    httpStatus: null,
    elapsedMs: 0,
    validOsmJson: null,
    complete: false,
    outcome: "network",
    message: "",
    elements: [],
    total: null,
    sourceTime: null,
    capped: false,
  };
  try {
    // No session wrapper, authentication headers, cookies or referrer.
    const response = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "error",
      cache: "no-store",
      signal: controller.signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: query }).toString(),
    });
    receipt.httpStatus = response.status;
    const text = await boundedText(response);
    let data: Record<string, unknown> | null = null;
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        data = parsed as Record<string, unknown>;
    } catch {
      /* Error bodies are displayed as text, never interpreted as HTML. */
    }
    receipt.validOsmJson =
      data?.version === 0.6 &&
      Array.isArray(data.elements) &&
      data.elements.every((element: unknown) => {
        if (!element || typeof element !== "object") return false;
        const item = element as Record<string, unknown>;
        return (
          item.type === "count" ||
          (["node", "way", "relation"].includes(String(item.type)) &&
            Number.isSafeInteger(item.id) &&
            Number(item.id) > 0)
        );
      });
    if (!response.ok) {
      receipt.outcome = "http";
      receipt.message =
        response.status === 429
          ? "HTTP 429: för många anrop. Stoppa provet."
          : `HTTP ${response.status}: API:t avvisade eller kunde inte besvara frågan.`;
      receipt.excerpt = text.slice(0, 2000);
    } else if (!receipt.validOsmJson || !data) {
      receipt.outcome = "json";
      receipt.message =
        "Svaret är inte giltig OSM-JSON (version 0.6 och giltig elements-lista krävs).";
      receipt.excerpt = text.slice(0, 2000);
    } else {
      const elements = data.elements as Record<string, unknown>[];
      receipt.elements = elements
        .flatMap((element) => {
          if (element.type === "count") return [];
          const tags =
            element.tags && typeof element.tags === "object"
              ? Object.fromEntries(
                  Object.entries(element.tags).filter((entry) => typeof entry[1] === "string"),
                )
              : {};
          return [{ type: element.type as OsmProbeElement["type"], id: Number(element.id), tags }];
        })
        .slice(0, OVERPASS_RESULT_LIMIT);
      const count = elements.find((element) => element.type === "count");
      const reportedTotal = (count?.tags as Record<string, unknown> | undefined)?.total;
      const total =
        typeof reportedTotal === "string" && /^\d+$/.test(reportedTotal)
          ? Number(reportedTotal)
          : NaN;
      receipt.total = Number.isSafeInteger(total) && total >= 0 ? total : null;
      const osm3s = data.osm3s as Record<string, unknown> | undefined;
      receipt.sourceTime =
        typeof osm3s?.timestamp_osm_base === "string" ? osm3s.timestamp_osm_base : null;
      receipt.capped =
        receipt.total !== null
          ? receipt.total > receipt.elements.length
          : receipt.elements.length >= OVERPASS_RESULT_LIMIT;
      if (data.remark) {
        receipt.outcome = "partial";
        receipt.message =
          "OSM-JSON mottagen, men API:t rapporterar ett ofullständigt svar. Stoppa provet.";
        receipt.excerpt = String(data.remark).slice(0, 2000);
      } else {
        receipt.outcome = "success";
        receipt.complete = true;
        receipt.message = "Giltig OSM-JSON mottagen utan rapporterat API-fel.";
      }
    }
  } catch (error) {
    if (timedOut) {
      receipt.outcome = "timeout";
      receipt.message = "Avbrutet efter 45 sekunder. Inget automatiskt återförsök görs.";
    } else if (cancellation.aborted) {
      receipt.outcome = "cancelled";
      receipt.message = "Du avbröt anropet. Inget nytt anrop startas.";
    } else if (error instanceof RangeError) {
      receipt.outcome = "size";
      receipt.message = "Avbrutet: svaret överskred 512 KiB. Resultatet är inte komplett.";
    } else {
      receipt.outcome = "network";
      receipt.message =
        "CORS-/nätverksfel: webbläsaren lämnade inget läsbart svar. Sidan kan inte skilja CORS från DNS, TLS eller annat nätverksfel. Kontrollera samma fråga i en ny flik.";
    }
  } finally {
    clearTimeout(timer);
    cancellation.removeEventListener("abort", cancel);
    receipt.elapsedMs = Math.round(performance.now() - started);
  }
  return receipt;
}
