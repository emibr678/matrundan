import { z } from "zod";

import { rpcClient } from "./rpc-client";
import type { Member, Place } from "./types";

export const PLACE_DATA_REPORT_CATEGORIES = [
  "closed_or_replaced",
  "wrong_name",
  "wrong_address",
  "wrong_website",
  "duplicate",
  "other",
] as const;

export type PlaceDataReportCategory = (typeof PLACE_DATA_REPORT_CATEGORIES)[number];
export type PlaceDataReportStatus = "open" | "ready_for_osm" | "resolved" | "dismissed";
export type LocalReportStorage = "local" | "session";

export const PLACE_DATA_REPORT_CATEGORY_LABEL: Record<PlaceDataReportCategory, string> = {
  closed_or_replaced: "Stängt eller ersatt",
  wrong_name: "Fel namn",
  wrong_address: "Fel adress eller kartposition",
  wrong_website: "Fel webbplats",
  duplicate: "Dubblett",
  other: "Annat platsdatafel",
};

export const PLACE_DATA_REPORT_STATUS_LABEL: Record<PlaceDataReportStatus, string> = {
  open: "Väntar på granskning",
  ready_for_osm: "Förberedd för OpenStreetMap",
  resolved: "Åtgärdad i Matrundan",
  dismissed: "Avslutad utan åtgärd",
};

export interface PlaceDataReportSource {
  provider: string;
  providerPlaceId: string;
  status: "active" | "superseded";
}

export interface PlaceDataReport {
  id: string;
  groupId: string;
  placeId: string;
  placeName: string;
  placeAddress: string;
  placeCity: string;
  placeWebsite: string | null;
  category: PlaceDataReportCategory;
  description: string;
  status: PlaceDataReportStatus;
  reporterId: string;
  reporterName: string;
  createdAt: string;
  updatedAt: string;
  reviewedBy: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  resolutionNote: string | null;
  sources: PlaceDataReportSource[];
}

export interface CreatePlaceDataReportInput {
  category: PlaceDataReportCategory;
  description: string;
}

export interface ReviewPlaceDataReportInput {
  status: PlaceDataReportStatus;
  resolutionNote: string | null;
}

const sourceSchema = z.object({
  provider: z.string().min(1),
  providerPlaceId: z.string().min(1),
  status: z.enum(["active", "superseded"]),
});

const reportSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  placeId: z.string().uuid(),
  placeName: z.string(),
  placeAddress: z.string(),
  placeCity: z.string(),
  placeWebsite: z.string().nullable(),
  category: z.enum(PLACE_DATA_REPORT_CATEGORIES),
  description: z.string(),
  status: z.enum(["open", "ready_for_osm", "resolved", "dismissed"]),
  reporterId: z.string(),
  reporterName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  reviewedBy: z.string().nullable(),
  reviewerName: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  resolutionNote: z.string().nullable(),
  sources: z.array(sourceSchema),
});

const reportListSchema = z.array(reportSchema);
const createResultSchema = z.object({ id: z.string().uuid(), created: z.boolean() });

const LOCAL_STORAGE_PREFIX = "matrundan.place-data-reports.v1";
const ACTIVE_STATUSES = new Set<PlaceDataReportStatus>(["open", "ready_for_osm"]);

export function normalizePlaceDataReportDescription(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 10) {
    throw new Error("Beskriv felet med minst 10 tecken.");
  }
  if (normalized.length > 1000) {
    throw new Error("Beskrivningen får vara högst 1000 tecken.");
  }
  return normalized;
}

export function normalizePlaceDataResolutionNote(value: string | null): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ") ?? "";
  if (!normalized) return null;
  if (normalized.length > 1000) {
    throw new Error("Anteckningen får vara högst 1000 tecken.");
  }
  return normalized;
}

export async function createGroupPlaceDataReport(
  groupId: string,
  placeId: string,
  input: CreatePlaceDataReportInput,
): Promise<{ id: string; created: boolean }> {
  return rpcClient.call(
    "create_place_data_report_v1",
    {
      _group_id: groupId,
      _place_id: placeId,
      _category: input.category,
      _description: normalizePlaceDataReportDescription(input.description),
    },
    createResultSchema,
    "Servern kunde inte bekräfta platsdatarapporten.",
  );
}

export async function listGroupPlaceDataReports(groupId: string): Promise<PlaceDataReport[]> {
  return rpcClient.call(
    "list_group_place_data_reports_v1",
    { _group_id: groupId },
    reportListSchema,
    "Servern returnerade ett oväntat rapportformat.",
  );
}

export async function reviewGroupPlaceDataReport(
  groupId: string,
  reportId: string,
  input: ReviewPlaceDataReportInput,
): Promise<void> {
  await rpcClient.callVoid("review_place_data_report_v1", {
    _group_id: groupId,
    _report_id: reportId,
    _status: input.status,
    _resolution_note: normalizePlaceDataResolutionNote(input.resolutionNote),
  });
}

function storageFor(kind: LocalReportStorage): Storage | null {
  if (typeof window === "undefined") return null;
  return kind === "session" ? window.sessionStorage : window.localStorage;
}

function storageKey(groupId: string): string {
  return `${LOCAL_STORAGE_PREFIX}.${groupId}`;
}

export function listLocalPlaceDataReports(
  groupId: string,
  storageKind: LocalReportStorage,
): PlaceDataReport[] {
  const storage = storageFor(storageKind);
  if (!storage) return [];
  try {
    const raw = storage.getItem(storageKey(groupId));
    if (!raw) return [];
    const parsed = reportListSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function saveLocalPlaceDataReports(
  groupId: string,
  storageKind: LocalReportStorage,
  reports: PlaceDataReport[],
): void {
  storageFor(storageKind)?.setItem(storageKey(groupId), JSON.stringify(reports));
}

function localId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "00000000-0000-4000-8000-" + Math.random().toString(16).slice(2).padEnd(12, "0").slice(0, 12);
}

export function createLocalPlaceDataReport(
  groupId: string,
  place: Place,
  reporter: Member,
  input: CreatePlaceDataReportInput,
  storageKind: LocalReportStorage,
): { id: string; created: boolean } {
  const current = listLocalPlaceDataReports(groupId, storageKind);
  const existing = current.find(
    (report) =>
      report.placeId === place.id &&
      report.reporterId === reporter.id &&
      report.category === input.category &&
      ACTIVE_STATUSES.has(report.status),
  );
  if (existing) return { id: existing.id, created: false };

  const now = new Date().toISOString();
  const report: PlaceDataReport = {
    id: localId(),
    groupId,
    placeId: place.id,
    placeName: place.name,
    placeAddress: place.address,
    placeCity: place.city,
    placeWebsite: place.website ?? null,
    category: input.category,
    description: normalizePlaceDataReportDescription(input.description),
    status: "open",
    reporterId: reporter.id,
    reporterName: reporter.name,
    createdAt: now,
    updatedAt: now,
    reviewedBy: null,
    reviewerName: null,
    reviewedAt: null,
    resolutionNote: null,
    sources: (place.sources ?? []).map((source) => ({
      provider: source.provider,
      providerPlaceId: source.providerPlaceId,
      status: source.status,
    })),
  };
  saveLocalPlaceDataReports(groupId, storageKind, [report, ...current]);
  return { id: report.id, created: true };
}

export function reviewLocalPlaceDataReport(
  groupId: string,
  reportId: string,
  reviewer: Member,
  input: ReviewPlaceDataReportInput,
  storageKind: LocalReportStorage,
): void {
  const now = new Date().toISOString();
  const reports = listLocalPlaceDataReports(groupId, storageKind);
  const next = reports.map((report) =>
    report.id === reportId
      ? {
          ...report,
          status: input.status,
          resolutionNote: normalizePlaceDataResolutionNote(input.resolutionNote),
          reviewedBy: reviewer.id,
          reviewerName: reviewer.name,
          reviewedAt: now,
          updatedAt: now,
        }
      : report,
  );
  saveLocalPlaceDataReports(groupId, storageKind, next);
}
