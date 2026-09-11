/**
 * Applikationstillstånd för Matrundan.
 *
 * Stöder två lägen sida vid sida:
 * - demo: samma domänlogik körs lokalt. Exempelgruppen sparas i sessionStorage
 *   och testsandboxen kan leva i localStorage.
 * - live: state kommer från Supabase (via live-repository) och alla
 *   skrivningar går genom SECURITY DEFINER-RPC:er. Efter en lyckad
 *   live-mutation kallar vi onLiveMutation() så att AppShell kan
 *   ladda om gruppens data.
 */

import * as React from "react";
import { toast } from "sonner";
import { DEMO_STATE } from "./demo-data";
import { normalizeFoodTags } from "./food-tags";
import { normalizeOccasionClassification } from "./occasions";
import {
  archiveGroup as liveArchiveGroup,
  archiveGroupPlace as liveArchiveGroupPlace,
  reactivateGroup as liveReactivateGroup,
  restoreGroupPlace as liveRestoreGroupPlace,
  updateGroupPlaceMetadata as liveUpdateGroupPlaceMetadata,
  updateOwnReview as liveUpdateOwnReview,
  type GroupPlaceMetadataInput,
  type ReviewEditInput,
} from "./live-admin-4b";
import {
  liveCreateOrLinkProviderPlace,
  liveCreatePlace,
  liveCreateVisitWithReview,
  liveDeleteOriginalVisit,
  liveSetNextPlace,
  liveToggleFavorite,
} from "./live-mutations";
import type {
  Activity,
  AppState,
  Occasion,
  Place,
  PlaceCategory,
  Visit,
  VisibleReview,
} from "./types";
import { APP_VERSION } from "./version";
import { visitHasScore } from "./visit-context";
import { canDeleteOriginalVisit } from "./visit-permissions";
import {
  blobToDataUrl,
  canAddOrReplaceVisitPhoto,
  canDeleteVisitPhoto,
  liveDeleteVisitPhoto,
  liveSaveVisitPhoto,
  prepareVisitPhoto,
} from "./visit-photo";

const STORAGE_KEY = "matrundan.state.v1";
type DemoPersistence = "local" | "session";

function demoStorage(kind: DemoPersistence): Storage | null {
  if (typeof window === "undefined") return null;
  return kind === "session" ? window.sessionStorage : window.localStorage;
}

function nameOf(state: AppState, memberId: string) {
  return state.members.find((member) => member.id === memberId)?.name ?? "Någon";
}

function avg(values: number[]): number | undefined {
  if (!values.length) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function aggregateVisit(visit: Visit): Visit {
  const reviews = (visit.visibleReviews ?? []).filter((review) =>
    visit.participantIds.includes(review.userId),
  );
  const rated = reviews.filter(
    (review): review is VisibleReview & { overall: number } =>
      review.ratingVisible && review.overall != null,
  );
  const comment = reviews.find(
    (review) => review.commentVisible && Boolean(review.comment?.trim()),
  )?.comment;

  if (!rated.length) {
    return {
      ...visit,
      visibleReviews: reviews,
      overall: 0,
      taste: undefined,
      value: undefined,
      service: undefined,
      comment: comment ?? undefined,
    };
  }

  return {
    ...visit,
    visibleReviews: reviews,
    overall: avg(rated.map((review) => review.overall)) ?? 0,
    taste: avg(
      rated.map((review) => review.taste).filter((value): value is number => value != null),
    ),
    value: avg(
      rated.map((review) => review.value).filter((value): value is number => value != null),
    ),
    service: avg(
      rated.map((review) => review.service).filter((value): value is number => value != null),
    ),
    comment: comment ?? undefined,
  };
}

function normalizePlace(place: Place): Place {
  const canonicalCuisines = normalizeFoodTags(place.canonicalCuisines ?? place.cuisines);
  const cuisinesOverride =
    place.cuisinesOverride == null ? null : normalizeFoodTags(place.cuisinesOverride);
  return {
    ...place,
    canonicalCategory: place.canonicalCategory ?? place.category,
    categoryOverride: place.categoryOverride ?? null,
    canonicalCuisines,
    cuisinesOverride,
    cuisines: cuisinesOverride ?? canonicalCuisines,
    occasions: normalizeOccasionClassification(place.occasions ?? []),
    collectionStatus: place.collectionStatus ?? "active",
    archivedAt: place.archivedAt ?? null,
    archivedBy: place.archivedBy ?? null,
  };
}

function normalizeDemoState(input: AppState): AppState {
  const places = input.places.map(normalizePlace);
  const visits = input.visits.map((visit) => {
    const scored = visitHasScore(visit);
    const fallbackReview: VisibleReview | null = scored
      ? {
          id: `demo-review-${visit.id}-${visit.createdBy}`,
          userId: visit.createdBy,
          overall: visit.overall,
          taste: visit.taste ?? null,
          value: visit.value ?? null,
          service: visit.service ?? null,
          comment: visit.comment ?? null,
          ratingVisible: true,
          commentVisible: true,
        }
      : visit.comment?.trim()
        ? {
            id: `demo-review-${visit.id}-${visit.createdBy}`,
            userId: visit.createdBy,
            overall: null,
            taste: null,
            value: null,
            service: null,
            comment: visit.comment,
            ratingVisible: false,
            commentVisible: true,
          }
        : null;
    const reviews: VisibleReview[] =
      visit.visibleReviews && visit.visibleReviews.length > 0
        ? visit.visibleReviews
        : fallbackReview
          ? [fallbackReview]
          : [];
    return aggregateVisit({ ...visit, visibleReviews: reviews });
  });
  return {
    ...input,
    version: APP_VERSION,
    group: {
      ...input.group,
      lifecycleStatus: input.group.lifecycleStatus ?? "active",
      archivedAt: input.group.archivedAt ?? null,
      archivedBy: input.group.archivedBy ?? null,
    },
    places,
    visits,
  };
}

function assertDemoWritable(state: AppState, demoReadOnly: boolean) {
  if (demoReadOnly) throw new Error("Den här demon kan bara läsas.");
  if (state.group.lifecycleStatus === "archived") {
    throw new Error("Gruppen är arkiverad och kan bara läsas.");
  }
}

interface StoreContextValue {
  state: AppState;
  mode: "demo" | "live";
  demoReadOnly: boolean;
  submitting: boolean;
  addPlace: (input: Omit<Place, "id" | "addedAt">) => Promise<Place>;
  addProviderPlace: (input: {
    provider: string;
    providerPlaceId: string;
    place: Omit<Place, "id" | "addedAt">;
    raw: unknown;
  }) => Promise<Place>;
  toggleFavorite: (placeId: string) => Promise<void>;
  addVisit: (visit: Omit<Visit, "id">) => Promise<Visit>;
  saveVisitPhoto: (visitId: string, file: File, visitSnapshot?: Visit) => Promise<void>;
  deleteVisitPhoto: (visitId: string) => Promise<void>;
  deleteVisit: (visitId: string) => Promise<void>;
  setNext: (placeId: string | null) => Promise<void>;
  archiveGroup: () => Promise<void>;
  reactivateGroup: () => Promise<void>;
  archivePlace: (placeId: string) => Promise<void>;
  restorePlace: (placeId: string) => Promise<void>;
  updatePlaceMetadata: (placeId: string, input: GroupPlaceMetadataInput) => Promise<void>;
  updateOwnReview: (reviewId: string, input: ReviewEditInput) => Promise<void>;
  resetDemo: () => void;
  getPlace: (id: string) => Place | undefined;
  memberById: (id: string) => AppState["members"][number] | undefined;
  visitsFor: (placeId: string) => Visit[];
  avgRating: (placeId: string) => { overall: number; count: number };
  isFavorite: (placeId: string) => boolean;
  hasVisited: (placeId: string, memberId?: string) => boolean;
  statusOf: (placeId: string) => "nytt-for-mig" | "nytt-for-gruppen" | "alla-provat" | "delvis";
  visitedCounts: (placeId: string) => { visited: number; total: number };
  proposerOfNext: () => string | undefined;
  categoryCounts: () => Record<PlaceCategory, number>;
  occasionCounts: () => Record<Occasion, number>;
}

const StoreContext = React.createContext<StoreContextValue | null>(null);

export function StoreProvider({
  children,
  mode = "demo",
  demoReadOnly = false,
  demoPersistence = "local",
  demoStorageKey = STORAGE_KEY,
  initialState,
  onLiveMutation,
  activeGroupId,
}: {
  children: React.ReactNode;
  mode?: "demo" | "live";
  demoReadOnly?: boolean;
  demoPersistence?: DemoPersistence;
  demoStorageKey?: string;
  initialState?: AppState;
  onLiveMutation?: () => Promise<void> | void;
  activeGroupId?: string | null;
}) {
  const baseDemoState = React.useMemo(
    () => normalizeDemoState(initialState ?? DEMO_STATE),
    [initialState],
  );
  const [state, setState] = React.useState<AppState>(() =>
    mode === "demo" ? baseDemoState : (initialState ?? DEMO_STATE),
  );
  const [hydrated, setHydrated] = React.useState(mode === "live" || demoReadOnly);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (mode === "live" && initialState) setState(initialState);
    if (mode === "demo" && demoReadOnly) {
      setState(baseDemoState);
      setHydrated(true);
    }
  }, [mode, demoReadOnly, initialState, baseDemoState]);

  React.useEffect(() => {
    if (mode !== "demo" || demoReadOnly) return;
    try {
      const raw = demoStorage(demoPersistence)?.getItem(demoStorageKey);
      setState(raw ? normalizeDemoState(JSON.parse(raw) as AppState) : baseDemoState);
    } catch {
      setState(baseDemoState);
    }
    setHydrated(true);
  }, [mode, demoReadOnly, demoPersistence, demoStorageKey, baseDemoState]);

  React.useEffect(() => {
    if (!hydrated || mode !== "demo" || demoReadOnly) return;
    try {
      demoStorage(demoPersistence)?.setItem(demoStorageKey, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, hydrated, mode, demoReadOnly, demoPersistence, demoStorageKey]);

  const onLiveMutationRef = React.useRef(onLiveMutation);
  const activeGroupIdRef = React.useRef(activeGroupId);
  React.useEffect(() => {
    onLiveMutationRef.current = onLiveMutation;
  }, [onLiveMutation]);
  React.useEffect(() => {
    activeGroupIdRef.current = activeGroupId;
  }, [activeGroupId]);

  const runLive = React.useCallback(async <T,>(operation: (groupId: string) => Promise<T>) => {
    const groupId = activeGroupIdRef.current;
    if (!groupId) throw new Error("Ingen aktiv grupp.");
    setSubmitting(true);
    try {
      const result = await operation(groupId);
      await Promise.resolve(onLiveMutationRef.current?.());
      return result;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const value = React.useMemo<StoreContextValue>(() => {
    const pushActivity = (current: AppState, activity: Activity): AppState => ({
      ...current,
      activity: [activity, ...current.activity].slice(0, 50),
    });

    return {
      state,
      mode,
      demoReadOnly,
      submitting,

      addPlace: async (input) => {
        const normalizedInput = {
          ...input,
          cuisines: normalizeFoodTags(input.cuisines ?? []),
          occasions: normalizeOccasionClassification(input.occasions ?? []),
        };
        if (mode === "live") {
          const id = await runLive((groupId) => liveCreatePlace(groupId, normalizedInput));
          return { ...normalizedInput, id, addedAt: new Date().toISOString() } as Place;
        }

        assertDemoWritable(state, demoReadOnly);
        const existing = state.places.find(
          (place) =>
            place.name.trim().toLocaleLowerCase("sv") ===
              normalizedInput.name.trim().toLocaleLowerCase("sv") &&
            place.address.trim().toLocaleLowerCase("sv") ===
              normalizedInput.address.trim().toLocaleLowerCase("sv"),
        );
        if (existing?.collectionStatus === "active") {
          throw new Error("Ett ställe med samma namn och adress finns redan i gruppen.");
        }
        if (existing) {
          const restored: Place = {
            ...existing,
            collectionStatus: "active",
            archivedAt: null,
            archivedBy: null,
          };
          setState((current) => ({
            ...current,
            places: current.places.map((place) => (place.id === existing.id ? restored : place)),
          }));
          return restored;
        }

        const place: Place = {
          ...normalizedInput,
          id: `p-${Date.now()}`,
          addedAt: new Date().toISOString(),
          canonicalCategory: normalizedInput.category,
          categoryOverride: null,
          canonicalCuisines: normalizedInput.cuisines,
          cuisinesOverride: null,
          collectionStatus: "active",
          archivedAt: null,
          archivedBy: null,
        };
        setState((current) =>
          pushActivity(
            { ...current, places: [place, ...current.places] },
            {
              id: `a-${Date.now()}`,
              kind: "added",
              memberId: current.currentUserId,
              placeId: place.id,
              at: place.addedAt,
              text: `${nameOf(current, current.currentUserId)} la till ${place.name}`,
              target: { kind: "place", placeId: place.id },
            },
          ),
        );
        return place;
      },

      addProviderPlace: async ({ provider, providerPlaceId, place, raw }) => {
        if (mode !== "live") {
          throw new Error("Extern platssök är bara tillgänglig i live-läge (inloggad).");
        }
        const normalizedPlace = {
          ...place,
          cuisines: normalizeFoodTags(place.cuisines ?? []),
          occasions: normalizeOccasionClassification(place.occasions ?? []),
        };
        const id = await runLive((groupId) =>
          liveCreateOrLinkProviderPlace(groupId, {
            provider,
            providerPlaceId,
            name: normalizedPlace.name,
            category: normalizedPlace.category,
            cuisines: normalizedPlace.cuisines,
            occasions: normalizedPlace.occasions ?? [],
            address: normalizedPlace.address ?? "",
            area: normalizedPlace.area,
            city: normalizedPlace.city ?? "",
            lat: normalizedPlace.lat,
            lng: normalizedPlace.lng,
            notes: normalizedPlace.notes,
            photo: normalizedPlace.photo,
            raw,
          }),
        );
        return { ...normalizedPlace, id, addedAt: new Date().toISOString() } as Place;
      },

      toggleFavorite: async (placeId) => {
        if (mode === "live") {
          await runLive((groupId) => liveToggleFavorite(groupId, placeId));
          return;
        }
        assertDemoWritable(state, demoReadOnly);
        if (state.places.find((place) => place.id === placeId)?.collectionStatus === "archived") {
          throw new Error("Lägg tillbaka matstället innan du ändrar favoriten.");
        }
        setState((current) => {
          const exists = current.favorites.find(
            (favorite) =>
              favorite.memberId === current.currentUserId && favorite.placeId === placeId,
          );
          return {
            ...current,
            favorites: exists
              ? current.favorites.filter(
                  (favorite) =>
                    !(favorite.memberId === current.currentUserId && favorite.placeId === placeId),
                )
              : [...current.favorites, { memberId: current.currentUserId, placeId }],
          };
        });
      },

      addVisit: async (visitInput) => {
        if (mode === "live") {
          const id = await runLive((groupId) => liveCreateVisitWithReview(groupId, visitInput));
          return { ...visitInput, id } as Visit;
        }
        assertDemoWritable(state, demoReadOnly);
        if (
          state.places.find((place) => place.id === visitInput.placeId)?.collectionStatus ===
          "archived"
        ) {
          throw new Error("Lägg tillbaka matstället innan ett nytt besök registreras.");
        }
        const timestamp = Date.now();
        const scored = visitHasScore(visitInput);
        const review: VisibleReview | null =
          scored || visitInput.comment?.trim()
            ? {
                id: `demo-review-${timestamp}`,
                userId: state.currentUserId,
                overall: scored ? visitInput.overall : null,
                taste: scored ? visitInput.taste ?? null : null,
                value: scored ? visitInput.value ?? null : null,
                service: scored ? visitInput.service ?? null : null,
                comment: visitInput.comment ?? null,
                ratingVisible: scored,
                commentVisible: true,
              }
            : null;
        const visit = aggregateVisit({
          ...visitInput,
          id: `v-${timestamp}`,
          visibleReviews: review ? [review] : [],
        });
        setState((current) => {
          const place = current.places.find((item) => item.id === visit.placeId);
          return pushActivity(
            {
              ...current,
              visits: [visit, ...current.visits],
              nextPlaceId: current.nextPlaceId === visit.placeId ? null : current.nextPlaceId,
            },
            {
              id: `a-${timestamp}`,
              kind: "visited",
              memberId: current.currentUserId,
              placeId: visit.placeId,
              visitId: visit.id,
              at: visit.date,
              text: `${nameOf(current, current.currentUserId)} registrerade ett besök på ${
                place?.name ?? "ett ställe"
              }`,
              target: { kind: "visit", placeId: visit.placeId, visitId: visit.id },
            },
          );
        });
        return visit;
      },

      saveVisitPhoto: async (visitId, file, visitSnapshot) => {
        const visit = visitSnapshot ?? state.visits.find((item) => item.id === visitId);
        if (!visit) throw new Error("Besöket finns inte.");
        const role = state.members.find((member) => member.id === state.currentUserId)?.role;
        if (
          !canAddOrReplaceVisitPhoto(
            visit,
            state.currentUserId,
            role,
            state.group.lifecycleStatus === "archived",
          )
        ) {
          throw new Error("Du kan inte ersätta ett foto som en annan deltagare har lagt till.");
        }
        const prepared = await prepareVisitPhoto(file);
        if (mode === "live") {
          await runLive((groupId) => liveSaveVisitPhoto(groupId, visitId, prepared));
          return;
        }
        assertDemoWritable(state, demoReadOnly);
        const url = await blobToDataUrl(prepared.blob);
        const updatedAt = new Date().toISOString();
        setState((current) => {
          const currentVisit = current.visits.find((item) => item.id === visitId);
          if (!currentVisit) throw new Error("Besöket finns inte.");
          const currentRole = current.members.find(
            (member) => member.id === current.currentUserId,
          )?.role;
          if (
            !canAddOrReplaceVisitPhoto(
              currentVisit,
              current.currentUserId,
              currentRole,
              current.group.lifecycleStatus === "archived",
            )
          ) {
            throw new Error("En annan deltagare har redan lagt till ett foto.");
          }
          return {
            ...current,
            visits: current.visits.map((item) =>
              item.id === visitId
                ? {
                    ...item,
                    photo: {
                      url,
                      uploadedBy: current.currentUserId,
                      mimeType: prepared.mimeType,
                      byteSize: prepared.byteSize,
                      width: prepared.width,
                      height: prepared.height,
                      updatedAt,
                    },
                  }
                : item,
            ),
          };
        });
      },

      deleteVisitPhoto: async (visitId) => {
        const visit = state.visits.find((item) => item.id === visitId);
        if (!visit) throw new Error("Besöket finns inte.");
        const role = state.members.find((member) => member.id === state.currentUserId)?.role;
        if (
          !canDeleteVisitPhoto(
            visit,
            state.currentUserId,
            role,
            state.group.lifecycleStatus === "archived",
          )
        ) {
          throw new Error("Du saknar behörighet att ta bort fotot för det här besöket.");
        }
        if (mode === "live") {
          await runLive((groupId) => liveDeleteVisitPhoto(groupId, visitId));
          return;
        }
        assertDemoWritable(state, demoReadOnly);
        setState((current) => {
          const currentVisit = current.visits.find((item) => item.id === visitId);
          if (!currentVisit) throw new Error("Besöket finns inte.");
          const currentRole = current.members.find(
            (member) => member.id === current.currentUserId,
          )?.role;
          if (
            !canDeleteVisitPhoto(
              currentVisit,
              current.currentUserId,
              currentRole,
              current.group.lifecycleStatus === "archived",
            )
          ) {
            throw new Error("Du saknar behörighet att ta bort fotot för det här besöket.");
          }
          return {
            ...current,
            visits: current.visits.map((item) =>
              item.id === visitId ? { ...item, photo: null } : item,
            ),
          };
        });
      },

      deleteVisit: async (visitId) => {
        const visit = state.visits.find((item) => item.id === visitId);
        if (!visit) throw new Error("Besöket finns inte.");
        const role = state.members.find((member) => member.id === state.currentUserId)?.role;
        if (
          !canDeleteOriginalVisit(
            visit,
            state.currentUserId,
            role,
            state.group.lifecycleStatus === "archived",
          )
        ) {
          throw new Error("Du saknar behörighet att radera det här besöket.");
        }

        if (mode === "live") {
          await runLive(async (groupId) => {
            if (visit.photo) await liveDeleteVisitPhoto(groupId, visitId);
            await liveDeleteOriginalVisit(groupId, visitId);
          });
          return;
        }

        assertDemoWritable(state, demoReadOnly);
        setState((current) => ({
          ...current,
          visits: current.visits.filter((item) => item.id !== visitId),
          activity: current.activity.filter(
            (item) =>
              item.visitId !== visitId &&
              !(item.target?.kind === "visit" && item.target.visitId === visitId),
          ),
        }));
      },

      setNext: async (placeId) => {
        if (mode === "live") {
          await runLive((groupId) => liveSetNextPlace(groupId, placeId));
          return;
        }
        assertDemoWritable(state, demoReadOnly);
        if (
          placeId &&
          state.places.find((place) => place.id === placeId)?.collectionStatus === "archived"
        ) {
          throw new Error("Lägg tillbaka matstället innan det väljs som nästa stopp.");
        }
        setState((current) => {
          if (!placeId) return { ...current, nextPlaceId: null };
          const place = current.places.find((item) => item.id === placeId);
          return pushActivity(
            { ...current, nextPlaceId: placeId },
            {
              id: `a-${Date.now()}`,
              kind: "next-picked",
              memberId: current.currentUserId,
              placeId,
              at: new Date().toISOString(),
              text: `${nameOf(current, current.currentUserId)} valde ${
                place?.name ?? "ett ställe"
              } som nästa stopp`,
              target: { kind: "place", placeId },
            },
          );
        });
      },

      archiveGroup: async () => {
        if (mode === "live") {
          await runLive((groupId) => liveArchiveGroup(groupId));
          return;
        }
        assertDemoWritable(state, demoReadOnly);
        setState((current) => ({
          ...current,
          group: {
            ...current.group,
            lifecycleStatus: "archived",
            archivedAt: new Date().toISOString(),
            archivedBy: current.currentUserId,
          },
          nextPlaceId: null,
        }));
      },

      reactivateGroup: async () => {
        if (mode === "live") {
          await runLive((groupId) => liveReactivateGroup(groupId));
          return;
        }
        if (demoReadOnly) throw new Error("Den här demon kan bara läsas.");
        setState((current) => ({
          ...current,
          group: {
            ...current.group,
            lifecycleStatus: "active",
            archivedAt: null,
            archivedBy: null,
          },
        }));
      },

      archivePlace: async (placeId) => {
        if (mode === "live") {
          await runLive((groupId) => liveArchiveGroupPlace(groupId, placeId));
          return;
        }
        assertDemoWritable(state, demoReadOnly);
        setState((current) => ({
          ...current,
          places: current.places.map((place) =>
            place.id === placeId
              ? {
                  ...place,
                  collectionStatus: "archived",
                  archivedAt: new Date().toISOString(),
                  archivedBy: current.currentUserId,
                }
              : place,
          ),
          nextPlaceId: current.nextPlaceId === placeId ? null : current.nextPlaceId,
        }));
      },

      restorePlace: async (placeId) => {
        if (mode === "live") {
          await runLive((groupId) => liveRestoreGroupPlace(groupId, placeId));
          return;
        }
        assertDemoWritable(state, demoReadOnly);
        setState((current) => ({
          ...current,
          places: current.places.map((place) =>
            place.id === placeId
              ? { ...place, collectionStatus: "active", archivedAt: null, archivedBy: null }
              : place,
          ),
        }));
      },

      updatePlaceMetadata: async (placeId, input) => {
        const normalizedInput: GroupPlaceMetadataInput = {
          ...input,
          cuisinesOverride:
            input.cuisinesOverride == null ? null : normalizeFoodTags(input.cuisinesOverride),
          occasions: normalizeOccasionClassification(input.occasions),
        };
        if (mode === "live") {
          await runLive((groupId) =>
            liveUpdateGroupPlaceMetadata(groupId, placeId, normalizedInput),
          );
          return;
        }
        assertDemoWritable(state, demoReadOnly);
        setState((current) => ({
          ...current,
          places: current.places.map((place) => {
            if (place.id !== placeId) return place;
            const canonicalCategory = place.canonicalCategory ?? place.category;
            const canonicalCuisines = normalizeFoodTags(place.canonicalCuisines ?? place.cuisines);
            return {
              ...place,
              canonicalCategory,
              categoryOverride: normalizedInput.categoryOverride,
              category: normalizedInput.categoryOverride ?? canonicalCategory,
              canonicalCuisines,
              cuisinesOverride: normalizedInput.cuisinesOverride,
              cuisines: normalizedInput.cuisinesOverride ?? canonicalCuisines,
              occasions: normalizedInput.occasions,
              notes: normalizedInput.notes ?? undefined,
            };
          }),
        }));
      },

      updateOwnReview: async (reviewId, input) => {
        if (mode === "live") {
          await runLive((groupId) => liveUpdateOwnReview(groupId, reviewId, input));
          return;
        }
        assertDemoWritable(state, demoReadOnly);
        const exists = state.visits.some((visit) =>
          visit.visibleReviews?.some(
            (review) => review.id === reviewId && review.userId === state.currentUserId,
          ),
        );
        if (!exists) throw new Error("Ditt omdöme hittades inte.");
        setState((current) => ({
          ...current,
          visits: current.visits.map((visit) => {
            const scored = visitHasScore(visit);
            const reviews = (visit.visibleReviews ?? []).map((review) => {
              if (review.id !== reviewId || review.userId !== current.currentUserId) return review;
              return {
                ...review,
                overall: scored ? input.overall : null,
                taste: scored ? input.taste ?? null : null,
                value: scored ? input.value ?? null : null,
                service: scored ? input.service ?? null : null,
                comment: input.comment ?? null,
                ratingVisible: scored ? review.ratingVisible : false,
              };
            });
            return aggregateVisit({ ...visit, visibleReviews: reviews });
          }),
        }));
      },

      resetDemo: () => {
        if (mode !== "demo") {
          toast.info("Demo-återställning fungerar bara i demo-läget.");
          return;
        }
        try {
          demoStorage(demoPersistence)?.removeItem(demoStorageKey);
        } catch {
          /* ignore */
        }
        setState(baseDemoState);
      },

      getPlace: (id) => state.places.find((place) => place.id === id),
      memberById: (id) => state.members.find((member) => member.id === id),
      visitsFor: (placeId) =>
        state.visits
          .filter((visit) => visit.placeId === placeId)
          .sort((a, b) => (a.date < b.date ? 1 : -1)),
      avgRating: (placeId) => {
        const visits = state.visits.filter(
          (visit) => visit.placeId === placeId && visitHasScore(visit) && visit.overall > 0,
        );
        if (!visits.length) return { overall: 0, count: 0 };
        const sum = visits.reduce((total, visit) => total + visit.overall, 0);
        return { overall: sum / visits.length, count: visits.length };
      },
      isFavorite: (placeId) =>
        state.favorites.some(
          (favorite) => favorite.memberId === state.currentUserId && favorite.placeId === placeId,
        ),
      hasVisited: (placeId, memberId) => {
        const userId = memberId ?? state.currentUserId;
        return state.visits.some(
          (visit) => visit.placeId === placeId && visit.participantIds.includes(userId),
        );
      },
      statusOf: (placeId) => {
        const memberIds = state.members.map((member) => member.id);
        const visited = memberIds.filter((memberId) =>
          state.visits.some(
            (visit) => visit.placeId === placeId && visit.participantIds.includes(memberId),
          ),
        );
        if (visited.length === 0) return "nytt-for-gruppen";
        if (visited.length === memberIds.length) return "alla-provat";
        if (!visited.includes(state.currentUserId)) return "nytt-for-mig";
        return "delvis";
      },
      visitedCounts: (placeId) => {
        const memberIds = state.members.map((member) => member.id);
        const visited = memberIds.filter((memberId) =>
          state.visits.some(
            (visit) => visit.placeId === placeId && visit.participantIds.includes(memberId),
          ),
        );
        return { visited: visited.length, total: memberIds.length };
      },
      proposerOfNext: () => {
        if (!state.nextPlaceId) return undefined;
        return state.activity.find(
          (item) => item.kind === "next-picked" && item.placeId === state.nextPlaceId,
        )?.memberId;
      },
      categoryCounts: () => {
        const counts: Record<PlaceCategory, number> = {
          restaurang: 0,
          café: 0,
          bageri: 0,
          snabbmat: 0,
          pub: 0,
          matvagn: 0,
        };
        state.places
          .filter((place) => place.collectionStatus !== "archived")
          .forEach((place) => (counts[place.category] += 1));
        return counts;
      },
      occasionCounts: () => {
        const counts: Record<Occasion, number> = { snabbt: 0, avslappnat: 0, middag: 0 };
        state.places
          .filter((place) => place.collectionStatus !== "archived")
          .forEach((place) => place.occasions.forEach((occasion) => (counts[occasion] += 1)));
        return counts;
      },
    };
  }, [
    state,
    mode,
    demoReadOnly,
    submitting,
    runLive,
    demoPersistence,
    demoStorageKey,
    baseDemoState,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = React.useContext(StoreContext);
  if (!context) throw new Error("useStore måste användas inuti <StoreProvider>");
  return context;
}

export function formatDate(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const days = Math.round((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "idag";
  if (days === 1) return "igår";
  if (days < 7) return `${days} dgr sedan`;
  if (days < 30) return `${Math.floor(days / 7)} v sedan`;
  return date.toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function googleMapsUrl(place: Place) {
  const query = encodeURIComponent(`${place.name} ${place.address} ${place.city}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
