import * as React from "react";
import {
  canWithdrawNextStopProposal,
  deriveNextStopState,
  liveProposeNextStopPlaceV2,
  liveSelectNextStopPlaceV2,
  liveSetNextStopDayV2,
  liveSetNextStopPlaceSupportV2,
  liveWithdrawNextStopPlaceV2,
} from "./next-stop-v2";
import { useStore } from "./store";
import type { NextStopState } from "./types";

const DEMO_STORAGE_PREFIX = "matrundan.nextStop.v2";

function demoStorage(groupId: string): Storage | null {
  if (typeof window === "undefined") return null;
  return groupId === "example-stockholm" ? window.sessionStorage : window.localStorage;
}

function storageKey(groupId: string): string {
  return `${DEMO_STORAGE_PREFIX}.${groupId}`;
}

function normalizeState(value: NextStopState): NextStopState {
  const proposals = Array.isArray(value.proposals) ? value.proposals : [];
  const selectedExists = proposals.some((proposal) => proposal.placeId === value.selectedPlaceId);
  return {
    ...value,
    plannedTime: null,
    selectedPlaceId: selectedExists ? value.selectedPlaceId : (proposals[0]?.placeId ?? null),
    proposals,
  };
}

function readDemoState(groupId: string, fallback: NextStopState | null): NextStopState | null {
  try {
    const raw = demoStorage(groupId)?.getItem(storageKey(groupId));
    if (!raw) return fallback;
    const value = JSON.parse(raw) as NextStopState;
    return value && Array.isArray(value.proposals) ? normalizeState(value) : fallback;
  } catch {
    return fallback;
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
  const fallback = React.useMemo(() => {
    const derived = deriveNextStopState(state);
    return derived ? normalizeState(derived) : null;
  }, [state]);
  const [demoState, setDemoState] = React.useState<NextStopState | null>(() =>
    mode === "demo" ? readDemoState(state.group.id, fallback) : null,
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
    if (mode !== "demo" || typeof window === "undefined") return;
    const reset = () => {
      try {
        demoStorage(state.group.id)?.removeItem(storageKey(state.group.id));
      } catch {
        /* ignore */
      }
      const derived = deriveNextStopState(state);
      setDemoState(derived ? normalizeState(derived) : null);
      initialVisitIds.current = new Set(state.visits.map((visit) => visit.id));
    };
    window.addEventListener("matrundan:demo-reset", reset);
    return () => window.removeEventListener("matrundan:demo-reset", reset);
  }, [mode, state]);

  React.useEffect(() => {
    if (mode !== "demo") return;
    if (state.group.lifecycleStatus === "archived") {
      setDemoState(null);
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
          : (proposals[0]?.placeId ?? null);
      if (
        proposals.length === current.proposals.length &&
        selectedPlaceId === current.selectedPlaceId &&
        current.plannedTime == null
      ) {
        return current;
      }
      return {
        ...current,
        revision: nextRevision(current),
        selectedPlaceId,
        plannedTime: null,
        proposals,
      };
    });
  }, [mode, state.group.lifecycleStatus, state.places]);

  React.useEffect(() => {
    if (mode !== "demo") return;
    const known = initialVisitIds.current;
    const addedVisits = state.visits.filter((visit) => !known.has(visit.id));
    initialVisitIds.current = new Set(state.visits.map((visit) => visit.id));
    if (addedVisits.length === 0 || !demoState) return;

    const plannedPlaceIds = new Set(demoState.proposals.map((proposal) => proposal.placeId));
    const relevantVisit = addedVisits.some(
      (visit) => visit.linkType !== "shared" && plannedPlaceIds.has(visit.placeId),
    );
    if (!relevantVisit) return;

    setDemoState(null);
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

    const proposal = {
      id: `demo-next-stop-${Date.now()}`,
      placeId,
      proposedBy: state.currentUserId,
      createdAt: new Date().toISOString(),
      supports: [],
    };
    setDemoState({
      ...base,
      revision: nextRevision(base),
      plannedTime: null,
      selectedPlaceId: base.selectedPlaceId ?? placeId,
      proposals: [...base.proposals, proposal],
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
                  : proposal.supports.filter((support) => support.memberId !== state.currentUserId),
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
      plannedTime: null,
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

    const proposals = demoState.proposals.filter((item) => item.id !== proposalId);
    const selectedPlaceId =
      demoState.selectedPlaceId === proposal.placeId
        ? (proposals[0]?.placeId ?? null)
        : demoState.selectedPlaceId;
    setDemoState({
      ...demoState,
      revision: nextRevision(demoState),
      selectedPlaceId,
      plannedTime: null,
      proposals,
    });
  }

  async function setSchedule(date: string | null): Promise<void> {
    const revision = nextStop?.revision ?? 1;

    if (mode === "live") {
      await liveSetNextStopDayV2(state.group.id, date, revision);
      dispatchReload();
      return;
    }

    const base = demoState ?? freshState();
    if (base.plannedDate === date && base.plannedTime == null) return;
    setDemoState({
      ...base,
      revision: nextRevision(base),
      plannedDate: date,
      plannedTime: null,
    });
  }

  return {
    nextStop,
    backendReady,
    propose,
    setSupport,
    select,
    withdraw,
    setSchedule,
  };
}
