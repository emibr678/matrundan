import * as React from "react";
import {
  canWithdrawNextStopProposal,
  deriveNextStopState,
  liveClearNextStopSelectionV2,
  liveGetNextStopDayUnavailabilityV2,
  liveProposeNextStopPlaceV2,
  liveSelectNextStopPlaceV2,
  liveSetNextStopDayUnavailableV2,
  liveSetNextStopPlaceSupportV2,
  liveSetNextStopScheduleV2,
  liveWithdrawNextStopPlaceV2,
} from "./next-stop-v2";
import { useStore } from "./store";
import type { NextStopState } from "./types";

const DEMO_STORAGE_PREFIX = "matrundan.nextStop.v2";
const DEMO_UNAVAILABLE_STORAGE_PREFIX = "matrundan.nextStop.v2.unavailable";

function demoStorage(groupId: string): Storage | null {
  if (typeof window === "undefined") return null;
  return groupId === "example-stockholm" ? window.sessionStorage : window.localStorage;
}

function storageKey(groupId: string): string {
  return `${DEMO_STORAGE_PREFIX}.${groupId}`;
}

function unavailableStorageKey(groupId: string): string {
  return `${DEMO_UNAVAILABLE_STORAGE_PREFIX}.${groupId}`;
}

function readDemoState(groupId: string, fallback: NextStopState | null): NextStopState | null {
  try {
    const raw = demoStorage(groupId)?.getItem(storageKey(groupId));
    if (!raw) return fallback;
    const value = JSON.parse(raw) as NextStopState;
    return value && Array.isArray(value.proposals) ? value : fallback;
  } catch {
    return fallback;
  }
}

function readDemoUnavailable(groupId: string): string[] {
  try {
    const raw = demoStorage(groupId)?.getItem(unavailableStorageKey(groupId));
    if (!raw) return [];
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function freshState(revision = 1): NextStopState {
  return {
    revision,
    plannedDate: null,
    plannedTime: null,
    selectedPlaceId: null,
    proposals: [],
  };
}

function nextRevision(state: NextStopState): number {
  return Math.max(1, state.revision + 1);
}

function dispatchReload(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("matrundan:reload"));
  }
}

export function useNextStopV2() {
  const { state, mode } = useStore();
  const fallback = React.useMemo(() => deriveNextStopState(state), [state]);
  const [demoState, setDemoState] = React.useState<NextStopState | null>(() =>
    mode === "demo" ? readDemoState(state.group.id, fallback) : null,
  );
  const [dayUnavailableMemberIds, setDayUnavailableMemberIds] = React.useState<string[]>(() =>
    mode === "demo" ? readDemoUnavailable(state.group.id) : [],
  );
  const initialVisitIds = React.useRef(new Set(state.visits.map((visit) => visit.id)));

  const nextStop = mode === "live" ? fallback : demoState;
  const backendReady = mode === "demo" || state.nextStop !== undefined;

  React.useEffect(() => {
    if (mode !== "demo") return;
    try {
      const storage = demoStorage(state.group.id);
      if (demoState) storage?.setItem(storageKey(state.group.id), JSON.stringify(demoState));
      else storage?.removeItem(storageKey(state.group.id));
    } catch {
      /* Demo-lagring får aldrig blockera produktflödet. */
    }
  }, [demoState, mode, state.group.id]);

  React.useEffect(() => {
    if (mode !== "demo") return;
    try {
      const storage = demoStorage(state.group.id);
      if (nextStop?.plannedDate && dayUnavailableMemberIds.length > 0) {
        storage?.setItem(
          unavailableStorageKey(state.group.id),
          JSON.stringify(dayUnavailableMemberIds),
        );
      } else {
        storage?.removeItem(unavailableStorageKey(state.group.id));
      }
    } catch {
      /* Demo-lagring får aldrig blockera produktflödet. */
    }
  }, [dayUnavailableMemberIds, mode, nextStop?.plannedDate, state.group.id]);

  React.useEffect(() => {
    if (mode !== "live" || !backendReady || !nextStop?.plannedDate) {
      if (mode === "live") setDayUnavailableMemberIds([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const memberIds = await liveGetNextStopDayUnavailabilityV2(state.group.id);
        if (!cancelled) setDayUnavailableMemberIds(memberIds);
      } catch (error) {
        if (!cancelled) {
          console.warn("[Matrundan] Kunde inte läsa Kan inte då-markeringar:", error);
          setDayUnavailableMemberIds([]);
        }
      }
    };

    void load();
    window.addEventListener("matrundan:reload", load);
    return () => {
      cancelled = true;
      window.removeEventListener("matrundan:reload", load);
    };
  }, [backendReady, mode, nextStop?.plannedDate, state.group.id]);

  React.useEffect(() => {
    if (mode !== "demo" || typeof window === "undefined") return;
    const reset = () => {
      try {
        const storage = demoStorage(state.group.id);
        storage?.removeItem(storageKey(state.group.id));
        storage?.removeItem(unavailableStorageKey(state.group.id));
      } catch {
        /* ignore */
      }
      setDemoState(deriveNextStopState(state));
      setDayUnavailableMemberIds([]);
      initialVisitIds.current = new Set(state.visits.map((visit) => visit.id));
    };
    window.addEventListener("matrundan:demo-reset", reset);
    return () => window.removeEventListener("matrundan:demo-reset", reset);
  }, [mode, state]);

  React.useEffect(() => {
    if (mode !== "demo") return;
    if (state.group.lifecycleStatus === "archived") {
      setDemoState(null);
      setDayUnavailableMemberIds([]);
      return;
    }

    const activePlaceIds = new Set(
      state.places
        .filter((place) => place.collectionStatus !== "archived")
        .map((place) => place.id),
    );
    setDemoState((current) => {
      if (!current) return current;
      const proposals = current.proposals.filter((proposal) =>
        activePlaceIds.has(proposal.placeId),
      );
      const selectedPlaceId =
        current.selectedPlaceId && activePlaceIds.has(current.selectedPlaceId)
          ? current.selectedPlaceId
          : null;
      if (
        proposals.length === current.proposals.length &&
        selectedPlaceId === current.selectedPlaceId
      ) {
        return current;
      }
      return {
        ...current,
        revision: nextRevision(current),
        selectedPlaceId,
        proposals,
      };
    });
  }, [mode, state.group.lifecycleStatus, state.places]);

  React.useEffect(() => {
    if (mode !== "demo") return;
    if (!demoState?.plannedDate && dayUnavailableMemberIds.length > 0) {
      setDayUnavailableMemberIds([]);
    }
  }, [dayUnavailableMemberIds.length, demoState?.plannedDate, mode]);

  React.useEffect(() => {
    if (mode !== "demo") return;
    const known = initialVisitIds.current;
    const addedVisits = state.visits.filter((visit) => !known.has(visit.id));
    initialVisitIds.current = new Set(state.visits.map((visit) => visit.id));
    if (addedVisits.length === 0 || !demoState) return;

    const plannedPlaceIds = new Set([
      ...demoState.proposals.map((proposal) => proposal.placeId),
      ...(demoState.selectedPlaceId ? [demoState.selectedPlaceId] : []),
    ]);
    const relevantVisit = addedVisits.some(
      (visit) => visit.linkType !== "shared" && plannedPlaceIds.has(visit.placeId),
    );
    if (!relevantVisit) return;

    setDemoState(null);
    setDayUnavailableMemberIds([]);
  }, [demoState, mode, state.visits]);

  async function propose(placeId: string): Promise<void> {
    if (mode === "live") {
      await liveProposeNextStopPlaceV2(state.group.id, placeId);
      dispatchReload();
      return;
    }

    const base = demoState ?? freshState();
    if (base.proposals.some((proposal) => proposal.placeId === placeId)) return;
    if (base.proposals.length >= 5) {
      throw new Error(
        "Ni har redan fem ställen på förslag. Ta bort ett innan ni lägger till ett nytt.",
      );
    }

    setDemoState({
      ...base,
      revision: nextRevision(base),
      proposals: [
        ...base.proposals,
        {
          id: `demo-next-stop-${Date.now()}`,
          placeId,
          proposedBy: state.currentUserId,
          createdAt: new Date().toISOString(),
          supports: [],
        },
      ],
    });
  }

  async function setSupport(proposalId: string, supported: boolean): Promise<void> {
    if (mode === "live") {
      await liveSetNextStopPlaceSupportV2(state.group.id, proposalId, supported);
      dispatchReload();
      return;
    }

    setDemoState((current) => {
      if (!current) return current;
      const updatedAt = new Date().toISOString();
      return {
        ...current,
        proposals: current.proposals.map((proposal) =>
          proposal.id !== proposalId
            ? proposal
            : {
                ...proposal,
                supports: supported
                  ? [
                      ...proposal.supports.filter(
                        (support) => support.memberId !== state.currentUserId,
                      ),
                      { memberId: state.currentUserId, updatedAt },
                    ]
                  : proposal.supports.filter(
                      (support) => support.memberId !== state.currentUserId,
                    ),
              },
        ),
      };
    });
  }

  async function select(proposalId: string): Promise<void> {
    const revision = nextStop?.revision ?? 1;
    if (mode === "live") {
      await liveSelectNextStopPlaceV2(state.group.id, proposalId, revision);
      dispatchReload();
      return;
    }

    const proposal = demoState?.proposals.find((item) => item.id === proposalId);
    if (!demoState || !proposal) throw new Error("Förslaget finns inte längre.");
    if (demoState.selectedPlaceId === proposal.placeId) return;
    setDemoState({
      ...demoState,
      revision: nextRevision(demoState),
      selectedPlaceId: proposal.placeId,
    });
  }

  async function clearSelection(): Promise<void> {
    const revision = nextStop?.revision ?? 1;
    if (mode === "live") {
      await liveClearNextStopSelectionV2(state.group.id, revision);
      dispatchReload();
      return;
    }
    if (!demoState?.selectedPlaceId) return;
    setDemoState({
      ...demoState,
      revision: nextRevision(demoState),
      selectedPlaceId: null,
    });
  }

  async function withdraw(proposalId: string): Promise<void> {
    if (mode === "live") {
      await liveWithdrawNextStopPlaceV2(state.group.id, proposalId);
      dispatchReload();
      return;
    }

    const proposal = demoState?.proposals.find((item) => item.id === proposalId);
    if (!demoState || !proposal) return;
    if (!canWithdrawNextStopProposal(state, proposal)) {
      throw new Error("Du kan bara ta bort egna förslag.");
    }
    setDemoState({
      ...demoState,
      revision: nextRevision(demoState),
      selectedPlaceId:
        demoState.selectedPlaceId === proposal.placeId ? null : demoState.selectedPlaceId,
      proposals: demoState.proposals.filter((item) => item.id !== proposalId),
    });
  }

  async function setSchedule(date: string | null, time: string | null): Promise<void> {
    if (time && !date) throw new Error("Välj en dag innan du lägger till en tid.");
    const revision = nextStop?.revision ?? 1;
    const dateChanged = (nextStop?.plannedDate ?? null) !== date;

    if (mode === "live") {
      await liveSetNextStopScheduleV2(state.group.id, date, time, revision);
      if (dateChanged) setDayUnavailableMemberIds([]);
      dispatchReload();
      return;
    }

    const base = demoState ?? freshState();
    if (base.plannedDate === date && (base.plannedTime ?? null) === time) return;
    setDemoState({
      ...base,
      revision: nextRevision(base),
      plannedDate: date,
      plannedTime: date ? time : null,
    });
    if (dateChanged) setDayUnavailableMemberIds([]);
  }

  async function setDayUnavailable(unavailable: boolean): Promise<void> {
    const plannedDate = nextStop?.plannedDate ?? null;
    if (!plannedDate) throw new Error("Lägg till en dag först.");

    if (mode === "live") {
      await liveSetNextStopDayUnavailableV2(state.group.id, plannedDate, unavailable);
      setDayUnavailableMemberIds((current) =>
        unavailable
          ? [...new Set([...current, state.currentUserId])]
          : current.filter((memberId) => memberId !== state.currentUserId),
      );
      dispatchReload();
      return;
    }

    setDayUnavailableMemberIds((current) =>
      unavailable
        ? [...new Set([...current, state.currentUserId])]
        : current.filter((memberId) => memberId !== state.currentUserId),
    );
  }

  return {
    nextStop,
    backendReady,
    dayUnavailableMemberIds,
    propose,
    setSupport,
    select,
    clearSelection,
    withdraw,
    setSchedule,
    setDayUnavailable,
  };
}
