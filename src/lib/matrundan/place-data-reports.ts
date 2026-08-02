import { z } from "zod";

import {
  normalizeOsmPublicText,
  OSM_NOTE_STATUSES,
  OSM_SUBMISSION_STATES,
  type OsmNoteStatus,
  type OsmSubmissionState,
} from "./osm-notes";
import { normalizeWebsiteUrl } from "./place-links";
import type { PlaceSuggestion } from "./places-provider";
import { rpcClient } from "./rpc-client";
import type { Member, Place, PlaceCategory } from "./types";

export const PLACE_DATA_REPORT_CATEGORIES = [
  "missing_in_osm",
  "closed_or_replaced",
  "wrong_name",
  "wrong_address",
  "wrong_website",
  "duplicate",
  "other",
] as const;

export const PLACE_SUGGESTION_REPORT_CATEGORIES = [
  "closed_or_replaced",
  "wrong_name",
  "wrong_address",
  "wrong_website",
  "duplicate",
  "other",
] as const;

export type PlaceDataReportCategory = (typeof PLACE_DATA_REPORT_CATEGORIES)[number];
export type PlaceDataReportStatus = "open" | "ready_for_osm" | "resolved" | "dismissed";
export type PlaceDataReportTargetKind = "place" | "suggestion";
export type LocalReportStorage = "local" | "session";

export const PLACE_DATA_REPORT_CATEGORY_LABEL: Record<PlaceDataReportCategory, string> = {
  missing_in_osm: "Saknas i OpenStreetMap",
  closed_or_replaced: "Kan ha stängt permanent eller ersatts",
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

export interface ReportablePlaceSuggestion {
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
}

export interface PlaceDataReport {
  id: string;
  groupId: string;
  targetKind: PlaceDataReportTargetKind;
  placeId: string | null;
  provider: string | null;
  providerPlaceId: string | null;
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
  osmSubmissionState: OsmSubmissionState;
  osmSubmissionErrorCode: string | null;
  osmPublicText: string | null;
  osmNoteId: string | null;
  osmNoteUrl: string | null;
  osmNoteStatus: OsmNoteStatus | null;
  osmNoteCreatedAt: string | null;
  osmNoteLastCheckedAt: string | null;
  osmNoteClosedAt: string | null;
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
  groupId: z.string().min(1),
  targetKind: z.enum(["place", "suggestion"]).default("place"),
  placeId: z.string().nullable().default(null),
  provider: z.string().nullable().default(null),
  providerPlaceId: z.string().nullable().default(null),
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
  osmSubmissionState: z.enum(OSM_SUBMISSION_STATES).default("not_submitted"),
  osmSubmissionErrorCode: z.string().nullable().default(null),
  osmPublicText: z.string().nullable().default(null),
  osmNoteId: z.string().nullable().default(null),
  osmNoteUrl: z.string().nullable().default(null),
  osmNoteStatus: z.enum(OSM_NOTE_STATUSES).nullable().default(null),
  osmNoteCreatedAt: z.string().nullable().default(null),
  osmNoteLastCheckedAt: z.string().nullable().default(null),
  osmNoteClosedAt: z.string().nullable().default(null),
});

const reportListSchema = z.array(reportSchema);
const createResultSchema = z.object({ id: z.string().uuid(), created: z.boolean() });

const LOCAL_STORAGE_PREFIX = "matrundan.place-data-reports.v2";
const LEGACY_LOCAL_STORAGE_PREFIX = "matrundan.place-data-reports.v1";
const ACTIVE_STATUSES = new Set<PlaceDataReportStatus>(["open", "ready_for_osm"]);

function shouldFallbackFromReportListV3(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return (
    /could not find the function|schema cache/i.test(message) &&
    message.toLocaleLowerCase("en-US").includes("list_group_place_data_reports_v3")
  );
}

function shouldFallbackToReportListV1(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return (
    /could not find the function|schema cache/i.test(message) &&
    message.toLocaleLowerCase("en-US").includes("list_group_place_data_reports_v2")
  );
}

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

export function reportableSuggestionFromPlaceSuggestion(
  suggestion: PlaceSuggestion,
): ReportablePlaceSuggestion {
  return {
    provider: suggestion.provider?.trim().toLocaleLowerCase("en-US") || "unknown",
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

export async function createGroupPlaceSuggestionReport(
  groupId: string,
  suggestion: ReportablePlaceSuggestion,
  input: CreatePlaceDataReportInput,
): Promise<{ id: string; created: boolean }> {
  return rpcClient.call(
    "create_place_data_report_from_suggestion_v1",
    {
      _group_id: groupId,
      _provider: suggestion.provider,
      _provider_place_id: suggestion.providerPlaceId,
      _name: suggestion.name,
      _address: suggestion.address,
      _city: suggestion.city,
      _website: normalizeWebsiteUrl(suggestion.website) ?? null,
      _lat: suggestion.lat ?? null,
      _lng: suggestion.lng ?? null,
      _category: input.category,
      _description: normalizePlaceDataReportDescription(input.description),
    },
    createResultSchema,
    "Servern kunde inte bekräfta rapporten om sökträffen.",
  );
}

async function listGroupPlaceDataReportsV2OrV1(groupId: string): Promise<PlaceDataReport[]> {
  try {
    return await rpcClient.call(
      "list_group_place_data_reports_v2",
      { _group_id: groupId },
      reportListSchema,
      "Servern returnerade ett oväntat rapportformat.",
    );
  } catch (error) {
    if (!shouldFallbackToReportListV1(error)) throw error;
    return rpcClient.call(
      "list_group_place_data_reports_v1",
      { _group_id: groupId },
      reportListSchema,
      "Servern returnerade ett oväntat rapportformat.",
    );
  }
}

export async function listGroupPlaceDataReports(groupId: string): Promise<PlaceDataReport[]> {
  try {
    return await rpcClient.call(
      "list_group_place_data_reports_v3",
      { _group_id: groupId },
      reportListSchema,
      "Servern returnerade ett oväntat rapportformat.",
    );
  } catch (error) {
    if (!shouldFallbackFromReportListV3(error)) throw error;
    return listGroupPlaceDataReportsV2OrV1(groupId);
  }
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

function legacyStorageKey(groupId: string): string {
  return `${LEGACY_LOCAL_STORAGE_PREFIX}.${groupId}`;
}

export function listLocalPlaceDataReports(
  groupId: string,
  storageKind: LocalReportStorage,
): PlaceDataReport[] {
  const storage = storageFor(storageKind);
  if (!storage) return [];
  try {
    const raw = storage.getItem(storageKey(groupId)) ?? storage.getItem(legacyStorageKey(groupId));
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
    : "00000000-0000-4000-8000-" +
        Math.random().toString(16).slice(2).padEnd(12, "0").slice(0, 12);
}

function baseLocalReport(input: {
  groupId: string;
  placeId: string | null;
  provider: string | null;
  providerPlaceId: string | null;
  placeName: string;
  placeAddress: string;
  placeCity: string;
  placeWebsite: string | null;
  sources: PlaceDataReportSource[];
  reporter: Member;
  reportInput: CreatePlaceDataReportInput;
}): PlaceDataReport {
  const now = new Date().toISOString();
  return {
    id: localId(),
    groupId: input.groupId,
    targetKind: input.placeId ? "place" : "suggestion",
    placeId: input.placeId,
    provider: input.provider,
    providerPlaceId: input.providerPlaceId,
    placeName: input.placeName,
    placeAddress: input.placeAddress,
    placeCity: input.placeCity,
    placeWebsite: input.placeWebsite,
    category: input.reportInput.category,
    description: normalizePlaceDataReportDescription(input.reportInput.description),
    status: "open",
    reporterId: input.reporter.id,
    reporterName: input.reporter.name,
    createdAt: now,
    updatedAt: now,
    reviewedBy: null,
    reviewerName: null,
    reviewedAt: null,
    resolutionNote: null,
    sources: input.sources,
    osmSubmissionState: "not_submitted",
    osmSubmissionErrorCode: null,
    osmPublicText: null,
    osmNoteId: null,
    osmNoteUrl: null,
    osmNoteStatus: null,
    osmNoteCreatedAt: null,
    osmNoteLastCheckedAt: null,
    osmNoteClosedAt: null,
  };
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

  const report = baseLocalReport({
    groupId,
    placeId: place.id,
    provider: null,
    providerPlaceId: null,
    placeName: place.name,
    placeAddress: place.address,
    placeCity: place.city,
    placeWebsite: place.website ?? null,
    sources: (place.sources ?? []).map((source) => ({
      provider: source.provider,
      providerPlaceId: source.providerPlaceId,
      status: source.status,
    })),
    reporter,
    reportInput: input,
  });
  saveLocalPlaceDataReports(groupId, storageKind, [report, ...current]);
  return { id: report.id, created: true };
}

export function createLocalPlaceSuggestionReport(
  groupId: string,
  suggestion: ReportablePlaceSuggestion,
  reporter: Member,
  input: CreatePlaceDataReportInput,
  storageKind: LocalReportStorage,
): { id: string; created: boolean } {
  const current = listLocalPlaceDataReports(groupId, storageKind);
  const existing = current.find(
    (report) =>
      report.targetKind === "suggestion" &&
      report.provider === suggestion.provider &&
      report.providerPlaceId === suggestion.providerPlaceId &&
      report.reporterId === reporter.id &&
      report.category === input.category &&
      ACTIVE_STATUSES.has(report.status),
  );
  if (existing) return { id: existing.id, created: false };

  const report = baseLocalReport({
    groupId,
    placeId: null,
    provider: suggestion.provider,
    providerPlaceId: suggestion.providerPlaceId,
    placeName: suggestion.name,
    placeAddress: suggestion.address,
    placeCity: suggestion.city,
    placeWebsite: normalizeWebsiteUrl(suggestion.website) ?? null,
    sources: [
      {
        provider: suggestion.provider,
        providerPlaceId: suggestion.providerPlaceId,
        status: "active",
      },
    ],
    reporter,
    reportInput: input,
  });
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

export function publishLocalOsmNote(
  groupId: string,
  reportId: string,
  publicText: string,
  storageKind: LocalReportStorage,
): void {
  const now = new Date().toISOString();
  const reports = listLocalPlaceDataReports(groupId, storageKind);
  const next = reports.map((report) => {
    if (report.id !== reportId) return report;
    if (report.status !== "ready_for_osm") {
      throw new Error("Rapporten måste först förberedas för OpenStreetMap.");
    }
    if (report.osmNoteId) throw new Error("Rapporten är redan publicerad.");
    return {
      ...report,
      osmSubmissionState: "published" as const,
      osmSubmissionErrorCode: null,
      osmPublicText: normalizeOsmPublicText(publicText),
      osmNoteId: `demo-${report.id}`,
      osmNoteUrl: null,
      osmNoteStatus: "open" as const,
      osmNoteCreatedAt: now,
      osmNoteLastCheckedAt: now,
      osmNoteClosedAt: null,
      updatedAt: now,
    };
  });
  saveLocalPlaceDataReports(groupId, storageKind, next);
}

export function refreshLocalOsmNoteStatus(
  groupId: string,
  reportId: string,
  storageKind: LocalReportStorage,
): void {
  const now = new Date().toISOString();
  const reports = listLocalPlaceDataReports(groupId, storageKind);
  const next = reports.map((report) =>
    report.id === reportId && report.osmNoteId
      ? { ...report, osmNoteLastCheckedAt: now, updatedAt: now }
      : report,
  );
  saveLocalPlaceDataReports(groupId, storageKind, next);
}
