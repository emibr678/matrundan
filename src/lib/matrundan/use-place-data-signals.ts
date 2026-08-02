import * as React from "react";

import {
  getPlaceDataSignals,
  localPlaceDataSignal,
  signalTargetFromSuggestion,
  type PlaceDataSignal,
} from "./place-data-signals";
import type { PlaceSuggestion } from "./places-provider";
import { useSession } from "./session";
import { useStore } from "./store";

function stableSuggestionKey(suggestion: PlaceSuggestion): string {
  return `${suggestion.provider ?? "unknown"}:${suggestion.externalId}:${
    suggestion.website ? "w" : "-"
  }:${suggestion.hasOpeningHours ? "h" : "-"}`;
}

export function usePlaceDataSignalsForSuggestions(suggestions: PlaceSuggestion[]) {
  const { mode, activeGroupId } = useSession();
  const { state } = useStore();
  const [signals, setSignals] = React.useState<Record<string, PlaceDataSignal>>({});
  const groupId = mode === "live" ? activeGroupId : state.group.id;
  const stableKey = suggestions.map(stableSuggestionKey).join("|");

  React.useEffect(() => {
    let cancelled = false;
    const targets = suggestions.map(signalTargetFromSuggestion);
    if (!groupId || targets.length === 0) {
      setSignals({});
      return;
    }

    if (mode !== "live") {
      setSignals(
        Object.fromEntries(targets.map((target) => [target.key, localPlaceDataSignal(target)])),
      );
      return;
    }

    void getPlaceDataSignals(groupId, targets)
      .then((rows) => {
        if (!cancelled) setSignals(Object.fromEntries(rows.map((row) => [row.key, row])));
      })
      .catch(() => {
        if (!cancelled) setSignals({});
      });

    return () => {
      cancelled = true;
    };
  }, [groupId, mode, stableKey]);

  return signals;
}
