/**
 * Applikationstillstånd för Matrundan.
 *
 * Stöder två lägen sida vid sida:
 * - demo: hela state lever i localStorage och muteras direkt i klienten.
 * - live: state kommer från Supabase (via live-repository) och alla
 *   skrivningar går genom SECURITY DEFINER-RPC:er. Efter en lyckad
 *   live-mutation kallar vi onLiveMutation() så att AppShell kan
 *   ladda om gruppens data.
 */

import * as React from "react";
import { toast } from "sonner";
import { DEMO_STATE } from "./demo-data";
import { APP_VERSION } from "./version";
import {
  liveCreateOrLinkProviderPlace,
  liveCreatePlace,
  liveCreateVisitWithReview,
  liveSetNextPlace,
  liveToggleFavorite,
} from "./live-mutations";
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
import type {
  Activity,
  AppState,
  Occasion,
  Place,
  PlaceCategory,
  Visit,
  VisibleReview,
} from "./types";

const STORAGE_KEY = "matrundan.state.v1";

function nameOf(state: AppState, memberId: string) {
  return state.members.find((m) => m.id === memberId)?.name ?? "Någon";
}

function avg(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  return xs.reduce((sum, value) => sum + value, 0) / xs.length;
}

function aggregateVisit(visit: Visit): Visit {
  const reviews = visit.visibleReviews ?? [];
  const rated = reviews.filter((review) => review.ratingVisible);
  if (!rated.length) return { ...visit, overall: 0, comment: undefined };
  const comments = rated.find((review) => review.commentVisible && review.comment?.trim());
  return {
    ...visit,
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
    comment: comments?.comment ?? undefined,
  };
}

function normalizeDemoState(input: AppState): AppState {
  const places = input.places.map((place) => ({
    ...place,
    canonicalCategory: place.canonicalCategory ?? place.category,
    categoryOverride: place.categoryOverride ?? null,
    canonicalCuisines: place.canonicalCuisines ?? place.cuisines,
    cuisinesOverride: place.cuisinesOverride ?? null,
    collectionStatus: place.collectionStatus ?? "active",
    archivedAt: place.archivedAt ?? null,
    archivedBy: place.archivedBy ?? null,
  }));
  const visits = input.visits.map((visit) => {
    const reviews: VisibleReview[] =
      visit.visibleReviews && visit.visibleReviews.length > 0
        ? visit.visibleReviews
        : [
            {
              id: `demo-review-${visit.id}-${visit.createdBy}`,
              userId: visit.createdBy,
              overall: visit.overall,
              taste: visit.taste ?? null,
              value: visit.value ?? null,
              service: visit.service ?? null,
              comment: visit.comment ?? null,
              ratingVisible: true,
              commentVisible: true,
            },
          ];
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

function assertDemoWritable(state: AppState) {
  if (state.group.lifecycleStatus === "archived") {
    throw new Error("Gruppen är arkiverad och kan bara läsas.");
  }
}

interface StoreContextValue {
  state: AppState;
  mode: "demo" | "live";
  /** true medan en live-mutation pågår – används för att inaktivera CTA:er. */
  submitting: boolean;
  addPlace: (input: Omit<Place, "id" | "addedAt">) => Promise<Place>;
  /**
   * Lägg till ett matställe från en extern provider (Geoapify).
   * Fungerar bara i live-läge – i demo-läge kastas ett fel.
   */
  addProviderPlace: (input: {
    provider: string;
    providerPlaceId: string;
    place: Omit<Place, "id" | "addedAt">;
    raw: unknown;
  }) => Promise<Place>;
  toggleFavorite: (placeId: string) => Promise<void>;
  addVisit: (visit: Omit<Visit, "id">) => Promise<Visit>;
  setNext: (placeId: string | null) => Promise<void>;
  archiveGroup: () => Promise<void>;
  reactivateGroup: () => Promise<void>;
  archivePlace: (placeId: string) => Promise<void>;
  restorePlace: (placeId: string) => Promise<void>;
  updatePlaceMetadata: (placeId: string, input: GroupPlaceMetadataInput) => Promise<void>;
  updateOwnReview: (reviewId: string, input: ReviewEditInput) => Promise<void>;
  resetDemo: () => void;
  // selectors
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
  initialState,
  onLiveMutation,
  activeGroupId,
}: {
  children: React.ReactNode;
  mode?: "demo" | "live";
  initialState?: AppState;
  /** Kallas efter lyckad live-skrivning; AppShell laddar om gruppen. */
  onLiveMutation?: () => Promise<void> | void;
  /** Aktivt group_id i live-läget; obligatoriskt för live-mutationer. */
  activeGroupId?: string | null;
}) {
  const [state, setState] = React.useState<AppState>(() =>
    mode === "demo" ? normalizeDemoState(initialState ?? DEMO_STATE) : (initialState ?? DEMO_STATE),
  );
  const [hydrated, setHydrated] = React.useState(mode === "live");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (mode === "live" && initialState) {
      setState(initialState);
    }
  }, [mode, initialState]);

  React.useEffect(() => {
    if (mode !== "demo") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setState(normalizeDemoState(JSON.parse(raw) as AppState));
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [mode]);

  React.useEffect(() => {
    if (!hydrated || mode !== "demo") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, hydrated, mode]);

  // Håll senaste callback/grupp-id i refs så att value-memon inte behöver
  // återskapas för varje omladdning av live-state.
  const onLiveMutationRef = React.useRef(onLiveMutation);
  const activeGroupIdRef = React.useRef(activeGroupId);
  React.useEffect(() => {
    onLiveMutationRef.current = onLiveMutation;
  }, [onLiveMutation]);
  React.useEffect(() => {
    activeGroupIdRef.current = activeGroupId;
  }, [activeGroupId]);

  const runLive = React.useCallback(async <T,>(op: (groupId: string) => Promise<T>): Promise<T> => {
    const gid = activeGroupIdRef.current;
    if (!gid) throw new Error("Ingen aktiv grupp.");
    setSubmitting(true);
    try {
      const result = await op(gid);
      await Promise.resolve(onLiveMutationRef.current?.());
      return result;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const value = React.useMemo<StoreContextValue>(() => {
    const pushActivity = (s: AppState, a: Activity): AppState => ({
      ...s,
      activity: [a, ...s.activity].slice(0, 50),
    });

    return {
      state,
      mode,
      submitting,

      addPlace: async (input) => {
        if (mode === "live") {
          const id = await runLive((gid) => liveCreatePlace(gid, input));
          return { ...input, id, addedAt: new Date().toISOString() } as Place;
        }
        assertDemoWritable(state);
        const existing = state.places.find(
          (place) =>
            place.name.trim().toLocaleLowerCase("sv") ===
              input.name.trim().toLocaleLowerCase("sv") &&
            place.address.trim().toLocaleLowerCase("sv") ===
              input.address.trim().toLocaleLowerCase("sv"),
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
            occasions: input.occasions,
            notes: input.notes,
          };
          setState((current) => ({
            ...current,
            places: current.places.map((place) => (place.id === existing.id ? restored : place)),
          }));
          return restored;
        }
        const place: Place = {
          ...input,
          id: `p-${Date.now()}`,
          addedAt: new Date().toISOString(),
          canonicalCategory: input.category,
          categoryOverride: null,
          canonicalCuisines: input.cuisines,
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
        const id = await runLive((gid) =>
          liveCreateOrLinkProviderPlace(gid, {
            provider,
            providerPlaceId,
            name: place.name,
            category: place.category,
            cuisines: place.cuisines ?? [],
            occasions: place.occasions ?? [],
            address: place.address ?? "",
            area: place.area,
            city: place.city ?? "",
            lat: place.lat,
            lng: place.lng,
            notes: place.notes,
            photo: place.photo,
            raw,
          }),
        );
        return { ...place, id, addedAt: new Date().toISOString() } as Place;
      },

      toggleFavorite: async (placeId) => {
        if (mode === "live") {
          await runLive((gid) => liveToggleFavorite(gid, placeId));
          return;
        }
        assertDemoWritable(state);
        if (state.places.find((place) => place.id === placeId)?.collectionStatus === "archived") {
          throw new Error("Återställ matstället innan du ändrar favoriten.");
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
          const id = await runLive((gid) => liveCreateVisitWithReview(gid, visitInput));
          return { ...visitInput, id } as Visit;
        }
        assertDemoWritable(state);
        if (
          state.places.find((place) => place.id === visitInput.placeId)?.collectionStatus ===
          "archived"
        ) {
          throw new Error("Återställ matstället innan ett nytt besök registreras.");
        }
        const timestamp = Date.now();
        const review: VisibleReview = {
          id: `demo-review-${timestamp}`,
          userId: state.currentUserId,
          overall: visitInput.overall,
          taste: visitInput.taste ?? null,
          value: visitInput.value ?? null,
          service: visitInput.service ?? null,
          comment: visitInput.comment ?? null,
          ratingVisible: true,
          commentVisible: true,
        };
        const visit = aggregateVisit({
          ...visitInput,
          id: `v-${timestamp}`,
          visibleReviews: [review],
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
              target: {
                kind: "visit",
                placeId: visit.placeId,
                visitId: visit.id,
              },
            },
          );
        });
        return visit;
      },

      setNext: async (placeId) => {
        if (mode === "live") {
          await runLive((gid) => liveSetNextPlace(gid, placeId));
          return;
        }
        assertDemoWritable(state);
        if (
          placeId &&
          state.places.find((place) => place.id === placeId)?.collectionStatus === "archived"
        ) {
          throw new Error("Återställ matstället innan det väljs som nästa stopp.");
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
          await runLive((gid) => liveArchiveGroup(gid));
          return;
        }
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
          await runLive((gid) => liveReactivateGroup(gid));
          return;
        }
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
          await runLive((gid) => liveArchiveGroupPlace(gid, placeId));
          return;
        }
        assertDemoWritable(state);
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
          await runLive((gid) => liveRestoreGroupPlace(gid, placeId));
          return;
        }
        assertDemoWritable(state);
        setState((current) => ({
          ...current,
          places: current.places.map((place) =>
            place.id === placeId
              ? {
                  ...place,
                  collectionStatus: "active",
                  archivedAt: null,
                  archivedBy: null,
                }
              : place,
          ),
        }));
      },

      updatePlaceMetadata: async (placeId, input) => {
        if (mode === "live") {
          await runLive((gid) => liveUpdateGroupPlaceMetadata(gid, placeId, input));
          return;
        }
        assertDemoWritable(state);
        setState((current) => ({
          ...current,
          places: current.places.map((place) => {
            if (place.id !== placeId) return place;
            const canonicalCategory = place.canonicalCategory ?? place.category;
            const canonicalCuisines = place.canonicalCuisines ?? place.cuisines;
            return {
              ...place,
              canonicalCategory,
              categoryOverride: input.categoryOverride,
              category: input.categoryOverride ?? canonicalCategory,
              canonicalCuisines,
              cuisinesOverride: input.cuisinesOverride,
              cuisines: input.cuisinesOverride ?? canonicalCuisines,
              occasions: input.occasions,
              notes: input.notes ?? undefined,
            };
          }),
        }));
      },

      updateOwnReview: async (reviewId, input) => {
        if (mode === "live") {
          await runLive((gid) => liveUpdateOwnReview(gid, reviewId, input));
          return;
        }
        assertDemoWritable(state);
        const exists = state.visits.some((visit) =>
          visit.visibleReviews?.some(
            (review) => review.id === reviewId && review.userId === state.currentUserId,
          ),
        );
        if (!exists) throw new Error("Ditt omdöme hittades inte.");
        setState((current) => ({
          ...current,
          visits: current.visits.map((visit) => {
            const reviews = (visit.visibleReviews ?? []).map((review) => {
              if (review.id !== reviewId || review.userId !== current.currentUserId) {
                return review;
              }
              return {
                ...review,
                overall: input.overall,
                taste: input.taste ?? null,
                value: input.value ?? null,
                service: input.service ?? null,
                comment: input.comment ?? null,
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
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
        setState(normalizeDemoState(DEMO_STATE));
      },

      getPlace: (id) => state.places.find((place) => place.id === id),
      memberById: (id) => state.members.find((member) => member.id === id),

      visitsFor: (placeId) =>
        state.visits
          .filter((visit) => visit.placeId === placeId)
          .sort((a, b) => (a.date < b.date ? 1 : -1)),

      avgRating: (placeId) => {
        const visits = state.visits.filter((visit) => visit.placeId === placeId);
        if (!visits.length) return { overall: 0, count: 0 };
        const sum = visits.reduce((total, visit) => total + visit.overall, 0);
        return { overall: sum / visits.length, count: visits.length };
      },

      isFavorite: (placeId) =>
        state.favorites.some(
          (favorite) => favorite.memberId === state.currentUserId && favorite.placeId === placeId,
        ),

      hasVisited: (placeId, memberId) => {
        const uid = memberId ?? state.currentUserId;
        return state.visits.some(
          (visit) => visit.placeId === placeId && visit.participantIds.includes(uid),
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
        const activity = state.activity.find(
          (item) => item.kind === "next-picked" && item.placeId === state.nextPlaceId,
        );
        return activity?.memberId;
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
        const counts: Record<Occasion, number> = {
          snabbt: 0,
          avslappnat: 0,
          middag: 0,
        };
        state.places
          .filter((place) => place.collectionStatus !== "archived")
          .forEach((place) => place.occasions.forEach((occasion) => (counts[occasion] += 1)));
        return counts;
      },
    };
  }, [state, mode, submitting, runLive]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useStore måste användas inuti <StoreProvider>");
  return ctx;
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
