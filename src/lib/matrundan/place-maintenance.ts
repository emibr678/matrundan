import { z } from "zod";

import { rpcClient } from "./rpc-client";
import type { PlaceCategory } from "./types";

export const PLACE_MAINTENANCE_STATUSES = ["open", "needs_osm", "resolved", "dismissed"] as const;
export type PlaceMaintenanceStatus = (typeof PLACE_MAINTENANCE_STATUSES)[number];

export const PLACE_MAINTENANCE_KINDS = ["improvement_candidate", "reported_error"] as const;
export type PlaceMaintenanceKind = (typeof PLACE_MAINTENANCE_KINDS)[number];

export const PLACE_MAINTENANCE_TARGET_KINDS = ["canonical_place", "provider_suggestion"] as const;
export type PlaceMaintenanceTargetKind = (typeof PLACE_MAINTENANCE_TARGET_KINDS)[number];

export const PLACE_MAINTENANCE_ISSUE_CATEGORIES = [
  "unmatched_verified_manual",
  "missing_in_osm",
  "closed_or_replaced",
  "wrong_name",
  "wrong_address",
  "wrong_website",
  "wrong_opening_hours",
  "duplicate",
  "other",
] as const;
export type PlaceMaintenanceIssueCategory = (typeof PLACE_MAINTENANCE_ISSUE_CATEGORIES)[number];

export const PLACE_MAINTENANCE_DISMISSAL_REASONS = [
  "not_relevant",
  "insufficient_evidence",
  "not_food_place",
  "already_handled",
] as const;
export type PlaceMaintenanceDismissalReason = (typeof PLACE_MAINTENANCE_DISMISSAL_REASONS)[number];

const categorySchema = z.enum(["restaurang", "café", "bageri", "snabbmat", "pub", "matvagn"]);
const statusSchema = z.enum(PLACE_MAINTENANCE_STATUSES);
const kindSchema = z.enum(PLACE_MAINTENANCE_KINDS);
const targetKindSchema = z.enum(PLACE_MAINTENANCE_TARGET_KINDS);
const issueCategorySchema = z.enum(PLACE_MAINTENANCE_ISSUE_CATEGORIES);
const dismissalReasonSchema = z.enum(PLACE_MAINTENANCE_DISMISSAL_REASONS);

const sourceSchema = z.object({
  provider: z.string().min(1),
  providerPlaceId: z.string().min(1),
});

const osmNoteSchema = z.object({
  submissionState: z.string().nullable(),
  url: z.string().nullable(),
  status: z.string().nullable(),
});

const workItemSchema = z.object({
  workItemId: z.string().uuid(),
  kind: kindSchema,
  targetKind: targetKindSchema,
  placeId: z.string().uuid().nullable(),
  issueCategory: issueCategorySchema,
  status: statusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().nullable(),
  dismissalReason: dismissalReasonSchema.nullable(),
  name: z.string().min(1),
  category: categorySchema.nullable(),
  address: z.string(),
  area: z.string().nullable(),
  city: z.string(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  website: z.string().nullable(),
  activeSource: sourceSchema.nullable(),
  externalReference: sourceSchema.nullable(),
  osmNote: osmNoteSchema.nullable(),
});

const pageSchema = z.object({
  items: z.array(workItemSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export interface PlaceMaintenanceWorkItem {
  workItemId: string;
  kind: PlaceMaintenanceKind;
  targetKind: PlaceMaintenanceTargetKind;
  placeId: string | null;
  issueCategory: PlaceMaintenanceIssueCategory;
  status: PlaceMaintenanceStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  dismissalReason: PlaceMaintenanceDismissalReason | null;
  name: string;
  category: PlaceCategory | null;
  address: string;
  area: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
  website: string | null;
  activeSource: { provider: string; providerPlaceId: string } | null;
  externalReference: { provider: string; providerPlaceId: string } | null;
  osmNote: { submissionState: string | null; url: string | null; status: string | null } | null;
}

export interface PlaceMaintenancePage {
  items: PlaceMaintenanceWorkItem[];
  total: number;
  limit: number;
  offset: number;
}

export async function getPlaceMaintenanceAccess(): Promise<boolean> {
  return rpcClient.call(
    "get_place_maintenance_access_v1",
    {},
    z.boolean(),
    "Kunde inte kontrollera behörighet till Platsunderhåll.",
  );
}

export async function listPlaceMaintenanceWorkItems(input?: {
  status?: PlaceMaintenanceStatus | null;
  kind?: PlaceMaintenanceKind | null;
  limit?: number;
  offset?: number;
}): Promise<PlaceMaintenancePage> {
  return rpcClient.call(
    "list_place_maintenance_work_items_v1",
    {
      _status: input?.status ?? null,
      _kind: input?.kind ?? null,
      _limit: input?.limit ?? 50,
      _offset: input?.offset ?? 0,
    },
    pageSchema,
    "Kunde inte läsa underhållskön.",
  );
}

export async function markPlaceMaintenanceWorkItemNeedsOsm(
  kind: PlaceMaintenanceKind,
  workItemId: string,
): Promise<void> {
  await rpcClient.call(
    "mark_place_maintenance_work_item_needs_osm_v1",
    { _kind: kind, _work_item_id: workItemId },
    z.literal("needs_osm"),
    "Kunde inte markera ärendet för OSM-åtgärd.",
  );
}

export async function dismissPlaceMaintenanceWorkItem(
  kind: PlaceMaintenanceKind,
  workItemId: string,
  reason: PlaceMaintenanceDismissalReason,
): Promise<void> {
  await rpcClient.call(
    "dismiss_place_maintenance_work_item_v1",
    { _kind: kind, _work_item_id: workItemId, _reason: reason },
    z.literal("dismissed"),
    "Kunde inte avfärda underhållsärendet.",
  );
}

export async function resolvePlaceMaintenanceWorkItem(
  kind: PlaceMaintenanceKind,
  workItemId: string,
): Promise<void> {
  await rpcClient.call(
    "resolve_place_maintenance_work_item_v1",
    { _kind: kind, _work_item_id: workItemId },
    z.literal("resolved"),
    "Kunde inte markera underhållsärendet som klart.",
  );
}

export const PLACE_MAINTENANCE_KIND_LABEL: Record<PlaceMaintenanceKind, string> = {
  improvement_candidate: "Saknar extern källa",
  reported_error: "Rapporterat fel",
};

export const PLACE_MAINTENANCE_ISSUE_LABEL: Record<PlaceMaintenanceIssueCategory, string> = {
  unmatched_verified_manual: "Saknar extern källa",
  missing_in_osm: "Saknas i OpenStreetMap",
  closed_or_replaced: "Kan ha stängt eller ersatts",
  wrong_name: "Fel namn",
  wrong_address: "Fel adress eller kartposition",
  wrong_website: "Fel webbplats",
  wrong_opening_hours: "Fel öppettider",
  duplicate: "Möjlig dubblett",
  other: "Annat platsdatafel",
};

export const PLACE_MAINTENANCE_DISMISSAL_LABEL: Record<PlaceMaintenanceDismissalReason, string> = {
  not_relevant: "Inte relevant",
  insufficient_evidence: "Otillräckligt underlag",
  not_food_place: "Inte ett matställe",
  already_handled: "Redan hanterat",
};
