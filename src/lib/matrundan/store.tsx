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
  liveCreatePlace,
  liveCreateVisitWithReview,
  liveSetNextPlace,
  liveToggleFavorite,
} from "./live-mutations";
import type {
  Activity,
  AppState,
  Place,
  PlaceCategory,
  Occasion,
  Visit,
} from "./types";

const STORAGE_KEY = "matrundan.state.v1";

function nameOf(state: AppState, memberId: string) {
  return state.members.find((m) => m.id === memberId)?.name ?? "Någon";
}

interface StoreContextValue {
  state: AppState;
  mode: "demo" | "live";
  /** true medan en live-mutation pågår – används för att inaktivera CTA:er. */
  submitting: boolean;
  addPlace: (input: Omit<Place, "id" | "addedAt">) => Promise<Place>;
  toggleFavorite: (placeId: string) => Promise<void>;
  addVisit: (visit: Omit<Visit, "id">) => Promise<Visit>;
  setNext: (placeId: string | null) => Promise<void>;
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
  const [state, setState] = React.useState<AppState>(initialState ?? DEMO_STATE);
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
        const parsed = JSON.parse(raw) as AppState;
        setState({ ...parsed, version: APP_VERSION });
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

  const runLive = React.useCallback(
    async <T,>(op: (groupId: string) => Promise<T>): Promise<T> => {
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
    },
    [],
  );

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
        const place: Place = {
          ...input,
          id: `p-${Date.now()}`,
          addedAt: new Date().toISOString(),
        };
        setState((s) =>
          pushActivity(
            { ...s, places: [place, ...s.places] },
            {
              id: `a-${Date.now()}`,
              kind: "added",
              memberId: s.currentUserId,
              placeId: place.id,
              at: place.addedAt,
              text: `${nameOf(s, s.currentUserId)} la till ${place.name}`,
              target: { kind: "place", placeId: place.id },
            },
          ),
        );
        return place;
      },

      toggleFavorite: async (placeId) => {
        if (mode === "live") {
          await runLive((gid) => liveToggleFavorite(gid, placeId));
          return;
        }
        setState((s) => {
          const exists = s.favorites.find(
            (f) => f.memberId === s.currentUserId && f.placeId === placeId,
          );
          return {
            ...s,
            favorites: exists
              ? s.favorites.filter(
                  (f) => !(f.memberId === s.currentUserId && f.placeId === placeId),
                )
              : [...s.favorites, { memberId: s.currentUserId, placeId }],
          };
        });
      },

      addVisit: async (visitInput) => {
        if (mode === "live") {
          const id = await runLive((gid) =>
            liveCreateVisitWithReview(gid, visitInput),
          );
          return { ...visitInput, id } as Visit;
        }
        const visit: Visit = { ...visitInput, id: `v-${Date.now()}` };
        setState((s) => {
          const place = s.places.find((p) => p.id === visit.placeId);
          return pushActivity(
            {
              ...s,
              visits: [visit, ...s.visits],
              nextPlaceId: s.nextPlaceId === visit.placeId ? null : s.nextPlaceId,
            },
            {
              id: `a-${Date.now()}`,
              kind: "visited",
              memberId: s.currentUserId,
              placeId: visit.placeId,
              visitId: visit.id,
              at: visit.date,
              text: `${nameOf(s, s.currentUserId)} registrerade ett besök på ${
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
        setState((s) => {
          if (!placeId) return { ...s, nextPlaceId: null };
          const place = s.places.find((p) => p.id === placeId);
          return pushActivity(
            { ...s, nextPlaceId: placeId },
            {
              id: `a-${Date.now()}`,
              kind: "next-picked",
              memberId: s.currentUserId,
              placeId,
              at: new Date().toISOString(),
              text: `${nameOf(s, s.currentUserId)} valde ${
                place?.name ?? "ett ställe"
              } som nästa stopp`,
              target: { kind: "place", placeId },
            },
          );
        });
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
        setState(DEMO_STATE);
      },

      getPlace: (id) => state.places.find((p) => p.id === id),
      memberById: (id) => state.members.find((m) => m.id === id),

      visitsFor: (placeId) =>
        state.visits
          .filter((v) => v.placeId === placeId)
          .sort((a, b) => (a.date < b.date ? 1 : -1)),

      avgRating: (placeId) => {
        const vs = state.visits.filter((v) => v.placeId === placeId);
        if (!vs.length) return { overall: 0, count: 0 };
        const sum = vs.reduce((s, v) => s + v.overall, 0);
        return { overall: sum / vs.length, count: vs.length };
      },

      isFavorite: (placeId) =>
        state.favorites.some(
          (f) => f.memberId === state.currentUserId && f.placeId === placeId,
        ),

      hasVisited: (placeId, memberId) => {
        const uid = memberId ?? state.currentUserId;
        return state.visits.some(
          (v) => v.placeId === placeId && v.participantIds.includes(uid),
        );
      },

      statusOf: (placeId) => {
        const memberIds = state.members.map((m) => m.id);
        const visited = memberIds.filter((mid) =>
          state.visits.some(
            (v) => v.placeId === placeId && v.participantIds.includes(mid),
          ),
        );
        if (visited.length === 0) return "nytt-for-gruppen";
        if (visited.length === memberIds.length) return "alla-provat";
        if (!visited.includes(state.currentUserId)) return "nytt-for-mig";
        return "delvis";
      },

      visitedCounts: (placeId) => {
        const memberIds = state.members.map((m) => m.id);
        const visited = memberIds.filter((mid) =>
          state.visits.some(
            (v) => v.placeId === placeId && v.participantIds.includes(mid),
          ),
        );
        return { visited: visited.length, total: memberIds.length };
      },

      proposerOfNext: () => {
        if (!state.nextPlaceId) return undefined;
        const a = state.activity.find(
          (x) => x.kind === "next-picked" && x.placeId === state.nextPlaceId,
        );
        return a?.memberId;
      },

      categoryCounts: () => {
        const acc: Record<PlaceCategory, number> = {
          restaurang: 0,
          café: 0,
          bageri: 0,
          snabbmat: 0,
          pub: 0,
          matvagn: 0,
        };
        state.places.forEach((p) => (acc[p.category] += 1));
        return acc;
      },

      occasionCounts: () => {
        const acc: Record<Occasion, number> = { snabbt: 0, avslappnat: 0, middag: 0 };
        state.places.forEach((p) => p.occasions.forEach((o) => (acc[o] += 1)));
        return acc;
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
  const d = new Date(iso);
  const now = new Date();
  const days = Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "idag";
  if (days === 1) return "igår";
  if (days < 7) return `${days} dgr sedan`;
  if (days < 30) return `${Math.floor(days / 7)} v sedan`;
  return d.toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function googleMapsUrl(p: Place) {
  const q = encodeURIComponent(`${p.name} ${p.address} ${p.city}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
