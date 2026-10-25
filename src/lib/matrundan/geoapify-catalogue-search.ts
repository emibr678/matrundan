import { geoapifySearchRecipe } from "./geoapify-place-search";
import { sourceIdentityKey, relevantSourceSearchEvidence } from "./place-search-evidence";
import { searchRelevanceRank } from "./place-search-intent";
import { normalizePlaceFeature, type NormalizedPlaceSuggestion } from "./geoapify-normalize";
import type { PlaceSearchIntent } from "./place-search-intent";

export interface SearchStreamCursor {
  version?: 2;
  scope: string;
  direct: number;
  related?: number;
  metadata: number;
  metadataType: number;
  directDone: boolean;
  relatedDone?: boolean;
  metadataDone: boolean;
  /** Resume the deferred stream first; old cursors start with direct as before. */
  nextStream?: "direct" | "related" | "metadata";
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
    2,
    recipe.id,
    base.toString(),
    recipe.direct,
    recipe.related,
    recipe.supplement,
    recipe.conditions,
  ]);
  const firstPage = input.cursor?.scope !== scope;
  const cursor: SearchStreamCursor = !firstPage
    ? { ...input.cursor! }
    : {
        version: 2,
        scope,
        direct: 0,
        related: 0,
        metadata: 0,
        metadataType: 0,
        directDone: !recipe.direct.length,
        relatedDone: !recipe.related.length,
        metadataDone: !recipe.supplement.length,
      };
  const streams = ["direct", "related", "metadata"] as const;
  const start = Math.max(0, streams.indexOf(cursor.nextStream ?? "direct"));
  const scheduledStreams = [...streams.slice(start), ...streams.slice(0, start)];
  const streamResults = {
    direct: new Map<string, NormalizedPlaceSuggestion>(),
    related: new Map<string, NormalizedPlaceSuggestion>(),
    metadata: new Map<string, NormalizedPlaceSuggestion>(),
  };
  const errors: Partial<Record<(typeof streams)[number], unknown>> = {};
  const completed = new Set<(typeof streams)[number]>();
  let incomplete = false;
  let successful = 0;
  const runStream = async (stream: (typeof streams)[number]) => {
    const done =
      stream === "direct" ? "directDone" : stream === "related" ? "relatedDone" : "metadataDone";
    if (cursor[done]) return;
    const results = streamResults[stream];
    const categories =
      stream === "direct"
        ? recipe.direct
        : stream === "related"
          ? recipe.related
          : recipe.supplement[cursor.metadataType];
    const limit =
      stream === "metadata" ? 50 : stream === "related" ? Math.min(input.limit, 20) : input.limit;
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
        const evidence = relevantSourceSearchEvidence(feature as Feature, input.intent);
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
        if (
          !results.has(key) ||
          searchRelevanceRank(place) < searchRelevanceRank(results.get(key)!)
        )
          results.set(key, place);
      }
      const next = (cursor[stream] ?? 0) + limit;
      cursor[stream] = next;
      const endOfStream = payload.features.length < limit || next >= MAX_OFFSET;
      if (payload.features.length >= limit && next >= MAX_OFFSET) incomplete = true;
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
  const run = async (scheduled: (typeof streams)[number][]) => {
    if (input.parallelStreams) await Promise.all(scheduled.map(runStream));
    else for (const stream of scheduled) await runStream(stream);
  };
  if (firstPage && recipe.related.length && recipe.direct.length) {
    // Protect exact retrieval. Related categories share one bounded OR request,
    // rather than competing for the exact page's twenty provider slots.
    await run(["direct", "related"]);
    const useful = new Set([...streamResults.direct.keys(), ...streamResults.related.keys()]);
    // Raw-only exact searches (Pasta/Falafel) retain their first metadata page.
    // Heuristic only on the initial page. Deferred metadata gets the next turn,
    // even if a long related stream continues to return many candidates.
    if (useful.size < 10) await runStream("metadata");
  } else await run(scheduledStreams);
  // Advance priority only on success, in scheduling order rather than arrival
  // order. A cold 5-request action can then alternate across five areas without
  // starving metadata behind an arbitrarily long direct stream.
  for (const stream of scheduledStreams)
    if (completed.has(stream))
      cursor.nextStream = streams[(streams.indexOf(stream) + 1) % streams.length];
  // Arrival order must never choose a different identity or source representative.
  const results = new Map<string, NormalizedPlaceSuggestion>();
  for (const stream of streams)
    for (const [key, place] of streamResults[stream])
      if (!results.has(key) || searchRelevanceRank(place) < searchRelevanceRank(results.get(key)!))
        results.set(key, place);
  const firstError = errors.direct ?? errors.related ?? errors.metadata;
  if (firstError && successful === 0) throw firstError;
  return {
    results: [...results.values()].sort((a, b) => searchRelevanceRank(a) - searchRelevanceRank(b)),
    cursor,
    incomplete,
    hasMore: !cursor.directDone || !cursor.relatedDone || !cursor.metadataDone,
    nextOffset: Math.max(
      cursor.direct,
      cursor.related ?? 0,
      cursor.metadata,
      cursor.metadataType * 50,
    ),
  };
}
