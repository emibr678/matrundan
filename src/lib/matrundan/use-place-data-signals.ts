import * as React from "react";

import type { ReportablePlaceSuggestion } from "./place-data-reports";
import {
  getPlaceDataSignals,
  localPlaceDataSignal,
  mergePlaceDataSignalTarget,
  signalTargetFromReportableSuggestion,
  signalTargetFromSuggestion,
  type PlaceDataSignal,
  type PlaceDataSignalTarget,
} from "./place-data-signals";
import type { PlaceSuggestion } from "./places-provider";
import { useSession } from "./session";
import { useStore } from "./store";

const targetCache = new Map<string, PlaceDataSignalTarget>();
const signalCache = new Map<string, PlaceDataSignal>();

function cacheKey(mode: string, groupId: string, targetKey: string): string {
  return `${mode}:${groupId}:${targetKey}`;
}

function targetDependencyKey(target: PlaceDataSignalTarget): string {
  return [
    target.key,
    target.placeId ?? "",
    target.provider ?? "",
    target.providerPlaceId ?? "",
    target.hasWebsite ? "website" : "no-website",
    target.hasOpeningHours === null
      ? "hours-unknown"
      : target.hasOpeningHours
        ? "has-hours"
        : "no-hours",
  ].join(":");
}

function usePlaceDataSignalsForTargets(
  requestedTargets: PlaceDataSignalTarget[],
  authoritative: boolean,
): Record<string, PlaceDataSignal> {
  const { mode, activeGroupId } = useSession();
  const { state } = useStore();
  const [signals, setSignals] = React.useState<Record<string, PlaceDataSignal>>({});
  const [revision, setRevision] = React.useState(0);
  const groupId = mode === "live" ? activeGroupId : state.group.id;
  const dependencyKey = requestedTargets.map(targetDependencyKey).join("|");

  React.useEffect(() => {
    const handleChanged = () => setRevision((value) => value + 1);
    window.addEventListener("matrundan:place-data-signals-changed", handleChanged);
    return () => window.removeEventListener("matrundan:place-data-signals-changed", handleChanged);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    if (!groupId || requestedTargets.length === 0) {
      setSignals({});
      return;
    }

    const targets = requestedTargets.map((target) => {
      const key = cacheKey(mode, groupId, target.key);
      const merged = mergePlaceDataSignalTarget(targetCache.get(key), target, authoritative);
      targetCache.set(key, merged);
      return merged;
    });

    const fallback = Object.fromEntries(
      targets.map((target) => {
        const key = cacheKey(mode, groupId, target.key);
        return [target.key, signalCache.get(key) ?? localPlaceDataSignal(target)];
      }),
    );
    setSignals(fallback);

    if (mode !== "live") return;

    void getPlaceDataSignals(groupId, targets)
      .then((rows) => {
        if (cancelled) return;
        rows.forEach((row) => signalCache.set(cacheKey(mode, groupId, row.key), row));
        setSignals(Object.fromEntries(rows.map((row) => [row.key, row])));
      })
      .catch(() => {
        if (!cancelled) setSignals(fallback);
      });

    return () => {
      cancelled = true;
    };
  }, [authoritative, dependencyKey, groupId, mode, revision, requestedTargets]);

  return signals;
}

export function usePlaceDataSignalsForSuggestions(
  suggestions: PlaceSuggestion[],
): Record<string, PlaceDataSignal> {
  const targets = React.useMemo(() => suggestions.map(signalTargetFromSuggestion), [suggestions]);
  return usePlaceDataSignalsForTargets(targets, true);
}

export function usePlaceDataSignalForReportableSuggestion(suggestion: ReportablePlaceSuggestion): {
  signal: PlaceDataSignal | undefined;
  target: PlaceDataSignalTarget;
} {
  const target = React.useMemo(
    () => signalTargetFromReportableSuggestion(suggestion),
    [suggestion.provider, suggestion.providerPlaceId, suggestion.website],
  );
  const signals = usePlaceDataSignalsForTargets(
    React.useMemo(() => [target], [target]),
    false,
  );
  return { signal: signals[target.key], target };
}
