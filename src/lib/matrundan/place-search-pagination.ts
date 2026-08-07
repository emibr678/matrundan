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

    merged.set(key, {
      ...base,
      nearestAreaLabel: base.nearestAreaLabel ?? existing.nearestAreaLabel,
      ...(labels.length > 0 ? { matchingAreaLabels: labels } : {}),
    });
  }

  return order.map((key) => merged.get(key)!);
}

