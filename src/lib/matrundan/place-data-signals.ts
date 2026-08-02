import { z } from "zod";

import type { ReportablePlaceSuggestion } from "./place-data-reports";
import type { PlaceSuggestion } from "./places-provider";
import { rpcClient } from "./rpc-client";

export const PLACE_DATA_CLOSURE_STATUSES = ["none", "unverified", "reviewed", "uncertain"] as const;
export type PlaceDataClosureStatus = (typeof PLACE_DATA_CLOSURE_STATUSES)[number];
export type PlaceDataSignalVerdict = "closed_permanently" | "appears_open";

export interface PlaceDataSignal {
  key: string;
  closureStatus: PlaceDataClosureStatus;
  limitedInformation: boolean;
  recentlyConfirmedOpen: boolean;
}

export interface PlaceDataSignalTarget {
  key: string;
  placeId?: string | null;
  provider?: string | null;
  providerPlaceId?: string | null;
  hasWebsite: boolean;
  hasOpeningHours: boolean | null;
}

const signalSchema = z.object({
  key: z.string().min(1),
  closureStatus: z.enum(PLACE_DATA_CLOSURE_STATUSES),
  limitedInformation: z.boolean(),
  recentlyConfirmedOpen: z.boolean(),
});

const signalListSchema = z.array(signalSchema);

export function placeSignalKey(input: {
  placeId?: string | null;
  provider?: string | null;
  providerPlaceId?: string | null;
}): string {
  if (input.placeId) return `place:${input.placeId}`;
  const provider = input.provider?.trim().toLocaleLowerCase("en-US") || "unknown";
  return `provider:${provider}:${input.providerPlaceId?.trim() ?? ""}`;
}

function openingHoursFromSuggestion(suggestion: PlaceSuggestion): boolean | null {
  const value = (suggestion as PlaceSuggestion & { hasOpeningHours?: boolean }).hasOpeningHours;
  if (typeof value === "boolean") return value;
  return suggestion.provider === "demo" ? false : null;
}

export function signalTargetFromSuggestion(suggestion: PlaceSuggestion): PlaceDataSignalTarget {
  return {
    key: placeSignalKey({
      provider: suggestion.provider,
      providerPlaceId: suggestion.externalId,
    }),
    provider: suggestion.provider?.trim().toLocaleLowerCase("en-US") || "unknown",
    providerPlaceId: suggestion.externalId,
    hasWebsite: Boolean(suggestion.website),
    hasOpeningHours: openingHoursFromSuggestion(suggestion),
  };
}

export function signalTargetFromReportableSuggestion(
  suggestion: ReportablePlaceSuggestion,
): PlaceDataSignalTarget {
  const openingHours = (suggestion as ReportablePlaceSuggestion & { hasOpeningHours?: boolean })
    .hasOpeningHours;
  return {
    key: placeSignalKey({
      provider: suggestion.provider,
      providerPlaceId: suggestion.providerPlaceId,
    }),
    provider: suggestion.provider.trim().toLocaleLowerCase("en-US"),
    providerPlaceId: suggestion.providerPlaceId,
    hasWebsite: Boolean(suggestion.website),
    hasOpeningHours: typeof openingHours === "boolean" ? openingHours : null,
  };
}

export function mergePlaceDataSignalTarget(
  current: PlaceDataSignalTarget | undefined,
  incoming: PlaceDataSignalTarget,
  authoritative: boolean,
): PlaceDataSignalTarget {
  if (!current || authoritative) return incoming;
  return {
    ...incoming,
    hasWebsite: incoming.hasWebsite || current.hasWebsite,
    hasOpeningHours: incoming.hasOpeningHours ?? current.hasOpeningHours,
  };
}

export function localPlaceDataSignal(target: PlaceDataSignalTarget): PlaceDataSignal {
  return {
    key: target.key,
    closureStatus: "none",
    limitedInformation: !target.hasWebsite && target.hasOpeningHours === false,
    recentlyConfirmedOpen: false,
  };
}

export async function getPlaceDataSignals(
  groupId: string,
  targets: PlaceDataSignalTarget[],
): Promise<PlaceDataSignal[]> {
  if (targets.length === 0) return [];
  return rpcClient.call(
    "get_place_data_signals_v1",
    {
      _group_id: groupId,
      _targets: targets.slice(0, 100).map((target) => ({
        key: target.key,
        placeId: target.placeId ?? null,
        provider: target.provider ?? null,
        providerPlaceId: target.providerPlaceId ?? null,
        hasWebsite: target.hasWebsite,
        hasOpeningHours: target.hasOpeningHours,
      })),
    },
    signalListSchema,
    "Servern returnerade ett oväntat signalformat.",
  );
}

export async function confirmPlaceDataSignal(
  groupId: string,
  target: Pick<PlaceDataSignalTarget, "placeId" | "provider" | "providerPlaceId">,
  verdict: PlaceDataSignalVerdict,
): Promise<void> {
  await rpcClient.callVoid("confirm_place_data_signal_v1", {
    _group_id: groupId,
    _place_id: target.placeId ?? null,
    _provider: target.provider ?? null,
    _provider_place_id: target.providerPlaceId ?? null,
    _verdict: verdict,
  });
}
