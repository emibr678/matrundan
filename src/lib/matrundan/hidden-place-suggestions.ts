import { supabase } from "@/integrations/supabase/client";
import { normalizeWebsiteUrl } from "./place-links";
import type { PlaceSuggestion } from "./places-provider";
import type { PlaceCategory } from "./types";

export interface HiddenPlaceSuggestion {
  provider: string;
  providerPlaceId: string;
  name: string;
  category?: PlaceCategory | null;
  address: string;
  area?: string | null;
  city: string;
  lat?: number | null;
  lng?: number | null;
  website?: string | null;
  hiddenAt?: string;
}

const DEMO_STORAGE_PREFIX = "matrundan.hidden-place-suggestions.v2";
const LEGACY_DEMO_STORAGE_PREFIX = "matrundan.hidden-place-suggestions.v1";

function toError(error: unknown): Error {
  const message =
    (error as { message?: string } | null)?.message ??
    "Kunde inte uppdatera gruppens dolda sökträffar.";
  return new Error(message);
}

function normalizeProvider(value: string | undefined): string {
  return value?.trim().toLocaleLowerCase("en-US") || "unknown";
}

function rpcIsMissing(error: unknown, functionName: string): boolean {
  const message = (error as { message?: string } | null)?.message ?? "";
  return (
    /could not find the function|schema cache/i.test(message) &&
    message.toLocaleLowerCase("en-US").includes(functionName.toLocaleLowerCase("en-US"))
  );
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
    category: suggestion.category,
    address: suggestion.address.trim(),
    area: suggestion.area?.trim() || null,
    city: suggestion.city.trim(),
    lat: Number.isFinite(suggestion.lat) ? suggestion.lat : null,
    lng: Number.isFinite(suggestion.lng) ? suggestion.lng : null,
    website: normalizeWebsiteUrl(suggestion.website) ?? null,
  };
}

function mapLegacyRows(data: unknown): HiddenPlaceSuggestion[] {
  return (
    (data ?? []) as Array<{
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
    category: null,
    address: row.address,
    area: null,
    city: row.city,
    lat: null,
    lng: null,
    website: null,
    hiddenAt: row.hidden_at,
  }));
}

export async function listGroupHiddenPlaceSuggestions(
  groupId: string,
): Promise<HiddenPlaceSuggestion[]> {
  const v2 = await supabase.rpc("list_group_hidden_place_suggestions_v2" as never, {
    _group_id: groupId,
  } as never);
  if (!v2.error) return (v2.data ?? []) as unknown as HiddenPlaceSuggestion[];
  if (!rpcIsMissing(v2.error, "list_group_hidden_place_suggestions_v2")) {
    throw toError(v2.error);
  }

  const legacy = await supabase.rpc("list_group_hidden_place_suggestions" as never, {
    _group_id: groupId,
  } as never);
  if (legacy.error) throw toError(legacy.error);
  return mapLegacyRows(legacy.data);
}

export async function hideGroupPlaceSuggestion(
  groupId: string,
  suggestion: PlaceSuggestion,
): Promise<void> {
  const record = hiddenPlaceSuggestionFromSearch(suggestion);
  const v2 = await supabase.rpc(
    "hide_group_place_suggestion_v2" as never,
    {
      _group_id: groupId,
      _provider: record.provider,
      _provider_place_id: record.providerPlaceId,
      _name: record.name,
      _category: record.category ?? null,
      _address: record.address,
      _area: record.area ?? null,
      _city: record.city,
      _lat: record.lat ?? null,
      _lng: record.lng ?? null,
      _website: record.website ?? null,
    } as never,
  );
  if (!v2.error) return;
  if (!rpcIsMissing(v2.error, "hide_group_place_suggestion_v2")) throw toError(v2.error);

  const legacy = await supabase.rpc(
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
  if (legacy.error) throw toError(legacy.error);
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

function legacyDemoStorageKey(groupId: string): string {
  return `${LEGACY_DEMO_STORAGE_PREFIX}.${groupId}`;
}

export function listDemoHiddenPlaceSuggestions(groupId: string): HiddenPlaceSuggestion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw =
      window.sessionStorage.getItem(demoStorageKey(groupId)) ??
      window.sessionStorage.getItem(legacyDemoStorageKey(groupId));
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
