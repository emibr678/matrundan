import { geoapifySearchRecipe } from "./geoapify-place-search";
import { sourceIdentityKey, sourceSearchEvidence } from "./place-search-evidence";
import { normalizePlaceFeature, type NormalizedPlaceSuggestion } from "./geoapify-normalize";
import type { PlaceSearchIntent } from "./place-search-intent";

export interface SearchStreamCursor {
  scope: string;
  direct: number;
  metadata: number;
  metadataType: number;
  directDone: boolean;
  metadataDone: boolean;
  /** Resume the deferred stream first; old cursors start with direct as before. */
  nextStream?: "direct" | "metadata";
}
type Payload = { features?: unknown[] };
type Feature = Parameters<typeof normalizePlaceFeature>[0];
const MAX_OFFSET = 10_000;

/** One page per strategy and area. A failed stream retains its cursor for explicit retry. */
export async function searchGeoapifyCatalogue(input: {
  url: URL;
  intent: PlaceSearchIntent;
  limit: number;
  cursor?: SearchStreamCursor;
  /** Use the spare budget slot only when there is one active search area. */
  parallelStreams?: boolean;
  fetch: (url: URL) => Promise<Payload>;
}) {
  const recipe = geoapifySearchRecipe(input.intent);
  const base = new URL(input.url);
  base.searchParams.delete("apiKey");
  base.searchParams.delete("limit");
  base.searchParams.delete("offset");
  base.searchParams.delete("categories");
  const scope = JSON.stringify([
    recipe.id,
    base.toString(),
    recipe.direct,
    recipe.supplement,
    recipe.conditions,
  ]);
  const cursor: SearchStreamCursor =
    input.cursor?.scope === scope
      ? { ...input.cursor }
      : {
          scope,
          direct: 0,
          metadata: 0,
          metadataType: 0,
          directDone: !recipe.direct.length,
          metadataDone: !recipe.supplement.length,
        };
  const streams = ["direct", "metadata"] as const;
  const scheduledStreams = cursor.nextStream === "metadata" ? [...streams].reverse() : streams;
  const streamResults = {
    direct: new Map<string, NormalizedPlaceSuggestion>(),
    metadata: new Map<string, NormalizedPlaceSuggestion>(),
  };
  const errors: { direct?: unknown; metadata?: unknown } = {};
  const completed = new Set<(typeof streams)[number]>();
  let incomplete = false;
  let successful = 0;
  const runStream = async (stream: (typeof streams)[number]) => {
    const done = stream === "direct" ? "directDone" : "metadataDone";
    if (cursor[done]) return;
    const results = streamResults[stream];
    const categories = stream === "direct" ? recipe.direct : recipe.supplement[cursor.metadataType];
    const limit = stream === "direct" ? input.limit : 50;
    const url = new URL(input.url);
    url.searchParams.set("categories", categories.join(","));
    url.searchParams.set("limit", String(limit));
    url.searchParams.delete("offset");
    if (cursor[stream]) url.searchParams.set("offset", String(cursor[stream]));
    if (stream === "direct" && recipe.conditions.length)
      url.searchParams.set("conditions", recipe.conditions.join(","));
    try {
      const payload = await input.fetch(url);
      if (!Array.isArray(payload.features))
        throw new Error("GEOAPIFY_MALFORMED: Platslistan saknas.");
      successful++;
      completed.add(stream);
      for (const feature of payload.features) {
        if (!feature || typeof feature !== "object") continue;
        const evidence = sourceSearchEvidence(feature as Feature, input.intent);
        if (!evidence) continue;
        let place: NormalizedPlaceSuggestion | null;
        try {
          place = normalizePlaceFeature(feature as Feature);
        } catch {
          incomplete = true;
          continue;
        } // Isolate a malformed row, retain valid neighbours.

        if (!place) continue;
        place.searchEvidence = evidence;
        place.searchIdentityKey = sourceIdentityKey(place.raw);
        const key = place.searchIdentityKey ?? `${place.provider}:${place.externalId}`;
        if (!results.has(key)) results.set(key, place);
      }
      cursor[stream] += limit;
      const endOfStream = payload.features.length < limit || cursor[stream] >= MAX_OFFSET;
      if (payload.features.length >= limit && cursor[stream] >= MAX_OFFSET) incomplete = true;
      if (
        stream === "metadata" &&
        endOfStream &&
        cursor.metadataType + 1 < recipe.supplement.length
      ) {
        cursor.metadataType++;
        cursor.metadata = 0;
      } else cursor[done] = endOfStream;
    } catch (error) {
      // An intentional per-action budget stop defers this cursor, it is not a
      // failed area/provider. The shared budget receipt already reports limited.
      const message =
        error && typeof error === "object" && "message" in error ? error.message : null;
      if (typeof message === "string" && message.startsWith("GEOAPIFY_SEARCH_BUDGET:")) return;
      incomplete = true;
      errors[stream] = error;
    }
  };
  if (input.parallelStreams) await Promise.all(scheduledStreams.map(runStream));
  else for (const stream of scheduledStreams) await runStream(stream);
  // Advance priority only on success, in scheduling order rather than arrival
  // order. A cold 5-request action can then alternate across five areas without
  // starving metadata behind an arbitrarily long direct stream.
  for (const stream of scheduledStreams)
    if (completed.has(stream)) cursor.nextStream = stream === "direct" ? "metadata" : "direct";
  // Arrival order must never choose a different identity or source representative.
  const results = new Map<string, NormalizedPlaceSuggestion>();
  for (const stream of streams)
    for (const [key, place] of streamResults[stream])
      if (!results.has(key)) results.set(key, place);
  const firstError = errors.direct ?? errors.metadata;
  if (firstError && successful === 0) throw firstError;
  return {
    results: [...results.values()],
    cursor,
    incomplete,
    hasMore: !cursor.directDone || !cursor.metadataDone,
    nextOffset: Math.max(cursor.direct, cursor.metadata, cursor.metadataType * 50),
  };
}
