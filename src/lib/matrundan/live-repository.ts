/**
 * Live-repository: läser en grupps state via den säkra RPC:n
 * get_group_app_state, som filtrerar deltagare/omdömen per grupp.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  Activity,
  AppState,
  Favorite,
  Group,
  Member,
  Occasion,
  Place,
  PlaceCategory,
  Role,
  VisibleReview,
  Visit,
} from "./types";
import { APP_VERSION } from "./version";

const ROLE_LABEL: Record<string, Role> = {
  owner: "ägare",
  admin: "admin",
  member: "medlem",
};

type ReviewRow = {
  id: string;
  userId: string;
  overall: number;
  taste: number | null;
  value: number | null;
  service: number | null;
  comment: string | null;
  ratingVisible: boolean;
  commentVisible: boolean;
};

type VisitRow = {
  id: string;
  placeId: string;
  date: string;
  meal: Visit["meal"];
  createdBy: string;
  linkType: "original" | "shared";
  linkedBy: string;
  linkedAt: string;
  externalParticipantCount: number;
  countsForProgression: boolean;
  participantIds: string[];
  participants: {
    id: string;
    name: string;
    avatar: string | null;
    avatarImage: string | null;
    status: "active" | "left";
  }[];
  reviews: ReviewRow[];
};

type Payload = {
  currentUserId: string;
  group: {
    id: string;
    name: string;
    emoji: string | null;
    city: string;
    createdAt: string;
    ownerId: string;
    sharedVisitsCountForProgression: boolean;
    homeLocation: {
      label: string;
      verified: boolean;
      lat?: number;
      lng?: number;
      provider?: string;
      placeId?: string;
    } | null;
  };
  members: {
    id: string;
    name: string;
    avatar: string | null;
    avatarImage: string | null;
    role: string;
  }[];
  places: {
    id: string;
    name: string;
    category: string;
    cuisines: string[];
    occasions: string[];
    address: string;
    area: string | null;
    city: string;
    lat: number | null;
    lng: number | null;
    photo: string | null;
    notes: string | null;
    addedBy: string;
    addedAt: string;
    origin: string;
  }[];
  visits: VisitRow[];
  favorites: { memberId: string; placeId: string }[];
  activity: {
    id: string;
    kind: string;
    memberId: string;
    placeId: string | null;
    visitId: string | null;
    at: string;
    text: string;
  }[];
  nextPlaceId: string | null;
};

function avg(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export async function loadLiveState(groupId: string): Promise<AppState | null> {
  const { data, error } = await supabase.rpc("get_group_app_state", {
    _group_id: groupId,
  });
  if (error || !data) {
    console.error("[Matrundan] get_group_app_state:", error);
    return null;
  }
  const p = data as unknown as Payload;

  const home = p.group.homeLocation;
  const group: Group = {
    id: p.group.id,
    name: p.group.name,
    emoji: p.group.emoji ?? "🍽️",
    city: p.group.city ?? "",
    createdAt: p.group.createdAt,
    ownerId: p.group.ownerId,
    sharedVisitsCountForProgression: p.group.sharedVisitsCountForProgression,
    homeLocation: home
      ? {
          label: home.label,
          verified: home.verified,
          lat: home.lat,
          lng: home.lng,
          provider: home.provider === "geoapify" ? "geoapify" : undefined,
          placeId: home.placeId,
        }
      : null,
  };

  const members: Member[] = p.members.map((m) => ({
    id: m.id,
    name: m.name,
    avatar: m.avatar ?? undefined,
    avatarImage: m.avatarImage ?? undefined,
    role: ROLE_LABEL[m.role] ?? "medlem",
  }));

  const places: Place[] = p.places.map((pl) => ({
    id: pl.id,
    name: pl.name,
    category: pl.category as PlaceCategory,
    cuisines: pl.cuisines ?? [],
    occasions: (pl.occasions ?? []) as Occasion[],
    address: pl.address ?? "",
    city: pl.city ?? "",
    area: pl.area ?? undefined,
    lat: pl.lat ?? undefined,
    lng: pl.lng ?? undefined,
    addedBy: pl.addedBy,
    addedAt: pl.addedAt,
    notes: pl.notes ?? undefined,
    photo: pl.photo ?? undefined,
    origin:
      pl.origin === "manual" || pl.origin === "provider" || pl.origin === "shared"
        ? pl.origin
        : "manual",
  }));

  const visits: Visit[] = p.visits.map((v) => {
    const visibleReviews: VisibleReview[] = v.reviews.map((r) => ({
      id: r.id,
      userId: r.userId,
      overall: r.overall,
      taste: r.taste,
      value: r.value,
      service: r.service,
      comment: r.comment,
      ratingVisible: r.ratingVisible,
      commentVisible: r.commentVisible,
    }));
    // Aggregat räknas bara från synliga betyg.
    const rated = visibleReviews.filter((r) => r.ratingVisible);
    const overall = rated.map((r) => r.overall);
    const taste = rated.map((r) => r.taste).filter((x): x is number => x != null);
    const value = rated.map((r) => r.value).filter((x): x is number => x != null);
    const service = rated.map((r) => r.service).filter((x): x is number => x != null);
    const comment = rated.find((r) => r.commentVisible && r.comment)?.comment ?? undefined;
    return {
      id: v.id,
      placeId: v.placeId,
      date: v.date,
      meal: v.meal,
      participantIds: v.participantIds ?? [],
      overall: avg(overall) ?? 0,
      taste: avg(taste),
      value: avg(value),
      service: avg(service),
      comment: comment ?? undefined,
      createdBy: v.createdBy,
      linkType: v.linkType,
      linkedBy: v.linkedBy,
      linkedAt: v.linkedAt,
      externalParticipantCount: v.externalParticipantCount ?? 0,
      countsForProgression: v.countsForProgression,
      visibleReviews,
      participants: (v.participants ?? []).map((pp) => ({
        id: pp.id,
        name: pp.name,
        avatar: pp.avatar ?? undefined,
        avatarImage: pp.avatarImage ?? undefined,
        status: pp.status,
      })),
    };
  });

  const favorites: Favorite[] = p.favorites.map((f) => ({
    memberId: f.memberId,
    placeId: f.placeId,
  }));

  const activity: Activity[] = p.activity.map((a) => ({
    id: a.id,
    kind: (a.kind as Activity["kind"]) ?? "added",
    memberId: a.memberId ?? p.currentUserId,
    placeId: a.placeId ?? undefined,
    visitId: a.visitId ?? undefined,
    at: a.at,
    text: a.text ?? "Aktivitet",
  }));

  return {
    version: APP_VERSION,
    currentUserId: p.currentUserId,
    group,
    members,
    places,
    visits,
    favorites,
    activity,
    nextPlaceId: p.nextPlaceId,
  };
}
