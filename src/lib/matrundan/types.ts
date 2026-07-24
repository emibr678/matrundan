export type PlaceCategory =
  | "restaurang"
  | "café"
  | "bageri"
  | "snabbmat"
  | "pub"
  | "matvagn";

export type Occasion = "snabbt" | "avslappnat" | "middag";

export type Role = "ägare" | "admin" | "medlem";

export interface Member {
  id: string;
  name: string;
  avatar?: string;
  role: Role;
}

export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  cuisines: string[];
  occasions: Occasion[];
  address: string;
  city: string;
  area?: string;
  lat?: number;
  lng?: number;
  addedBy: string;
  addedAt: string;
  notes?: string;
  photo?: string;
}

export interface Visit {
  id: string;
  placeId: string;
  date: string;
  meal: "frukost" | "lunch" | "fika" | "middag" | "kväll";
  participantIds: string[];
  overall: number;
  taste?: number;
  value?: number;
  service?: number;
  comment?: string;
  createdBy: string;
}

export interface Favorite {
  memberId: string;
  placeId: string;
}

export interface Group {
  id: string;
  name: string;
  emoji: string;
  city: string;
  createdAt: string;
  ownerId: string;
}

export type ActivityKind =
  | "added"
  | "visited"
  | "favorited"
  | "next-picked"
  | "member-joined";

export type ActivityTarget =
  | { kind: "place"; placeId: string }
  | { kind: "visit"; placeId: string; visitId: string }
  | { kind: "member"; memberId: string };

export interface Activity {
  id: string;
  kind: ActivityKind;
  memberId: string;
  placeId?: string;
  visitId?: string;
  at: string;
  text: string;
  /** Ny, typad navigering. Äldre data faller tillbaka på kind + fält ovan. */
  target?: ActivityTarget;
}

export interface AppState {
  version: string;
  currentUserId: string;
  group: Group;
  members: Member[];
  places: Place[];
  visits: Visit[];
  favorites: Favorite[];
  activity: Activity[];
  nextPlaceId: string | null;
}

export const CATEGORY_LABEL: Record<PlaceCategory, string> = {
  restaurang: "Restaurang",
  café: "Café",
  bageri: "Bageri",
  snabbmat: "Snabbmat",
  pub: "Pub",
  matvagn: "Matvagn",
};

export const OCCASION_LABEL: Record<Occasion, string> = {
  snabbt: "Snabbt & enkelt",
  avslappnat: "Avslappnat",
  middag: "Trevlig middag",
};

/**
 * Härled ett navigeringsmål ur en aktivitet. Bakåtkompatibelt med
 * gammal localStorage-data som saknar `target`.
 */
export function resolveActivityTarget(a: Activity): ActivityTarget | null {
  if (a.target) return a.target;
  if (a.kind === "visited" && a.placeId && a.visitId) {
    return { kind: "visit", placeId: a.placeId, visitId: a.visitId };
  }
  if (
    (a.kind === "added" || a.kind === "favorited" || a.kind === "next-picked") &&
    a.placeId
  ) {
    return { kind: "place", placeId: a.placeId };
  }
  if (a.kind === "member-joined" && a.memberId) {
    return { kind: "member", memberId: a.memberId };
  }
  return null;
}
