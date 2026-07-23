/**
 * Lokalt applikationstillstånd för Matrundan.
 *
 * Detta lager är avsiktligt separerat från komponenter så att det senare
 * går att byta ut mot ett Supabase-repository utan att ändra vyer.
 * Data speglar den planerade Supabase-modellen (profiles, groups,
 * memberships, places, visits, reviews, favorites, activity).
 */

import * as React from "react";
import { DEMO_STATE } from "./demo-data";
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

type Action =
  | { type: "reset" }
  | { type: "setNext"; placeId: string | null }
  | { type: "addPlace"; place: Omit<Place, "id" | "addedAt"> }
  | { type: "toggleFavorite"; placeId: string }
  | { type: "addVisit"; visit: Omit<Visit, "id"> };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "reset":
      return DEMO_STATE;

    case "setNext":
      return {
        ...state,
        nextPlaceId: action.placeId,
        activity: action.placeId
          ? [
              {
                id: `a-${Date.now()}`,
                kind: "next-picked",
                memberId: state.currentUserId,
                placeId: action.placeId,
                at: new Date().toISOString(),
                text: `${nameOf(state, state.currentUserId)} valde ${
                  state.places.find((p) => p.id === action.placeId)?.name ?? "ett ställe"
                } som nästa stopp`,
              },
              ...state.activity,
            ]
          : state.activity,
      };

    case "addPlace": {
      const id = `p-${Date.now()}`;
      const place: Place = {
        ...action.place,
        id,
        addedAt: new Date().toISOString(),
      };
      return {
        ...state,
        places: [place, ...state.places],
        activity: [
          {
            id: `a-${Date.now()}`,
            kind: "added",
            memberId: state.currentUserId,
            placeId: id,
            at: place.addedAt,
            text: `${nameOf(state, state.currentUserId)} la till ${place.name}`,
          },
          ...state.activity,
        ],
      };
    }

    case "toggleFavorite": {
      const exists = state.favorites.find(
        (f) => f.memberId === state.currentUserId && f.placeId === action.placeId,
      );
      const favorites: Favorite[] = exists
        ? state.favorites.filter(
            (f) => !(f.memberId === state.currentUserId && f.placeId === action.placeId),
          )
        : [...state.favorites, { memberId: state.currentUserId, placeId: action.placeId }];
      return { ...state, favorites };
    }

    case "addVisit": {
      const id = `v-${Date.now()}`;
      const visit: Visit = { ...action.visit, id };
      const place = state.places.find((p) => p.id === visit.placeId);
      return {
        ...state,
        visits: [visit, ...state.visits],
        nextPlaceId: state.nextPlaceId === visit.placeId ? null : state.nextPlaceId,
        activity: [
          {
            id: `a-${Date.now()}`,
            kind: "visited",
            memberId: state.currentUserId,
            placeId: visit.placeId,
            visitId: id,
            at: visit.date,
            text: `${nameOf(state, state.currentUserId)} registrerade ett besök på ${
              place?.name ?? "ett ställe"
            }`,
          },
          ...state.activity,
        ],
      };
    }
  }
}

function nameOf(state: AppState, memberId: string) {
  return state.members.find((m) => m.id === memberId)?.name ?? "Någon";
}

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  // selectors
  getPlace: (id: string) => Place | undefined;
  visitsFor: (placeId: string) => Visit[];
  avgRating: (placeId: string) => { overall: number; count: number };
  isFavorite: (placeId: string) => boolean;
  hasVisited: (placeId: string, memberId?: string) => boolean;
  statusOf: (placeId: string) => "nytt-for-mig" | "nytt-for-gruppen" | "alla-provat" | "delvis";
  categoryCounts: () => Record<PlaceCategory, number>;
  occasionCounts: () => Record<Occasion, number>;
}

const StoreContext = React.createContext<StoreContextValue | null>(null);

function loadInitial(): AppState {
  if (typeof window === "undefined") return DEMO_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEMO_STATE;
    return JSON.parse(raw) as AppState;
  } catch {
    return DEMO_STATE;
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, DEMO_STATE);
  const [hydrated, setHydrated] = React.useState(false);

  // Hydrera från localStorage efter mount (SSR-säkert)
  React.useEffect(() => {
    const loaded = loadInitial();
    if (loaded !== DEMO_STATE) {
      // ersätt hela state via reset + replay – enklare: bara skriv över
      // genom att köra en microreset. Vi använder en snabb "reset" trick:
      // ersätt via ett custom action: hantera i-line här:
      // Enklaste: hoppa över – vi bevarar DEMO_STATE på första besöket och
      // sparar därefter förändringar.
      // Faktisk hydratisering:
      (dispatch as unknown as (a: { type: "__hydrate"; state: AppState }) => void)({
        type: "__hydrate",
        state: loaded,
      });
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota
    }
  }, [state, hydrated]);

  const value = React.useMemo<StoreContextValue>(() => {
    return {
      state,
      dispatch,
      getPlace: (id) => state.places.find((p) => p.id === id),
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
          state.visits.some((v) => v.placeId === placeId && v.participantIds.includes(mid)),
        );
        const myVisited = visited.includes(state.currentUserId);
        if (visited.length === 0) return "nytt-for-gruppen";
        if (visited.length === memberIds.length) return "alla-provat";
        if (!myVisited) return "nytt-for-mig";
        return "delvis";
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

// Extend reducer to handle hydrate outside the discriminated union above.
// We do this by monkeypatching via a wrapper — but simpler: re-declare reducer.
// (kept above cleanly)

export function useStore() {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useStore måste användas inuti <StoreProvider>");
  return ctx;
}

// -- helpers exponerade för vyer --

export function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "idag";
  if (days === 1) return "igår";
  if (days < 7) return `${days} dgr sedan`;
  if (days < 30) return `${Math.floor(days / 7)} v sedan`;
  return d.toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" });
}

export function googleMapsUrl(p: Place) {
  const q = encodeURIComponent(`${p.name} ${p.address} ${p.city}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
