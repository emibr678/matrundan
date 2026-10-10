/**
 * At most one nearby recovery step for a specific business name.
 * Search-area membership itself never changes.
 */
export function expandedNameRadiusKm(radiusKm: number | null): number | null {
  const radius = radiusKm ?? 50;
  if (!Number.isFinite(radius) || radius < 1 || radius >= 50) return null;
  return Math.min(50, radius + Math.min(radius, 2));
}

/**
 * Provider retrieval may need a little overscan to return a candidate that
 * truly lies within the separately enforced, bounded nearby result radius.
 * Never use this radius to admit a displayed result.
 */
export function nameRecoveryProbeRadiusKm(radiusKm: number | null): number | null {
  const acceptedNearbyRadius = expandedNameRadiusKm(radiusKm);
  return acceptedNearbyRadius == null
    ? null
    : Math.min(50, acceptedNearbyRadius + Math.min(acceptedNearbyRadius, 2));
}
