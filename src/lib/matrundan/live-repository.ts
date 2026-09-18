/**
 * Live-repository: läser en grupps state via den säkra, versionshanterade
 * read-modelen. Vid just en saknad aktuell RPC får klienten tillfälligt falla
 * tillbaka till föregående kompatibla version så att gruppen fortfarande kan
 * läsas medan databasdriftsättningen färdigställs.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  Activity,
  AppState,
  Favorite,
  Group,
  GroupLifecycleStatus,
  Member,
  NextStopDateProposal,
  NextStopDateProposalStatus,
  NextStopDateResponseValue,
  NextStopState,
  Place,
  PlaceCategory,
  PlaceCollectionStatus,
  ReviewModel,
  Role,
  SearchRadiusKm,
  VisibleReview,
  Visit,
} from "./types";
import { normalizeOccasionClassification } from "./occasions";
import { normalizeWebsiteUrl } from "./place-links";
import {
  CURRENT_GROUP_STATE_RPC,
  PREVIOUS_GROUP_STATE_RPC,
  shouldFallbackToPreviousGroupStateRpc,
} from "./read-model-version";
import { isSearchRadiusKm } from "./search-areas";
import { APP_VERSION } from "./version";
import { createSignedVisitPhotoUrls } from "./visit-photo";
import { visitMealHasScore } from "./visit-context";

const ROLE_LABEL: Record<string, Role> = {
  owner: "ägare",
  admin: "admin",
  member: "medlem",
};

type ReviewRow = {
  id: string;
  userId: string;
  overall: number | null;
  taste: number | null;
  value: number | null;
  service: number | null;
  atmosphere?: number | null;
  reviewModel?: ReviewModel | null;
  comment: string | null;
  ratingVisible: boolean;
  commentVisible: boolean;
};

type VisitRow = {
  id: string;
  placeId: string;
  date: string;
  meal: Visit["meal"];
  isTakeaway?: boolean;
  createdBy: string;
  linkType: "original" | "shared";
  linkedBy: string;
  linkedAt: string;
  externalParticipantCount: number;
  countsForProgression: boolean;
  participantIds: string[];
  currentUserParticipationStatus?: string;
  participants: {
    id: string;
    name: string;
    avatar: string | null;
    avatarImage: string | null;
    status: "active" | "left" | "guest";
  }[];
  reviews: ReviewRow[];
  photo: {
    storagePath: string;
    uploadedBy: string;
    mimeType: string;
    byteSize: number;
    width: number;
    height: number;
    updatedAt: string;
  } | null;
};

type NextStopDateProposalRow = {
  id: string;
  placeId: string;
  date: string;
  time: string | null;
  createdBy: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  confirmedBy: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  responses: {
    memberId: string;
    response: string;
    updatedAt: string;
  }[];
};

type NextStopStateRow = {
  revision: number;
  plannedDate: string | null;
  plannedTime: string | null;
  selectedPlaceId: string | null;
  proposals: {
    id: string;
    placeId: string;
    proposedBy: string | null;
    createdAt: string;
    supports: {
      memberId: string;
      updatedAt: string;
    }[];
  }[];
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
    lifecycleStatus?: string;
    archivedAt?: string | null;
    archivedBy?: string | null;
    sharedVisitsCountForProgression: boolean;
    defaultSearchRadiusKm?: number;
    searchAreas?: {
      id: string;
      label: string;
      lat: number;
      lng: number;
      provider: string;
      placeId: string;
      searchMode?: string;
      resultType?: string | null;
    }[];
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
    canonicalCategory?: string;
    categoryOverride?: string | null;
    cuisines: string[];
    canonicalCuisines?: string[];
    cuisinesOverride?: string[] | null;
    occasions: string[];
    address: string;
    area: string | null;
    city: string;
    lat: number | null;
    lng: number | null;
    website?: string | null;
    canonicalWebsite?: string | null;
    websiteOverride?: string | null;
    sources?: {
      provider: string;
      providerPlaceId: string;
      status: string;
      firstSeenAt?: string | null;
      lastSeenAt?: string | null;
      validFrom?: string | null;
      validTo?: string | null;
    }[];
    photo: string | null;
    notes: string | null;
    addedBy: string;
    addedAt: string;
    origin: string;
    collectionStatus?: string;
    archivedAt?: string | null;
    archivedBy?: string | null;
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
  nextStopDateProposal: NextStopDateProposalRow | null;
  nextStop?: NextStopStateRow | null;
};

function avg(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function mapNextStopDateProposal(row: NextStopDateProposalRow | null): NextStopDateProposal | null {
  if (!row) return null;
  return {
    id: row.id,
    placeId: row.placeId,
    date: row.date,
    time: row.time ? row.time.slice(0, 5) : null,
    createdBy: row.createdBy,
    status: row.status as NextStopDateProposalStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    confirmedAt: row.confirmedAt,
    confirmedBy: row.confirmedBy,
    cancelledAt: row.cancelledAt,
    cancelledBy: row.cancelledBy,
    responses: (row.responses ?? []).map((response) => ({
      memberId: response.memberId,
      response: response.response as NextStopDateResponseValue,
      updatedAt: response.updatedAt,
    })),
  };
}

function mapNextStop(row: NextStopStateRow | null | undefined): NextStopState | null | undefined {
  if (row === undefined) return undefined;
  if (!row) return null;
  return {
    revision: Number.isFinite(row.revision) ? row.revision : 0,
    plannedDate: row.plannedDate ?? null,
    plannedTime: row.plannedTime ? row.plannedTime.slice(0, 5) : null,
    selectedPlaceId: row.selectedPlaceId ?? null,
    proposals: (row.proposals ?? []).map((proposal) => ({
      id: proposal.id,
      placeId: proposal.placeId,
      proposedBy: proposal.proposedBy ?? null,
      createdAt: proposal.createdAt,
      supports: (proposal.supports ?? []).map((support) => ({
        memberId: support.memberId,
        updatedAt: support.updatedAt,
      })),
    })),
  };
}

async function readGroupPayload(groupId: string): Promise<Payload | null> {
  const current = await supabase.rpc(CURRENT_GROUP_STATE_RPC as "get_group_app_state", {
    _group_id: groupId,
  });

  if (!current.error && current.data) return current.data as unknown as Payload;

  if (!shouldFallbackToPreviousGroupStateRpc(current.error)) {
    console.error(`[Matrundan] ${CURRENT_GROUP_STATE_RPC}:`, current.error);
    return null;
  }

  console.warn(
    `[Matrundan] ${CURRENT_GROUP_STATE_RPC} saknas. Läser tillfälligt via ${PREVIOUS_GROUP_STATE_RPC}.`,
  );
  const previous = await supabase.rpc(PREVIOUS_GROUP_STATE_RPC as "get_group_app_state", {
    _group_id: groupId,
  });
  if (previous.error || !previous.data) {
    console.error(`[Matrundan] ${PREVIOUS_GROUP_STATE_RPC}:`, previous.error);
    return null;
  }

  return previous.data as unknown as Payload;
}

export async function loadLiveState(groupId: string): Promise<AppState | null> {
  const p = await readGroupPayload(groupId);
  if (!p) return null;

  const home = p.group.homeLocation;
  const configuredRadius = p.group.defaultSearchRadiusKm ?? 1;
  const radius: SearchRadiusKm = isSearchRadiusKm(configuredRadius) ? configuredRadius : 1;
  const group: Group = {
    id: p.group.id,
    name: p.group.name,
    emoji: p.group.emoji ?? "🍽️",
    city: p.group.city ?? "",
    createdAt: p.group.createdAt,
    ownerId: p.group.ownerId,
    lifecycleStatus: (p.group.lifecycleStatus ?? "active") as GroupLifecycleStatus,
    archivedAt: p.group.archivedAt ?? null,
    archivedBy: p.group.archivedBy ?? null,
    sharedVisitsCountForProgression: p.group.sharedVisitsCountForProgression,
    defaultSearchRadiusKm: radius,
    searchAreas: (p.group.searchAreas ?? [])
      .filter(
        (area) =>
          area.provider === "geoapify" &&
          Number.isFinite(area.lat) &&
          Number.isFinite(area.lng) &&
          area.placeId.trim().length > 0,
      )
      .map((area) => ({
        id: area.id,
        label: area.label,
        lat: area.lat,
        lng: area.lng,
        provider: "geoapify" as const,
        placeId: area.placeId,
        searchMode: area.searchMode === "boundary" ? ("boundary" as const) : ("point" as const),
        resultType: area.resultType ?? undefined,
      })),
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

  const places: Place[] = p.places.map((pl) => {
    const canonicalWebsite = normalizeWebsiteUrl(pl.canonicalWebsite);
    const websiteOverride = normalizeWebsiteUrl(pl.websiteOverride);
    const website = normalizeWebsiteUrl(pl.website) ?? websiteOverride ?? canonicalWebsite;
    return {
      id: pl.id,
      name: pl.name,
      category: pl.category as PlaceCategory,
      canonicalCategory: (pl.canonicalCategory ?? pl.category) as PlaceCategory,
      categoryOverride: pl.categoryOverride ? (pl.categoryOverride as PlaceCategory) : null,
      cuisines: pl.cuisines ?? [],
      canonicalCuisines: pl.canonicalCuisines ?? pl.cuisines ?? [],
      cuisinesOverride: pl.cuisinesOverride ?? null,
      occasions: normalizeOccasionClassification(pl.occasions ?? []),
      address: pl.address ?? "",
      city: pl.city ?? "",
      area: pl.area ?? undefined,
      lat: pl.lat ?? undefined,
      lng: pl.lng ?? undefined,
      website,
      canonicalWebsite,
      websiteOverride: websiteOverride ?? null,
      sources: (pl.sources ?? [])
        .filter((source) => source.provider?.trim() && source.providerPlaceId?.trim())
        .map((source) => ({
          provider: source.provider,
          providerPlaceId: source.providerPlaceId,
          status: source.status === "superseded" ? ("superseded" as const) : ("active" as const),
          firstSeenAt: source.firstSeenAt ?? undefined,
          lastSeenAt: source.lastSeenAt ?? undefined,
          validFrom: source.validFrom ?? undefined,
          validTo: source.validTo ?? null,
        })),
      addedBy: pl.addedBy,
      addedAt: pl.addedAt,
      notes: pl.notes ?? undefined,
      photo: pl.photo ?? undefined,
      collectionStatus: (pl.collectionStatus ?? "active") as PlaceCollectionStatus,
      archivedAt: pl.archivedAt ?? null,
      archivedBy: pl.archivedBy ?? null,
      // group_places.origin i DB använder värdena 'manual', 'provider' och
      // 'shared_visit' (delning via visits). Vi normaliserar till Place.origin
      // och behandlar okända värden som "shared" så att Fullträff-badgen inte
      // felaktigt utlöses av importerade eller delade platser.
      origin: pl.origin === "manual" || pl.origin === "provider" ? pl.origin : "shared",
    };
  });

  const signedPhotoUrls = await createSignedVisitPhotoUrls(
    p.visits.flatMap((visit) => (visit.photo?.storagePath ? [visit.photo.storagePath] : [])),
  );

  const visits: Visit[] = p.visits.map((v) => {
    const participantIds = v.participantIds ?? [];
    const visibleReviews: VisibleReview[] = v.reviews.map((r) => ({
      id: r.id,
      userId: r.userId,
      overall: r.overall,
      taste: r.taste,
      value: r.value,
      service: r.service,
      atmosphere: r.atmosphere ?? null,
      reviewModel: r.reviewModel ?? null,
      comment: r.comment,
      ratingVisible: r.ratingVisible,
      commentVisible: r.commentVisible,
    }));
    // Aggregat räknas bara från synliga, faktiska scores. Scorelösa kommentarer
    // kan fortfarande bidra med besöksminnet men aldrig med ett numeriskt betyg.
    const rated = visitMealHasScore(v.meal)
      ? visibleReviews.filter(
          (review): review is VisibleReview & { overall: number } =>
            review.ratingVisible && review.overall != null,
        )
      : [];
    const overall = rated.map((r) => r.overall);
    const taste = rated.map((r) => r.taste).filter((x): x is number => x != null);
    const value = rated.map((r) => r.value).filter((x): x is number => x != null);
    const service = rated.map((r) => r.service).filter((x): x is number => x != null);
    const atmosphere = rated.map((r) => r.atmosphere).filter((x): x is number => x != null);
    const comment = visibleReviews.find((r) => r.commentVisible && r.comment?.trim())?.comment;
    const currentUserParticipationStatus =
      v.currentUserParticipationStatus === "declined"
        ? ("declined" as const)
        : participantIds.includes(p.currentUserId)
          ? ("participant" as const)
          : ("none" as const);
    return {
      id: v.id,
      placeId: v.placeId,
      date: v.date,
      meal: v.meal,
      isTakeaway: v.isTakeaway ?? false,
      participantIds,
      currentUserParticipationStatus,
      overall: avg(overall) ?? 0,
      taste: avg(taste),
      value: avg(value),
      service: avg(service),
      atmosphere: avg(atmosphere),
      comment: comment ?? undefined,
      createdBy: v.createdBy,
      photo: v.photo
        ? {
            ...v.photo,
            url: signedPhotoUrls.get(v.photo.storagePath),
          }
        : null,
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
    nextStopDateProposal: mapNextStopDateProposal(p.nextStopDateProposal),
    nextStop: mapNextStop(p.nextStop),
  };
}
