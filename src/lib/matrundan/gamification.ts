/**
 * Gamification: nivåer och utmärkelser för gruppmedlemmar.
 *
 * Design:
 *  - Nivån räknas per grupp och baseras på antal UNIKA ställen medlemmen
 *    har provat i gruppen (dvs. gruppens gemensamma matresa – inte
 *    aktivitet i andra grupper). Detta bevarar poängen med isolerade,
 *    privata grupper.
 *  - Utmärkelser fångar bredd: nyfikenhet, uthållighet, kritiker-öga,
 *    och månadens rundare.
 *  - Ingen leaderboard i strikt mening ännu; istället en varm "Denna
 *    månad"-höjdpunkt i Gruppen-vyn.
 */

import type { AppState, Place } from "./types";

export interface Level {
  index: number;
  min: number;
  name: string;
  emoji: string;
}

export const LEVELS: Level[] = [
  { index: 0, min: 0, name: "Nyfiken", emoji: "🌱" },
  { index: 1, min: 2, name: "Provsmakare", emoji: "🍴" },
  { index: 2, min: 5, name: "Matvän", emoji: "🥄" },
  { index: 3, min: 10, name: "Rundabordare", emoji: "🍽️" },
  { index: 4, min: 20, name: "Smakkännare", emoji: "🧑‍🍳" },
  { index: 5, min: 35, name: "Matkonnässör", emoji: "🍷" },
  { index: 6, min: 60, name: "Matrundanmästare", emoji: "👑" },
];

export interface LevelInfo {
  level: Level;
  next: Level | null;
  /** Progress 0-1 mot nästa nivå. 1 om max-nivå. */
  progress: number;
  /** Ställen kvar till nästa nivå. 0 om max. */
  toNext: number;
  triedCount: number;
}

export function levelFor(triedCount: number): LevelInfo {
  let level = LEVELS[0];
  for (const l of LEVELS) if (triedCount >= l.min) level = l;
  const next = LEVELS[level.index + 1] ?? null;
  const progress = next
    ? Math.min(1, (triedCount - level.min) / (next.min - level.min))
    : 1;
  const toNext = next ? Math.max(0, next.min - triedCount) : 0;
  return { level, next, progress, toNext, triedCount };
}

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

const BADGE_DEFS = {
  utforskare: {
    id: "utforskare",
    name: "Utforskare",
    emoji: "🧭",
    description: "Har föreslagit 3+ ställen till gruppen",
  },
  kritiker: {
    id: "kritiker",
    name: "Kritiker",
    emoji: "⭐",
    description: "Har gett 5+ detaljerade betyg",
  },
  stammis: {
    id: "stammis",
    name: "Stammis",
    emoji: "🔁",
    description: "Har besökt samma ställe minst 3 gånger",
  },
  varieté: {
    id: "varieté",
    name: "Varieté",
    emoji: "🎨",
    description: "Har provat 3+ olika kök",
  },
  månadens: {
    id: "månadens",
    name: "Månadens matvän",
    emoji: "🏅",
    description: "Flest besök senaste 30 dagarna",
  },
} as const;

export function badgesFor(state: AppState, memberId: string): Badge[] {
  const badges: Badge[] = [];
  const proposed = state.places.filter((p) => p.addedBy === memberId).length;
  if (proposed >= 3) badges.push(BADGE_DEFS.utforskare);

  const memberVisits = state.visits.filter((v) =>
    v.participantIds.includes(memberId),
  );
  const detailed = memberVisits.filter(
    (v) => v.taste != null || v.value != null || v.service != null,
  ).length;
  if (detailed >= 5) badges.push(BADGE_DEFS.kritiker);

  const perPlace = new Map<string, number>();
  memberVisits.forEach((v) =>
    perPlace.set(v.placeId, (perPlace.get(v.placeId) ?? 0) + 1),
  );
  if ([...perPlace.values()].some((n) => n >= 3)) badges.push(BADGE_DEFS.stammis);

  const cuisines = new Set<string>();
  memberVisits.forEach((v) => {
    const place = state.places.find((p) => p.id === v.placeId);
    place?.cuisines.forEach((c) => cuisines.add(c));
  });
  if (cuisines.size >= 3) badges.push(BADGE_DEFS.varieté);

  if (isMonthlyChampion(state, memberId)) badges.push(BADGE_DEFS.månadens);
  return badges;
}

export function isMonthlyChampion(state: AppState, memberId: string): boolean {
  const champ = monthlyChampion(state);
  return champ?.memberId === memberId;
}

export interface MonthlyChampion {
  memberId: string;
  count: number;
}

/** Medlem med flest besök senaste 30 dagarna. Kräver minst 2 besök. */
export function monthlyChampion(state: AppState): MonthlyChampion | null {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const counts = new Map<string, number>();
  for (const v of state.visits) {
    if (new Date(v.date).getTime() < cutoff) continue;
    for (const pid of v.participantIds) {
      counts.set(pid, (counts.get(pid) ?? 0) + 1);
    }
  }
  let best: MonthlyChampion | null = null;
  for (const [memberId, count] of counts) {
    if (!best || count > best.count) best = { memberId, count };
  }
  return best && best.count >= 2 ? best : null;
}

/** Antal unika ställen en medlem har provat i gruppen. */
export function triedPlacesCount(state: AppState, memberId: string): number {
  const set = new Set<string>();
  for (const v of state.visits) {
    if (v.participantIds.includes(memberId)) set.add(v.placeId);
  }
  return set.size;
}

/** För eventuell framtida "totalt över alla grupper"-vy. Idag: samma som group-scope. */
export function totalTriedPlaces(state: AppState, memberId: string): number {
  return triedPlacesCount(state, memberId);
}

/** Bekvämlighet för listor: senaste besökta ställe (Place | null). */
export function lastVisitedPlace(
  state: AppState,
  memberId: string,
): Place | null {
  const v = state.visits
    .filter((x) => x.participantIds.includes(memberId))
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (!v) return null;
  return state.places.find((p) => p.id === v.placeId) ?? null;
}
