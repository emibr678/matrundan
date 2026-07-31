import { supabase } from "@/integrations/supabase/client";
import type { PlaceSuggestion } from "./places-provider";

export interface HiddenPlaceSuggestion {
  provider: string;
  providerPlaceId: string;
  name: string;
  address: string;
  city: string;
  hiddenAt?: string;
}

const DEMO_STORAGE_PREFIX = "matrundan.hidden-place-suggestions.v1";

function toError(error: unknown): Error {
  const message =
    (error as { message?: string } | null)?.message ??
    "Kunde inte uppdatera gruppens dolda sökträffar.";
  return new Error(message);
}

function normalizeProvider(value: string | undefined): string {
  return value?.trim().toLocaleLowerCase("en-US") || "unknown";
}

export function hiddenPlaceSuggestionKey(
  suggestion: Pick<PlaceSuggestion, "provider" | "externalId">,
): string {
  return `${normalizeProvider(suggestion.provider)}:${suggestion.externalId.trim()}`;
}

export function hiddenPlaceRecordKey(
  record: Pick<HiddenPlaceSuggestion, "provider" | "providerPlaceId">,
): string {
  return `${normalizeProvider(record.provider)}:${record.providerPlaceId.trim()}`;
}

export function hiddenPlaceSuggestionFromSearch(
  suggestion: PlaceSuggestion,
): HiddenPlaceSuggestion {
  return {
    provider: normalizeProvider(suggestion.provider),
    providerPlaceId: suggestion.externalId.trim(),
    name: suggestion.name.trim(),
    address: suggestion.address.trim(),
    city: suggestion.city.trim(),
  };
}

export async function listGroupHiddenPlaceSuggestions(
  groupId: string,
): Promise<HiddenPlaceSuggestion[]> {
  const { data, error } = await supabase.rpc(
    "list_group_hidden_place_suggestions" as never,
    { _group_id: groupId } as never,
  );
  if (error) throw toError(error);
  return (
    (data ?? []) as unknown as Array<{
      provider: string;
      provider_place_id: string;
      name: string;
      address: string;
      city: string;
      hidden_at: string;
    }>
  ).map((row) => ({
    provider: row.provider,
    providerPlaceId: row.provider_place_id,
    name: row.name,
    address: row.address,
    city: row.city,
    hiddenAt: row.hidden_at,
  }));
}

export async function hideGroupPlaceSuggestion(
  groupId: string,
  suggestion: PlaceSuggestion,
): Promise<void> {
  const record = hiddenPlaceSuggestionFromSearch(suggestion);
  const { error } = await supabase.rpc(
    "hide_group_place_suggestion" as never,
    {
      _group_id: groupId,
      _provider: record.provider,
      _provider_place_id: record.providerPlaceId,
      _name: record.name,
      _address: record.address,
      _city: record.city,
    } as never,
  );
  if (error) throw toError(error);
}

export async function restoreGroupPlaceSuggestion(
  groupId: string,
  record: Pick<HiddenPlaceSuggestion, "provider" | "providerPlaceId">,
): Promise<void> {
  const { error } = await supabase.rpc(
    "restore_group_place_suggestion" as never,
    {
      _group_id: groupId,
      _provider: normalizeProvider(record.provider),
      _provider_place_id: record.providerPlaceId,
    } as never,
  );
  if (error) throw toError(error);
}

function demoStorageKey(groupId: string): string {
  return `${DEMO_STORAGE_PREFIX}.${groupId}`;
}

export function listDemoHiddenPlaceSuggestions(groupId: string): HiddenPlaceSuggestion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(demoStorageKey(groupId));
    if (!raw) return [];
    const rows = JSON.parse(raw) as HiddenPlaceSuggestion[];
    return Array.isArray(rows)
      ? rows.filter(
          (row) =>
            typeof row?.provider === "string" &&
            typeof row?.providerPlaceId === "string" &&
            typeof row?.name === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function saveDemoHiddenPlaceSuggestions(groupId: string, rows: HiddenPlaceSuggestion[]): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(demoStorageKey(groupId), JSON.stringify(rows));
}

export function hideDemoPlaceSuggestion(groupId: string, suggestion: PlaceSuggestion): void {
  const record = {
    ...hiddenPlaceSuggestionFromSearch(suggestion),
    hiddenAt: new Date().toISOString(),
  };
  const key = hiddenPlaceRecordKey(record);
  const current = listDemoHiddenPlaceSuggestions(groupId).filter(
    (item) => hiddenPlaceRecordKey(item) !== key,
  );
  saveDemoHiddenPlaceSuggestions(groupId, [record, ...current]);
}

export function restoreDemoPlaceSuggestion(
  groupId: string,
  record: Pick<HiddenPlaceSuggestion, "provider" | "providerPlaceId">,
): void {
  const key = hiddenPlaceRecordKey(record);
  saveDemoHiddenPlaceSuggestions(
    groupId,
    listDemoHiddenPlaceSuggestions(groupId).filter((item) => hiddenPlaceRecordKey(item) !== key),
  );
}
