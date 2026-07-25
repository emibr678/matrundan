/**
 * Härledd gamification för Matrundan.
 *
 * Inga poäng lagras. Alla värden beräknas ur AppState (samma modell både för
 * demo och live). En medlem får kredit för besök där hen är listad som
 * deltagare och besöket räknas mot progression i gruppen (original eller
 * shared med countsForProgression=true). Registreraren utan deltagande får
 * ingen kredit.
 */
import type {
  AppState,
  BadgeId,
  EarnedBadge,
  GroupMilestone,
  LeaderboardRow,
  LevelDef,
  MemberProgression,
  Visit,
} from "./types";

export const LEVELS: LevelDef[] = [
  { threshold: 0, name: "Nyfiken" },
  { threshold: 1, name: "Provsmakaren" },
  { threshold: 4, name: "Krogspanaren" },
  { threshold: 10, name: "Matupptäckaren" },
  { threshold: 20, name: "Smakjägaren" },
  { threshold: 40, name: "Matkonnässören" },
  { threshold: 75, name: "Matrundemästaren" },
];

export const BADGES: Record<
  BadgeId,
  { name: string; emoji: string; description: string }
> = {
  "first-round": {
    name: "Första rundan",
    emoji: "🍽️",
    description: "Ditt första besök med gruppen.",
  },
  "world-taster": {
    name: "Världsvan",
    emoji: "🌍",
    description: "Provat minst 5 olika kökstyper.",
  },
  "flavor-spectrum": {
    name: "Smakspektrat",
    emoji: "🎨",
    description: "Besökt ställen som täcker 4 olika kategorier/tillfällen.",
  },
  regular: {
    name: "Stammis",
    emoji: "🔁",
    description: "Deltagit tre gånger på samma ställe.",
  },
  bullseye: {
    name: "Fullträff",
    emoji: "🎯",
    description: "Ett ställe du föreslog blev besökt av gänget.",
  },
};

function levelFor(count: number): { index: number; name: string; next: number | null } {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (count >= LEVELS[i].threshold) idx = i;
  }
  const next = LEVELS[idx + 1]?.threshold ?? null;
  return { index: idx, name: LEVELS[idx].name, next };
}

function countsForProgression(state: AppState, v: Visit): boolean {
  if (v.linkType === "shared") {
    // Delade besök räknas endast om gruppen och länken tillåter det.
    if (v.countsForProgression === false) return false;
    if (state.group.sharedVisitsCountForProgression === false) return false;
  }
  return true;
}

function normalizeCuisine(c: string): string {
  return c.trim().toLowerCase();
}

export function computeMemberProgression(
  state: AppState,
  memberId: string,
): MemberProgression {
  const placeById = new Map(state.places.map((p) => [p.id, p]));

  const participated = state.visits
    .filter((v) => v.participantIds.includes(memberId))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const scoring = participated.filter((v) => countsForProgression(state, v));

  const uniquePlaceIds = new Set(scoring.map((v) => v.placeId));
  const cuisineSet = new Set<string>();
  const categorySet = new Set<string>();

  scoring.forEach((v) => {
    const p = placeById.get(v.placeId);
    if (!p) return;
    p.cuisines.forEach((c) => cuisineSet.add(normalizeCuisine(c)));
    if (p.category) categorySet.add(`c:${p.category}`);
    p.occasions.forEach((o) => categorySet.add(`o:${o}`));
  });

  const lvl = levelFor(scoring.length);

  // Badges
  const badges: EarnedBadge[] = [];

  // Första rundan – första scoring-visit
  if (scoring.length > 0) {
    badges.push({ id: "first-round", earnedAt: scoring[0].date });
  }

  // Världsvan – 5 unika kökstyper (kronologiskt tröskelvärde)
  {
    const seen = new Set<string>();
    let earnedAt: string | null = null;
    for (const v of scoring) {
      const p = placeById.get(v.placeId);
      p?.cuisines.forEach((c) => seen.add(normalizeCuisine(c)));
      if (seen.size >= 5) {
        earnedAt = v.date;
        break;
      }
    }
    if (earnedAt) badges.push({ id: "world-taster", earnedAt });
  }

  // Smakspektrat – union(kategori, tillfällen) >= 4
  {
    const seen = new Set<string>();
    let earnedAt: string | null = null;
    for (const v of scoring) {
      const p = placeById.get(v.placeId);
      if (!p) continue;
      seen.add(`c:${p.category}`);
      p.occasions.forEach((o) => seen.add(`o:${o}`));
      if (seen.size >= 4) {
        earnedAt = v.date;
        break;
      }
    }
    if (earnedAt) badges.push({ id: "flavor-spectrum", earnedAt });
  }

  // Stammis – 3:e deltagande på samma canonical place (räknar alla synliga
  // besök i gruppen, ej beroende av shared-toggle).
  {
    const counts = new Map<string, number>();
    let earnedAt: string | null = null;
    for (const v of participated) {
      const n = (counts.get(v.placeId) ?? 0) + 1;
      counts.set(v.placeId, n);
      if (n >= 3) {
        earnedAt = v.date;
        break;
      }
    }
    if (earnedAt) badges.push({ id: "regular", earnedAt });
  }

  // Fullträff – ett ställe medlemmen föreslog i gruppen (origin != 'shared')
  // som blivit besökt (original-visit) med minst en annan deltagare.
  {
    let earnedAt: string | null = null;
    const proposedPlaces = state.places.filter(
      (p) => p.addedBy === memberId && p.origin !== "shared",
    );
    for (const p of proposedPlaces) {
      const qualifying = state.visits
        .filter(
          (v) =>
            v.placeId === p.id &&
            (v.linkType ?? "original") === "original" &&
            v.participantIds.some((id) => id !== memberId),
        )
        .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
      if (qualifying) {
        if (!earnedAt || qualifying.date < earnedAt) earnedAt = qualifying.date;
      }
    }
    if (earnedAt) badges.push({ id: "bullseye", earnedAt });
  }

  return {
    memberId,
    visits: scoring.length,
    uniquePlaces: uniquePlaceIds.size,
    uniqueCuisines: cuisineSet.size,
    breadthCategories: categorySet.size,
    levelIndex: lvl.index,
    levelName: lvl.name,
    nextThreshold: lvl.next,
    badges,
  };
}

function denseRank(rows: { memberId: string; value: number }[]): LeaderboardRow[] {
  const sorted = [...rows].sort((a, b) => b.value - a.value || a.memberId.localeCompare(b.memberId));
  const out: LeaderboardRow[] = [];
  let rank = 0;
  let prev: number | null = null;
  for (const r of sorted) {
    if (prev === null || r.value !== prev) rank += 1;
    out.push({ memberId: r.memberId, value: r.value, rank });
    prev = r.value;
  }
  return out;
}

function inYear(iso: string, year: number): boolean {
  return iso.startsWith(`${year}-`);
}

export type LeaderboardCategory = "visits" | "newPlaces" | "breadth";
export type LeaderboardPeriod = "year" | "all";

export function computeLeaderboard(
  state: AppState,
  category: LeaderboardCategory,
  period: LeaderboardPeriod,
): LeaderboardRow[] {
  const year = new Date().getFullYear();
  const placeById = new Map(state.places.map((p) => [p.id, p]));

  const rows = state.members.map((m) => {
    const memberScoringVisits = state.visits
      .filter(
        (v) =>
          v.participantIds.includes(m.id) &&
          countsForProgression(state, v) &&
          (period === "all" || inYear(v.date, year)),
      )
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    let value = 0;
    if (category === "visits") {
      value = memberScoringVisits.length;
    } else if (category === "newPlaces") {
      // Nya matställen inom perioden = distinkta placeIds där medlemmens
      // första någonsin-deltagande på det stället inföll inom perioden.
      const firstByPlace = new Map<string, string>();
      for (const v of state.visits.filter((x) => x.participantIds.includes(m.id))) {
        const prev = firstByPlace.get(v.placeId);
        if (!prev || v.date < prev) firstByPlace.set(v.placeId, v.date);
      }
      let n = 0;
      for (const [, firstDate] of firstByPlace) {
        if (period === "all" || inYear(firstDate, year)) n += 1;
      }
      value = n;
    } else {
      const set = new Set<string>();
      for (const v of memberScoringVisits) {
        const p = placeById.get(v.placeId);
        p?.cuisines.forEach((c) => set.add(normalizeCuisine(c)));
      }
      value = set.size;
    }
    return { memberId: m.id, value };
  });

  return denseRank(rows);
}

export function computeGroupMilestones(state: AppState): GroupMilestone[] {
  const out: GroupMilestone[] = [];
  const thresholds = [10, 25, 50, 100];

  // Unika ställen (bland ställen som gruppen besökt minst en gång).
  const visitedPlaceIds = new Set(state.visits.map((v) => v.placeId));
  const uniqueVisited = [...visitedPlaceIds]
    .map((id) => {
      const first = state.visits
        .filter((v) => v.placeId === id)
        .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
      return { id, at: first?.date ?? "" };
    })
    .sort((a, b) => (a.at < b.at ? -1 : 1));

  thresholds.forEach((t) => {
    if (uniqueVisited.length >= t && uniqueVisited[t - 1]) {
      out.push({
        id: `places-${t}`,
        kind: "places-count",
        at: uniqueVisited[t - 1].at,
        label: `${t} besökta ställen`,
      });
    }
  });

  // Årsdagar
  if (state.group.createdAt) {
    const start = new Date(state.group.createdAt);
    const now = new Date();
    let years = now.getFullYear() - start.getFullYear();
    const beforeAnniv =
      now.getMonth() < start.getMonth() ||
      (now.getMonth() === start.getMonth() && now.getDate() < start.getDate());
    if (beforeAnniv) years -= 1;
    for (let y = 1; y <= years; y++) {
      const at = new Date(start);
      at.setFullYear(start.getFullYear() + y);
      out.push({
        id: `anniv-${y}`,
        kind: "anniversary",
        at: at.toISOString(),
        label: y === 1 ? "Ett år som grupp" : `${y} år som grupp`,
      });
    }
  }

  // Första besök med hela aktiva gruppen
  const activeIds = state.members.map((m) => m.id);
  if (activeIds.length >= 2) {
    const full = state.visits
      .filter((v) => activeIds.every((id) => v.participantIds.includes(id)))
      .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
    if (full) {
      out.push({
        id: `full-group-${full.id}`,
        kind: "full-group-visit",
        at: full.date,
        label: "Första besöket med hela gänget",
      });
    }
  }

  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
}
