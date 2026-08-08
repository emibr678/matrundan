import { z } from "zod";

import { isOpeningHoursSchedule, type OpeningHoursSchedule } from "./opening-hours";
import { normalizeWebsiteUrl } from "./place-links";
import { rpcClient } from "./rpc-client";

export interface GroupPlacePracticalInfo {
  websiteOverride: string | null;
  openingHoursOverride: OpeningHoursSchedule | null;
  sourceUrl: string | null;
  sourceNote: string | null;
  updatedBy: string | null;
  updatedByName: string | null;
  updatedAt: string | null;
}

export interface GroupPlacePracticalInfoHistoryEntry {
  id: string;
  websiteOverride: string | null;
  openingHoursOverride: OpeningHoursSchedule | null;
  sourceUrl: string | null;
  sourceNote: string | null;
  changedByName: string;
  changedAt: string;
}

export interface UpdateGroupPlacePracticalInfoInput {
  websiteOverride: string | null;
  openingHoursOverride: OpeningHoursSchedule | null;
  sourceUrl: string | null;
  sourceNote: string | null;
}

export type CrossGroupPracticalInfoSuggestionStatus = "none" | "available" | "conflicting";
export type CrossGroupPracticalInfoField = "website" | "opening_hours";

export interface CrossGroupWebsiteSuggestion {
  status: CrossGroupPracticalInfoSuggestionStatus;
  fingerprint: string | null;
  website: string | null;
  changedAt: string | null;
}

export interface CrossGroupOpeningHoursSuggestion {
  status: CrossGroupPracticalInfoSuggestionStatus;
  fingerprint: string | null;
  openingHours: OpeningHoursSchedule | null;
  changedAt: string | null;
}

export interface CrossGroupPracticalInfoSuggestions {
  website: CrossGroupWebsiteSuggestion;
  openingHours: CrossGroupOpeningHoursSuggestion;
}

const openingHoursSchema = z.custom<OpeningHoursSchedule>(isOpeningHoursSchedule);
const practicalInfoSchema = z.object({
  websiteOverride: z.string().nullable().default(null),
  openingHoursOverride: openingHoursSchema.nullable().default(null),
  sourceUrl: z.string().nullable().default(null),
  sourceNote: z.string().nullable().default(null),
  updatedBy: z.string().nullable().default(null),
  updatedByName: z.string().nullable().default(null),
  updatedAt: z.string().nullable().default(null),
});
const historySchema = z.array(
  z.object({
    id: z.string().uuid(),
    websiteOverride: z.string().nullable().default(null),
    openingHoursOverride: openingHoursSchema.nullable().default(null),
    sourceUrl: z.string().nullable().default(null),
    sourceNote: z.string().nullable().default(null),
    changedByName: z.string(),
    changedAt: z.string(),
  }),
);
const suggestionStatusSchema = z.enum(["none", "available", "conflicting"]);
const crossGroupSuggestionsSchema = z.object({
  website: z.object({
    status: suggestionStatusSchema,
    fingerprint: z
      .string()
      .regex(/^[0-9a-f]{32}$/)
      .nullable()
      .default(null),
    website: z.string().nullable().default(null),
    changedAt: z.string().nullable().default(null),
  }),
  openingHours: z.object({
    status: suggestionStatusSchema,
    fingerprint: z
      .string()
      .regex(/^[0-9a-f]{32}$/)
      .nullable()
      .default(null),
    openingHours: openingHoursSchema.nullable().default(null),
    changedAt: z.string().nullable().default(null),
  }),
});

const LOCAL_PREFIX = "matrundan.group-place-practical-info.v1";
const LOCAL_HISTORY_PREFIX = "matrundan.group-place-practical-info-history.v1";

function storage(kind: "local" | "session"): Storage | null {
  if (typeof window === "undefined") return null;
  return kind === "session" ? window.sessionStorage : window.localStorage;
}

function localKey(groupId: string, placeId: string): string {
  return `${LOCAL_PREFIX}.${groupId}.${placeId}`;
}

function localHistoryKey(groupId: string, placeId: string): string {
  return `${LOCAL_HISTORY_PREFIX}.${groupId}.${placeId}`;
}

export function normalizeGroupPlacePracticalInfoUpdate(
  input: UpdateGroupPlacePracticalInfoInput,
): UpdateGroupPlacePracticalInfoInput {
  const websiteOverride = normalizeWebsiteUrl(input.websiteOverride) ?? null;
  const sourceNote = input.sourceNote?.trim() || null;
  const hasExplicitSourceUrl = Boolean(input.sourceUrl?.trim());
  const normalizedExplicitSourceUrl = normalizeWebsiteUrl(input.sourceUrl) ?? null;
  const sourceUrl =
    normalizedExplicitSourceUrl ??
    (!hasExplicitSourceUrl && !sourceNote && websiteOverride ? websiteOverride : null);

  return {
    websiteOverride,
    openingHoursOverride: input.openingHoursOverride,
    sourceUrl,
    sourceNote,
  };
}

export function emptyGroupPlacePracticalInfo(): GroupPlacePracticalInfo {
  return {
    websiteOverride: null,
    openingHoursOverride: null,
    sourceUrl: null,
    sourceNote: null,
    updatedBy: null,
    updatedByName: null,
    updatedAt: null,
  };
}

export function emptyCrossGroupPracticalInfoSuggestions(): CrossGroupPracticalInfoSuggestions {
  return {
    website: {
      status: "none",
      fingerprint: null,
      website: null,
      changedAt: null,
    },
    openingHours: {
      status: "none",
      fingerprint: null,
      openingHours: null,
      changedAt: null,
    },
  };
}

export async function getGroupPlacePracticalInfo(
  groupId: string,
  placeId: string,
): Promise<GroupPlacePracticalInfo> {
  return rpcClient.call(
    "get_group_place_practical_info_v1",
    { _group_id: groupId, _place_id: placeId },
    practicalInfoSchema,
    "Servern returnerade ett oväntat format för gruppens platsinformation.",
  );
}

export async function updateGroupPlacePracticalInfo(
  groupId: string,
  placeId: string,
  input: UpdateGroupPlacePracticalInfoInput,
): Promise<void> {
  const normalized = normalizeGroupPlacePracticalInfoUpdate(input);
  await rpcClient.callVoid("update_group_place_practical_info_v1", {
    _group_id: groupId,
    _place_id: placeId,
    _website_override: normalized.websiteOverride,
    _opening_hours_override: normalized.openingHoursOverride,
    _source_url: normalized.sourceUrl,
    _source_note: normalized.sourceNote,
  });
}

export async function listGroupPlacePracticalInfoHistory(
  groupId: string,
  placeId: string,
  limit = 5,
): Promise<GroupPlacePracticalInfoHistoryEntry[]> {
  return rpcClient.call(
    "list_group_place_practical_info_history_v1",
    { _group_id: groupId, _place_id: placeId, _limit: limit },
    historySchema,
    "Servern returnerade ett oväntat format för ändringshistoriken.",
  );
}

export async function getCrossGroupPracticalInfoSuggestions(
  groupId: string,
  placeId: string,
): Promise<CrossGroupPracticalInfoSuggestions> {
  return rpcClient.call(
    "get_cross_group_practical_info_suggestions_v1",
    { _group_id: groupId, _place_id: placeId },
    crossGroupSuggestionsSchema,
    "Servern returnerade ett oväntat format för anonyma platsförslag.",
  );
}

export async function applyCrossGroupPracticalInfoSuggestion(
  groupId: string,
  placeId: string,
  field: CrossGroupPracticalInfoField,
  fingerprint: string,
): Promise<void> {
  await rpcClient.callVoid("apply_cross_group_practical_info_suggestion_v1", {
    _group_id: groupId,
    _place_id: placeId,
    _field: field,
    _fingerprint: fingerprint,
  });
}

export function getLocalGroupPlacePracticalInfo(
  groupId: string,
  placeId: string,
  kind: "local" | "session",
): GroupPlacePracticalInfo {
  try {
    const raw = storage(kind)?.getItem(localKey(groupId, placeId));
    if (!raw) return emptyGroupPlacePracticalInfo();
    const parsed = practicalInfoSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyGroupPlacePracticalInfo();
  } catch {
    return emptyGroupPlacePracticalInfo();
  }
}

export function updateLocalGroupPlacePracticalInfo(
  groupId: string,
  placeId: string,
  input: UpdateGroupPlacePracticalInfoInput,
  actor: { id: string; name: string },
  kind: "local" | "session",
): GroupPlacePracticalInfo {
  const normalized = normalizeGroupPlacePracticalInfoUpdate(input);
  const next: GroupPlacePracticalInfo = {
    websiteOverride: normalized.websiteOverride,
    openingHoursOverride: normalized.openingHoursOverride,
    sourceUrl: normalized.sourceUrl,
    sourceNote: normalized.sourceNote,
    updatedBy: actor.id,
    updatedByName: actor.name,
    updatedAt: new Date().toISOString(),
  };
  storage(kind)?.setItem(localKey(groupId, placeId), JSON.stringify(next));

  const history = listLocalGroupPlacePracticalInfoHistory(groupId, placeId, kind);
  const entry: GroupPlacePracticalInfoHistoryEntry = {
    id: crypto.randomUUID(),
    websiteOverride: next.websiteOverride,
    openingHoursOverride: next.openingHoursOverride,
    sourceUrl: next.sourceUrl,
    sourceNote: next.sourceNote,
    changedByName: actor.name,
    changedAt: next.updatedAt!,
  };
  storage(kind)?.setItem(
    localHistoryKey(groupId, placeId),
    JSON.stringify([entry, ...history].slice(0, 20)),
  );
  window.dispatchEvent(new Event("matrundan:practical-info-changed"));
  return next;
}

export function listLocalGroupPlacePracticalInfoHistory(
  groupId: string,
  placeId: string,
  kind: "local" | "session",
): GroupPlacePracticalInfoHistoryEntry[] {
  try {
    const raw = storage(kind)?.getItem(localHistoryKey(groupId, placeId));
    if (!raw) return [];
    const parsed = historySchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}
