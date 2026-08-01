import { z } from "zod";

import type { PlaceSuggestion } from "./places-provider";
import { rpcClient } from "./rpc-client";

export type LocalSourceLinkStorage = "local" | "session";

export interface LocalManualSourceLink {
  groupId: string;
  placeId: string;
  provider: string;
  providerPlaceId: string;
  linkedAt: string;
}

const LOCAL_STORAGE_PREFIX = "matrundan.manual-place-source-links.v1";
const localSourceLinkSchema = z.object({
  groupId: z.string().min(1),
  placeId: z.string().min(1),
  provider: z.string().min(1),
  providerPlaceId: z.string().min(1),
  linkedAt: z.string(),
});
const localSourceLinksSchema = z.array(localSourceLinkSchema);

function storageFor(kind: LocalSourceLinkStorage): Storage | null {
  if (typeof window === "undefined") return null;
  return kind === "session" ? window.sessionStorage : window.localStorage;
}

function storageKey(groupId: string): string {
  return `${LOCAL_STORAGE_PREFIX}.${groupId}`;
}

function parseRawProviderData(raw: string | undefined): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return {};
  }
}

export function listLocalManualSourceLinks(
  groupId: string,
  storageKind: LocalSourceLinkStorage,
): LocalManualSourceLink[] {
  const storage = storageFor(storageKind);
  if (!storage) return [];
  try {
    const parsed = localSourceLinksSchema.safeParse(
      JSON.parse(storage.getItem(storageKey(groupId)) ?? "[]"),
    );
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function hasLocalManualSourceLink(
  links: LocalManualSourceLink[],
  suggestion: PlaceSuggestion,
): boolean {
  const provider = (suggestion.provider ?? "geoapify").trim().toLocaleLowerCase("en-US");
  return links.some(
    (link) => link.provider === provider && link.providerPlaceId === suggestion.externalId.trim(),
  );
}

export function linkLocalManualSource(
  groupId: string,
  placeId: string,
  suggestion: PlaceSuggestion,
  storageKind: LocalSourceLinkStorage,
): void {
  const storage = storageFor(storageKind);
  if (!storage) throw new Error("Lokal lagring är inte tillgänglig.");
  const current = listLocalManualSourceLinks(groupId, storageKind);
  const provider = (suggestion.provider ?? "geoapify").trim().toLocaleLowerCase("en-US");
  const providerPlaceId = suggestion.externalId.trim();
  if (!providerPlaceId) throw new Error("Sökträffen saknar en stabil källidentitet.");

  const next = [
    ...current.filter(
      (link) => !(link.provider === provider && link.providerPlaceId === providerPlaceId),
    ),
    {
      groupId,
      placeId,
      provider,
      providerPlaceId,
      linkedAt: new Date().toISOString(),
    },
  ];
  storage.setItem(storageKey(groupId), JSON.stringify(next));
  window.dispatchEvent(new Event("matrundan:manual-place-source-links-changed"));
}

export async function linkLiveProviderSourceToManualPlace(
  groupId: string,
  placeId: string,
  suggestion: PlaceSuggestion,
): Promise<string> {
  if (!Number.isFinite(suggestion.lat) || !Number.isFinite(suggestion.lng)) {
    throw new Error("Sökträffen saknar en verifierad kartposition.");
  }

  return rpcClient.call(
    "link_provider_source_to_existing_place_v1",
    {
      _group_id: groupId,
      _place_id: placeId,
      _provider: suggestion.provider ?? "geoapify",
      _provider_place_id: suggestion.externalId,
      _name: suggestion.name,
      _address: suggestion.address ?? "",
      _city: suggestion.city ?? "",
      _lat: suggestion.lat,
      _lng: suggestion.lng,
      _raw: parseRawProviderData(suggestion.raw),
    },
    z.string().uuid(),
    "Servern kunde inte bekräfta källkopplingen.",
  );
}
