const distanceFormatter = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 });

/** Round only the displayed distance; filtering and sorting retain full precision. */
export function formatSearchDistanceKm(distanceKm: number): string {
  return distanceFormatter.format(distanceKm);
}
