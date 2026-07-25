/**
 * Lättviktig medlemsstatistik och neutrala "smakspår".
 *
 * Tidigare versioner hade ett XP/nivåsystem och en "Månadens matvän"-topplista.
 * För en privat grupp med ~6 personer som äter tillsammans ~1–4 gånger/månad
 * blev det mest en dubbel räknare av gruppens gemensamma historik, och att
 * rangordna vänner efter deltagande skavde. Från 0.5.0 fokuserar vi istället
 * på:
 *  - enkla nyckeltal (Besök, Provade, Föreslagna) direkt på profilen,
 *  - neutrala "smakspår" som fångar upplevelsemönster utan tävlingston,
 *  - en gruppgemensam månadssammanfattning (utan att peka ut individ).
 */

import type { AppState, Place } from "./types";

export interface TasteTrack {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

const TRACK_DEFS = {
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
} as const;

/**
 * Returnerar upplevelsebaserade "smakspår" för en medlem.
 * Belönar inte administrativt beteende (som att föreslå ställen eller fylla
 * i detaljbetyg) – bara mönster i vad medlemmen faktiskt har ätit.
 */
export function tasteTracksFor(state: AppState, memberId: string): TasteTrack[] {
  const tracks: TasteTrack[] = [];
  const memberVisits = state.visits.filter((v) =>
    v.participantIds.includes(memberId),
  );

  const perPlace = new Map<string, number>();
  memberVisits.forEach((v) =>
    perPlace.set(v.placeId, (perPlace.get(v.placeId) ?? 0) + 1),
  );
  if ([...perPlace.values()].some((n) => n >= 3)) tracks.push(TRACK_DEFS.stammis);

  const cuisines = new Set<string>();
  memberVisits.forEach((v) => {
    const place = state.places.find((p) => p.id === v.placeId);
    place?.cuisines.forEach((c) => cuisines.add(c));
  });
  if (cuisines.size >= 3) tracks.push(TRACK_DEFS.varieté);

  return tracks;
}

/** Antal unika ställen en medlem har provat i gruppen. */
export function triedPlacesCount(state: AppState, memberId: string): number {
  const set = new Set<string>();
  for (const v of state.visits) {
    if (v.participantIds.includes(memberId)) set.add(v.placeId);
  }
  return set.size;
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

export interface MonthSummary {
  visitCount: number;
  uniquePlaceCount: number;
  topPlace: Place | null;
  topRating: number;
}

/**
 * Neutral månadssammanfattning för hela gruppen (inte rangordnad per person).
 * Räknar besök i den senaste 30-dagarsperioden.
 */
export function monthSummary(state: AppState): MonthSummary {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = state.visits.filter(
    (v) => new Date(v.date).getTime() >= cutoff,
  );

  const placeIds = new Set(recent.map((v) => v.placeId));
  let topPlace: Place | null = null;
  let topRating = 0;
  for (const v of recent) {
    if (v.overall > topRating) {
      topRating = v.overall;
      topPlace = state.places.find((p) => p.id === v.placeId) ?? null;
    }
  }

  return {
    visitCount: recent.length,
    uniquePlaceCount: placeIds.size,
    topPlace,
    topRating,
  };
}
