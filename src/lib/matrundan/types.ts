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
  cuisines: string[]; // t.ex. italienskt, sushi
  occasions: Occasion[];
  address: string;
  city: string;
  lat?: number;
  lng?: number;
  addedBy: string; // member id
  addedAt: string;
  notes?: string;
  photo?: string; // emoji or url
}

export interface Visit {
  id: string;
  placeId: string;
  date: string; // ISO
  meal: "frukost" | "lunch" | "fika" | "middag" | "kväll";
  participantIds: string[];
  overall: number; // 1–5
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

export interface Activity {
  id: string;
  kind: "added" | "visited" | "favorited" | "next-picked";
  memberId: string;
  placeId?: string;
  visitId?: string;
  at: string;
  text: string;
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
