/**
 * At most one nearby recovery step for a specific business name.
 * Search-area membership itself never changes.
 */
export function expandedNameRadiusKm(radiusKm: number | null): number | null {
  const radius = radiusKm ?? 50;
  if (!Number.isFinite(radius) || radius < 1 || radius >= 50) return null;
  return Math.min(50, radius + Math.min(radius, 2));
}
