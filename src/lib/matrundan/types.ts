import type { MultiPolygon, Polygon } from "geojson";

export type PlaceCategory = "restaurang" | "café" | "bageri" | "snabbmat" | "pub" | "matvagn";

export type Occasion = "snabbt" | "avslappnat" | "middag";

export type Role = "ägare" | "admin" | "medlem";
export type GroupLifecycleStatus = "active" | "archived";
export type PlaceCollectionStatus = "active" | "archived";
export type PlaceSourceStatus = "active" | "superseded";
export type SearchRadiusKm = 1 | 2 | 3 | 5 | 10 | 25 | 50;
export type SearchAreaMode = "point" | "boundary";
export type SearchAreaBoundaryGeometry = Polygon | MultiPolygon;
export type OwnVisitParticipationStatus = "participant" | "declined" | "none";

export interface Member {
  id: string;
  name: string;
  /** Emoji-avatar (default). Rendreras som text i MemberAvatar. */
  avatar?: string;
  /** Valfri bildavatar (t.ex. Google-profilbild). Prioriteras när emoji saknas. */
  avatarImage?: string;
  role: Role;
}

export interface PlaceSource {
  provider: string;
  providerPlaceId: string;
  status: PlaceSourceStatus;
  firstSeenAt?: string;
  lastSeenAt?: string;
  validFrom?: string;
  validTo?: string | null;
}

export interface Place {
  id: string;
  name: string;
  /** Resolverad kategori för den aktiva gruppen. */
  category: PlaceCategory;
  /** Kanonisk kategori innan eventuell gruppspecifik korrigering. */
  canonicalCategory?: PlaceCategory;
  /** Null/undefined betyder att gruppen använder kanonisk kategori. */
  categoryOverride?: PlaceCategory | null;
  /** Resolverade kökstyper för den aktiva gruppen. */
  cuisines: string[];
  /** Kanoniska kökstyper innan eventuell gruppspecifik korrigering. */
  canonicalCuisines?: string[];
  /** Null/undefined betyder att gruppen använder kanoniska kökstyper. */
  cuisinesOverride?: string[] | null;
  occasions: Occasion[];
  address: string;
  city: string;
  area?: string;
  lat?: number;
  lng?: number;
  /** Resolverad webbplats för den aktiva gruppen. */
  website?: string;
  /** Webbplats på det kanoniska matstället. */
  canonicalWebsite?: string;
  /** Null/undefined betyder att gruppen använder den kanoniska webbplatsen. */
  websiteOverride?: string | null;
  /** Externa källkopplingar utan rå leverantörsdata. */
  sources?: PlaceSource[];
  addedBy: string;
  addedAt: string;
  notes?: string;
  photo?: string;
  collectionStatus?: PlaceCollectionStatus;
  archivedAt?: string | null;
  archivedBy?: string | null;
  /**
   * Ursprung för gruppens koppling till stället (`group_places.origin`):
   * - `manual`: skapat i denna grupp
   * - `provider`: importerat från extern källa (t.ex. Geoapify) i denna grupp
   * - `shared`: kopplat in via delning från en annan grupp
   * Används bl.a. för Fullträff-badgen som inte utlöses av delade platser.
   */
  origin?: "manual" | "provider" | "shared";
}

export interface VisibleReview {
  id: string;
  userId: string;
  overall: number;
  taste?: number | null;
  value?: number | null;
  service?: number | null;
  comment?: string | null;
  ratingVisible: boolean;
  commentVisible: boolean;
}

export interface VisitParticipant {
  id: string;
  name: string;
  avatar?: string | null;
  avatarImage?: string | null;
  /**
   * active = fortfarande medlem i gruppen;
   * left = tidigare medlem;
   * guest = besökslokal gäst utan gruppmedlemskap eller progression.
   */
  status: "active" | "left" | "guest";
}

export interface VisitPhoto {
  /** Kortlivad signerad URL i live-läge eller data-/asset-URL i demo. */
  url?: string;
  storagePath?: string;
  uploadedBy: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  updatedAt: string;
}

export interface Visit {
  id: string;
  placeId: string;
  date: string;
  meal: "frukost" | "lunch" | "fika" | "middag" | "kväll";
  /** Endast faktiska gruppmedlemmar. Gäster ligger i participants med status guest. */
  participantIds: string[];
  /** Den inloggade användarens kanoniska deltagarstatus på just detta besök. */
  currentUserParticipationStatus?: OwnVisitParticipationStatus;
  overall: number;
  taste?: number;
  value?: number;
  service?: number;
  comment?: string;
  createdBy: string;
  /** Privat foto för just den aktiva gruppens koppling till besöket. */
  photo?: VisitPhoto | null;
  /** original = besöket registrerades i denna grupp; shared = tillagt från annan grupp. */
  linkType?: "original" | "shared";
  linkedBy?: string;
  linkedAt?: string;
  /** Antal deltagare vars identitet inte får visas i denna grupp. */
  externalParticipantCount?: number;
  /** Räknas mot progression i denna grupp (alltid true för original). */
  countsForProgression?: boolean;
  /** Recensioner som är synliga för denna grupp – bas för aggregat och synlighets-UI. */
  visibleReviews?: VisibleReview[];
  /** Grupprelevanta medlemmar samt privata gäster i besökets ursprungsgrupp. */
  participants?: VisitParticipant[];
}

export interface Favorite {
  memberId: string;
  placeId: string;
}

/**
 * Legacy-modellen för ett enda förvalt sökområde. Behålls tillfälligt för
 * kompatibilitet med äldre grupper och klienter.
 */
export interface HomeLocation {
  label: string;
  verified: boolean;
  lat?: number;
  lng?: number;
  provider?: "geoapify";
  placeId?: string;
}

/**
 * Ett verifierat sökområde. Äldre klientobjekt utan searchMode behandlas som
 * point så att punkt + radie-semantiken aldrig ändras tyst.
 */
export interface SearchArea {
  id: string;
  label: string;
  lat: number;
  lng: number;
  provider: "geoapify" | "demo";
  placeId: string;
  searchMode?: SearchAreaMode;
  resultType?: string;
  /** Sessionsdata för kartan; sparas inte i group_search_areas. */
  boundary?: SearchAreaBoundaryGeometry;
}

export interface Group {
  id: string;
  name: string;
  emoji: string;
  /** Legacy: används fortfarande av demo-läget för fallback-stad. */
  city: string;
  createdAt: string;
  ownerId: string;
  lifecycleStatus?: GroupLifecycleStatus;
  archivedAt?: string | null;
  archivedBy?: string | null;
  /** Om delade besök räknas mot progression. */
  sharedVisitsCountForProgression?: boolean;
  /** Legacy-fält för äldre grupper. Nya flöden använder searchAreas. */
  homeLocation?: HomeLocation | null;
  /** Gruppens vanliga sökområden. Alla är valda när sökningen öppnas. */
  searchAreas?: SearchArea[];
  /** Standardavstånd för punktbaserade sökområden. */
  defaultSearchRadiusKm?: SearchRadiusKm;
}

export type NextStopDateResponseValue = "fits" | "not_fits" | "unsure";
export type NextStopDateProposalStatus = "active" | "confirmed" | "cancelled";

export interface NextStopDateResponse {
  memberId: string;
  response: NextStopDateResponseValue;
  updatedAt: string;
}

export interface NextStopDateProposal {
  id: string;
  placeId: string;
  /** Lokal kalenderdag i formatet YYYY-MM-DD. */
  date: string;
  /** Valfri lokal tid i formatet HH:mm. */
  time?: string | null;
  createdBy: string;
  status: NextStopDateProposalStatus;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string | null;
  confirmedBy?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  responses: NextStopDateResponse[];
}

export type ActivityKind = "added" | "visited" | "favorited" | "next-picked" | "member-joined";

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
  /** Ett öppet eller bekräftat datumförslag för gruppens aktuella nästa stopp. */
  nextStopDateProposal?: NextStopDateProposal | null;
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
  snabbt: "Snabbt och enkelt",
  avslappnat: "Avslappnat",
  middag: "Något extra",
};

export const OCCASION_DESCRIPTION: Record<Occasion, string> = {
  snabbt: "När det ska vara enkelt att svänga förbi, äta relativt snabbt eller ta med maten.",
  avslappnat:
    "För en ledig måltid med partner, vänner eller familj där det är lätt att trivas utan att göra en stor sak av besöket.",
  middag:
    "När ni vill göra lite mer av måltiden genom maten, miljön, servicen eller tillfället, utan att det behöver vara finkrog.",
};

export const OCCASION_VALUES = [
  "snabbt",
  "avslappnat",
  "middag",
] as const satisfies readonly Occasion[];

export function resolveActivityTarget(a: Activity): ActivityTarget | null {
  if (a.target) return a.target;
  if (a.kind === "visited" && a.placeId && a.visitId) {
    return { kind: "visit", placeId: a.placeId, visitId: a.visitId };
  }
  if ((a.kind === "added" || a.kind === "favorited" || a.kind === "next-picked") && a.placeId) {
    return { kind: "place", placeId: a.placeId };
  }
  if (a.kind === "member-joined" && a.memberId) {
    return { kind: "member", memberId: a.memberId };
  }
  return null;
}
