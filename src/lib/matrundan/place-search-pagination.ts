import type { PlaceSuggestion } from "./places-provider";

/**
 * Ren sammanslagning av två sidor sökträffar från platsleverantören.
 *
 * Bevarar ordningen på redan visade `current`-träffar exakt. Dubbletter
 * uppdaterar metadata på samma position: kortast verifierat avstånd vinner,
 * `matchingAreaLabels` slås ihop utan dubletter och `nearestAreaLabel` följer
 * den närmaste versionen. Genuint nya träffar från `incoming` läggs sist i
 * inkommande ordning. Listan sorteras inte om.
 */
export function mergePlaceSearchPages(
  current: PlaceSuggestion[],
  incoming: PlaceSuggestion[],
): PlaceSuggestion[] {
  const merged = new Map<string, PlaceSuggestion>();
  const order: string[] = [];

  function keyOf(suggestion: PlaceSuggestion) {
    return `${suggestion.provider ?? "unknown"}:${suggestion.externalId}`;
  }

  for (const suggestion of [...current, ...incoming]) {
    const key = keyOf(suggestion);
    const existing = merged.get(key);
    if (!existing) {
      order.push(key);
      merged.set(key, {
        ...suggestion,
        matchingAreaLabels: suggestion.matchingAreaLabels
          ? [...new Set(suggestion.matchingAreaLabels)]
          : suggestion.matchingAreaLabels,
        matchingAreaIds: suggestion.matchingAreaIds
          ? [...new Set(suggestion.matchingAreaIds)]
          : suggestion.matchingAreaIds,
      });
      continue;
    }

    const existingDistance = existing.distanceKm ?? Number.POSITIVE_INFINITY;
    const nextDistance = suggestion.distanceKm ?? Number.POSITIVE_INFINITY;
    const useIncoming = nextDistance < existingDistance;
    const base = useIncoming ? suggestion : existing;
    const labels = [
      ...new Set([
        ...(existing.matchingAreaLabels ?? []),
        ...(suggestion.matchingAreaLabels ?? []),
      ]),
    ];
    const areaIds = [
      ...new Set([...(existing.matchingAreaIds ?? []), ...(suggestion.matchingAreaIds ?? [])]),
    ];

    merged.set(key, {
      ...base,
      ...(suggestion.identity ? { identity: suggestion.identity } : {}),
      ...(suggestion.canonical ? { canonical: suggestion.canonical } : {}),
      nearestAreaLabel: base.nearestAreaLabel ?? existing.nearestAreaLabel,
      nearestAreaId: base.nearestAreaId ?? existing.nearestAreaId,
      ...(labels.length > 0 ? { matchingAreaLabels: labels } : {}),
      ...(areaIds.length > 0 ? { matchingAreaIds: areaIds } : {}),
    });
  }

  return order.map((key) => merged.get(key)!);
}

/**
 * Rangordna endast en NY inkommande resultatsida. Tidigare visade rader
 * sorteras aldrig om när nästa sida hämtas.
 *
 * Namnmatchning och verkligt punktavstånd går före datakällan.
 * Vid jämförbara träffar vinner kartkällan framför en kanonisk kandidat.
 * Avsaknad av avstånd (t.ex. en boundary) är inte ett påstått stort avstånd.
 */
export function rankNewPlaceSearchPage(
  suggestions: PlaceSuggestion[],
  query: string,
): PlaceSuggestion[] {
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("sv-SE")
      .trim();
  const needle = normalize(query);
  const matchQuality = (result: PlaceSuggestion) => {
    if (!needle) return 0;
    const name = normalize(result.name);
    if (name === needle) return 0;
    if (name.startsWith(needle)) return 1;
    if (name.includes(needle)) return 2;
    return result.searchMatchType === "tolerant" ? 3 : 4;
  };
  const areaRank = (result: PlaceSuggestion) =>
    result.searchAreaGroup === "name-outside" ? 2 : result.searchAreaGroup === "nearby" ? 1 : 0;

  return [...suggestions].sort((a, b) => {
    const area = areaRank(a) - areaRank(b);
    if (area !== 0) return area;
    const match = matchQuality(a) - matchQuality(b);
    if (match !== 0) return match;
    // Compare measured point distances, but not invented boundary distances.
    if (a.distanceKm != null && b.distanceKm != null) {
      const distance = a.distanceKm - b.distanceKm;
      if (Math.abs(distance) > 0.2) return distance;
    }
    // The source is a tie-breaker, never a substitute for an exact name match.
    const aCanonical = a.kind === "canonical";
    const bCanonical = b.kind === "canonical";
    if (aCanonical !== bCanonical) return aCanonical ? 1 : -1;
    return 0;
  });
}

/**
 * Räknar hur många träffar som faktiskt är handlingsbara för användaren.
 *
 * Predikatet kommer från vyn och exkluderar dolda träffar och sådana som redan
 * finns i gruppen.
 */
export function countActionableSuggestions(
  suggestions: PlaceSuggestion[],
  isActionable: (suggestion: PlaceSuggestion) => boolean,
): number {
  let count = 0;
  for (const suggestion of suggestions) {
    if (isActionable(suggestion)) count += 1;
  }
  return count;
}

/**
 * Var listan ska klippas för att visa `targetActionable` handlingsbara träffar.
 *
 * Ordningen bevaras exakt. Om målet inte kan nås returneras hela listan.
 */
export function actionableSliceIndex(
  suggestions: PlaceSuggestion[],
  isActionable: (suggestion: PlaceSuggestion) => boolean,
  targetActionable: number,
): number {
  if (targetActionable <= 0) return 0;
  let count = 0;
  for (let index = 0; index < suggestions.length; index += 1) {
    if (isActionable(suggestions[index])) {
      count += 1;
      if (count >= targetActionable) return index + 1;
    }
  }
  return suggestions.length;
}

/**
 * Map-only presentation: round-robin across actual search-area IDs.
 * Does not change canonical identity or reorder paginated list results.
 */
export function selectMapCandidates(
  results: PlaceSuggestion[],
  areaIds: string[],
  totalLimit = 200,
  perAreaLimit = 100,
): PlaceSuggestion[] {
  const selected: PlaceSuggestion[] = [];
  const pools = new Map<string, PlaceSuggestion[]>();
  const known = new Set(areaIds);
  for (const id of areaIds) pools.set(id, []);
  const other: PlaceSuggestion[] = [];
  for (const result of results) {
    if (result.nearestAreaId && known.has(result.nearestAreaId)) {
      pools.get(result.nearestAreaId)!.push(result);
    } else {
      other.push(result);
    }
  }
  const counts = new Map<string, number>();
  const indexes = new Map<string, number>();
  for (const id of areaIds) {
    counts.set(id, 0);
    indexes.set(id, 0);
  }
  while (selected.length < totalLimit) {
    let added = false;
    for (const id of areaIds) {
      const pool = pools.get(id)!;
      const index = indexes.get(id)!;
      if (index >= pool.length || counts.get(id)! >= perAreaLimit) continue;
      selected.push(pool[index]);
      indexes.set(id, index + 1);
      counts.set(id, counts.get(id)! + 1);
      added = true;
      if (selected.length >= totalLimit) break;
    }
    if (!added) break;
  }
  // Older demo snapshots have no nearestAreaId: preserve those candidates too.
  return [...selected, ...other].slice(0, totalLimit);
}
