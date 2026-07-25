/**
 * Lokalt applikationstillstånd för Matrundan.
 *
 * Detta lager är avsiktligt separerat från vyerna så att det senare kan
 * bytas ut mot ett Supabase-repository utan att ändra komponenterna.
 * Modellen speglar den planerade Supabase-schemat: profiles, groups,
 * memberships, places, visits, reviews, favorites, activity.
 */

import * as React from "react";
import { DEMO_STATE } from "./demo-data";
import { APP_VERSION } from "./version";
import type {
  Activity,
  AppState,
  Favorite,
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
  addPlace: (input: Omit<Place, "id" | "addedAt">) => Place;
  toggleFavorite: (placeId: string) => void;
  addVisit: (visit: Omit<Visit, "id">) => Visit;
  setNext: (placeId: string | null) => void;
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

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AppState>(DEMO_STATE);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppState;
        // Håll version i sync med APP_VERSION även om äldre data cachas.
        setState({ ...parsed, version: APP_VERSION });
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, hydrated]);

  const value = React.useMemo<StoreContextValue>(() => {
    const pushActivity = (s: AppState, a: Activity): AppState => ({
      ...s,
      activity: [a, ...s.activity].slice(0, 50),
    });

    return {
      state,

      addPlace: (input) => {
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

      toggleFavorite: (placeId) =>
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
        }),

      addVisit: (visitInput) => {
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

      setNext: (placeId) =>
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
        }),

      resetDemo: () => {
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
  }, [state]);

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
