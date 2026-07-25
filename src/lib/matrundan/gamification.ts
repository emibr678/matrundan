/**
 * Privat gruppcentrerad gamification för Matrundan.
 *
 * Alla värden är deterministiskt härledda ur AppState. Inga poäng, nivåer
 * eller badges lagras – varje läsning räknar om utifrån de synliga besöken
 * i den aktuella gruppen. En medlem får kredit endast för besök där hen är
 * listad som deltagare och besöket räknas mot progression (originalbesök
 * alltid; delade besök endast när både gruppens
 * `sharedVisitsCountForProgression` och besökets `countsForProgression`
 * tillåter det).
 */
import type {
  Activity,
  AppState,
  Place,
  Visit,
} from "./types";

/* ---------- Nivåer ---------- */

export interface LevelDef {
  /** Antal progression-räknade deltaganden som krävs. */
  threshold: number;
  name: string;
}

export const LEVELS: readonly LevelDef[] = [
  { threshold: 0, name: "Nyfiken" },
  { threshold: 1, name: "Provsmakaren" },
  { threshold: 4, name: "Krogspanaren" },
  { threshold: 10, name: "Matupptäckaren" },
  { threshold: 20, name: "Smakjägaren" },
  { threshold: 40, name: "Matkonnässören" },
  { threshold: 75, name: "Matrundemästaren" },
] as const;

export interface LevelInfo {
  index: number;
  name: string;
  /** Tröskel för nuvarande nivå. */
  threshold: number;
  /** Nästa tröskel eller null om maxnivån är nådd. */
  nextThreshold: number | null;
  /** Namn på nästa nivå eller null. */
  nextName: string | null;
}

export function levelForCount(count: number): LevelInfo {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (count >= LEVELS[i].threshold) idx = i;
  }
  const next = LEVELS[idx + 1] ?? null;
  return {
    index: idx,
    name: LEVELS[idx].name,
    threshold: LEVELS[idx].threshold,
    nextThreshold: next?.threshold ?? null,
    nextName: next?.name ?? null,
  };
}

/* ---------- Badges ---------- */

export type BadgeId =
  | "first-round"
  | "world-taster"
  | "broad-register"
  | "regular"
  | "bullseye";

export interface BadgeDef {
  id: BadgeId;
  name: string;
  emoji: string;
  description: string;
}

export const BADGES: Record<BadgeId, BadgeDef> = {
  "first-round": {
    id: "first-round",
    name: "Första rundan",
    emoji: "🍽️",
    description: "Ditt första besök med gruppen.",
  },
  "world-taster": {
    id: "world-taster",
    name: "Världsvan",
    emoji: "🌍",
    description: "Provat minst 5 olika kökstyper med gruppen.",
  },
  "broad-register": {
    id: "broad-register",
    name: "Brett register",
    emoji: "🎨",
    description: "Besökt matställen från minst 4 olika kategorier.",
  },
  regular: {
    id: "regular",
    name: "Stammis",
    emoji: "🔁",
    description: "Deltagit tre gånger på samma ställe.",
  },
  bullseye: {
    id: "bullseye",
    name: "Fullträff",
    emoji: "🎯",
    description:
      "Ett matställe du föreslog i gruppen har besökts av gänget.",
  },
};

export interface EarnedBadge {
  id: BadgeId;
  /** ISO-datum för det besök som utlöste badgen. */
  earnedAt: string;
}

/* ---------- Progression per medlem ---------- */

export interface MemberProgression {
  memberId: string;
  visits: number;
  uniquePlaces: number;
  uniqueCuisines: number;
  breadthCategories: number;
  level: LevelInfo;
  badges: EarnedBadge[];
}

/* ---------- Topplistor ---------- */

export type LeaderboardCategory = "visits" | "newPlaces" | "breadth";
export type LeaderboardPeriod = "year" | "all";

export interface LeaderboardRow {
  memberId: string;
  value: number;
  /** Competition-ranking: två ettor följs av trea (1,1,3). */
  rank: number;
}

/* ---------- Milstolpar ---------- */

export interface GroupMilestone {
  id: string;
  kind: "places-count" | "anniversary" | "full-group-visit";
  at: string;
  label: string;
}

/* ================================================================== */

function normalizeCuisine(c: string): string {
  return c.trim().toLowerCase();
}

/** Räknas besöket mot progression i denna grupp? Originalbesök alltid; delade endast om båda flaggorna tillåter. */
export function countsForProgression(state: AppState, v: Visit): boolean {
  const linkType = v.linkType ?? "original";
  if (linkType === "original") return true;
  if (v.countsForProgression === false) return false;
  if (state.group.sharedVisitsCountForProgression === false) return false;
  return true;
}

/** Stabil kronologisk sortering med visit-id som tiebreaker. */
function chronologically(a: Visit, b: Visit): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.id < b.id ? -1 : 1;
}

function inYear(iso: string, year: number): boolean {
  return iso.startsWith(`${year}-`);
}

/** Nuvarande kalenderår enligt Europe/Stockholm (fallback, ingen full tz-inställning i v0.9.0). */
export function currentStockholmYear(now: Date = new Date()): number {
  // sv-SE returnerar "YYYY" korrekt för Europe/Stockholm.
  const y = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    timeZone: "Europe/Stockholm",
  }).format(now);
  const n = Number(y);
  return Number.isFinite(n) ? n : now.getFullYear();
}

/**
 * Beräkna progression för en medlem i den aktuella gruppens read-model.
 * Läser bara AppState – ingen extern data. Duplicerade besök kan aldrig
 * uppstå här eftersom Visit.id är unikt per canonical visit i gruppen.
 */
export function computeMemberProgression(
  state: AppState,
  memberId: string,
): MemberProgression {
  const placeById = new Map<string, Place>(state.places.map((p) => [p.id, p]));

  const participated = state.visits
    .filter((v) => v.participantIds.includes(memberId))
    .slice()
    .sort(chronologically);

  const scoring = participated.filter((v) => countsForProgression(state, v));

  const uniquePlaces = new Set(scoring.map((v) => v.placeId));
  const cuisineSet = new Set<string>();
  const categorySet = new Set<string>();

  for (const v of scoring) {
    const p = placeById.get(v.placeId);
    if (!p) continue;
    for (const c of p.cuisines ?? []) {
      const n = normalizeCuisine(c);
      if (n) cuisineSet.add(n);
    }
    if (p.category) categorySet.add(p.category);
  }

  const level = levelForCount(scoring.length);

  const badges: EarnedBadge[] = [];

  // Första rundan
  if (scoring.length > 0) {
    badges.push({ id: "first-round", earnedAt: scoring[0].date });
  }

  // Världsvan – 5 unika normaliserade kökstyper
  {
    const seen = new Set<string>();
    for (const v of scoring) {
      const p = placeById.get(v.placeId);
      if (!p) continue;
      for (const c of p.cuisines ?? []) {
        const n = normalizeCuisine(c);
        if (n) seen.add(n);
      }
      if (seen.size >= 5) {
        badges.push({ id: "world-taster", earnedAt: v.date });
        break;
      }
    }
  }

  // Brett register – 4 unika kategorier (endast places.category)
  {
    const seen = new Set<string>();
    for (const v of scoring) {
      const p = placeById.get(v.placeId);
      if (!p || !p.category) continue;
      seen.add(p.category);
      if (seen.size >= 4) {
        badges.push({ id: "broad-register", earnedAt: v.date });
        break;
      }
    }
  }

  // Stammis – tredje progression-räknade deltagandet på samma canonical place
  {
    const counts = new Map<string, number>();
    for (const v of scoring) {
      const n = (counts.get(v.placeId) ?? 0) + 1;
      counts.set(v.placeId, n);
      if (n === 3) {
        badges.push({ id: "regular", earnedAt: v.date });
        break;
      }
    }
  }

  // Fullträff – medlemmen är added_by för stället (icke-shared) och besöket
  // är ett originalbesök där minst en annan medlem deltar. Endast första
  // kvalificerande besöket räknas.
  {
    const proposedIds = new Set(
      state.places
        .filter((p) => p.addedBy === memberId && (p.origin ?? "manual") !== "shared")
        .map((p) => p.id),
    );
    let earliest: Visit | null = null;
    for (const v of state.visits) {
      if (!proposedIds.has(v.placeId)) continue;
      if ((v.linkType ?? "original") !== "original") continue;
      if (!v.participantIds.some((id) => id !== memberId)) continue;
      if (!earliest || chronologically(v, earliest) < 0) earliest = v;
    }
    if (earliest) badges.push({ id: "bullseye", earnedAt: earliest.date });
  }

  return {
    memberId,
    visits: scoring.length,
    uniquePlaces: uniquePlaces.size,
    uniqueCuisines: cuisineSet.size,
    breadthCategories: categorySet.size,
    level,
    badges,
  };
}

/**
 * Competition-ranking med sekundär alfabetisk sortering vid lika värden.
 * Två ettor följs alltid av en trea. Alfabetisk ordning används endast för
 * visningsordningen; den påverkar inte placeringen.
 */
function competitionRank(
  rows: { memberId: string; name: string; value: number }[],
): LeaderboardRow[] {
  const sorted = rows.slice().sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    return a.name.localeCompare(b.name, "sv");
  });
  const out: LeaderboardRow[] = [];
  let prevValue: number | null = null;
  let prevRank = 0;
  sorted.forEach((r, i) => {
    const rank = prevValue !== null && r.value === prevValue ? prevRank : i + 1;
    out.push({ memberId: r.memberId, value: r.value, rank });
    prevValue = r.value;
    prevRank = rank;
  });
  return out;
}

/**
 * Topplista för en kategori/period. Endast aktiva medlemmar (state.members
 * i live-läge är redan filtrerade till status='active').
 */
export function computeLeaderboard(
  state: AppState,
  category: LeaderboardCategory,
  period: LeaderboardPeriod,
  now: Date = new Date(),
): LeaderboardRow[] {
  const year = currentStockholmYear(now);
  const placeById = new Map<string, Place>(state.places.map((p) => [p.id, p]));

  const rows = state.members.map((m) => {
    const memberParticipated = state.visits
      .filter((v) => v.participantIds.includes(m.id))
      .slice()
      .sort(chronologically);
    const memberScoring = memberParticipated.filter((v) =>
      countsForProgression(state, v),
    );
    const inPeriod = (v: Visit) => period === "all" || inYear(v.date, year);

    let value = 0;
    if (category === "visits") {
      value = memberScoring.filter(inPeriod).length;
    } else if (category === "newPlaces") {
      // Distinkta canonical places där medlemmens första
      // progression-räknade deltagande på platsen inträffar inom perioden.
      const firstByPlace = new Map<string, Visit>();
      for (const v of memberScoring) {
        const cur = firstByPlace.get(v.placeId);
        if (!cur || chronologically(v, cur) < 0) firstByPlace.set(v.placeId, v);
      }
      let n = 0;
      for (const v of firstByPlace.values()) if (inPeriod(v)) n += 1;
      value = n;
    } else {
      const seen = new Set<string>();
      for (const v of memberScoring) {
        if (!inPeriod(v)) continue;
        const p = placeById.get(v.placeId);
        for (const c of p?.cuisines ?? []) {
          const nn = normalizeCuisine(c);
          if (nn) seen.add(nn);
        }
      }
      value = seen.size;
    }
    return { memberId: m.id, name: m.name, value };
  });

  return competitionRank(rows);
}

/**
 * Milstolpar för gruppen. Anniversaries mäts från `group.createdAt`.
 * "Hela gänget" använder nu aktiva medlemmar som fallback eftersom
 * historiska medlemsperioder inte lagras i nuvarande schema; se README.
 */
export function computeGroupMilestones(
  state: AppState,
  now: Date = new Date(),
): GroupMilestone[] {
  const out: GroupMilestone[] = [];
  const thresholds = [10, 25, 50, 100] as const;

  const visitedIds = new Set(state.visits.map((v) => v.placeId));
  const firstVisitByPlace: { id: string; at: string }[] = [];
  for (const pid of visitedIds) {
    const first = state.visits
      .filter((v) => v.placeId === pid)
      .slice()
      .sort(chronologically)[0];
    if (first) firstVisitByPlace.push({ id: pid, at: first.date });
  }
  firstVisitByPlace.sort((a, b) => (a.at < b.at ? -1 : 1));

  for (const t of thresholds) {
    if (firstVisitByPlace.length >= t) {
      out.push({
        id: `places-${t}`,
        kind: "places-count",
        at: firstVisitByPlace[t - 1].at,
        label: `${t} besökta ställen`,
      });
    }
  }

  if (state.group.createdAt) {
    const start = new Date(state.group.createdAt);
    let years = now.getFullYear() - start.getFullYear();
    const before =
      now.getMonth() < start.getMonth() ||
      (now.getMonth() === start.getMonth() && now.getDate() < start.getDate());
    if (before) years -= 1;
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

  const activeIds = state.members.map((m) => m.id);
  if (activeIds.length >= 2) {
    const full = state.visits
      .filter((v) => activeIds.every((id) => v.participantIds.includes(id)))
      .slice()
      .sort(chronologically)[0];
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

/* Hjälp för aktivitetsfilter – 3D lägger inte till nya activity-typer. */
export function isGamificationActivity(_a: Activity): boolean {
  return false;
}
