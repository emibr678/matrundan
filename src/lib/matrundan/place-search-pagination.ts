import type { PlaceSuggestion } from "./places-provider";

/**
 * Ren sammanslagning av två sidor sökträffar från platsleverantören.
 *
 * Deduplicerar på provider + externalId, behåller den version som har kortast
 * verifierat avstånd, slår ihop `matchingAreaLabels` utan dubletter och låter
 * `nearestAreaLabel` följa den närmaste versionen. Slutresultatet sorteras på
 * avstånd och därefter svenskt namn.
 */
export function mergePlaceSearchPages(
  current: PlaceSuggestion[],
  incoming: PlaceSuggestion[],
): PlaceSuggestion[] {
  const merged = new Map<string, PlaceSuggestion>();
  const order: string[] = [];

  for (const suggestion of [...current, ...incoming]) {
    const key = `${suggestion.provider ?? "unknown"}:${suggestion.externalId}`;
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

  return order
    .map((key) => merged.get(key)!)
    .sort((a, b) => {
      const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
      return da - db || a.name.localeCompare(b.name, "sv-SE");
    });
}
