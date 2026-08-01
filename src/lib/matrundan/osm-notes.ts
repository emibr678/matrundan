import { z } from "zod";

import type { PlaceDataReportCategory } from "./place-data-reports";

export const OSM_NOTE_STATUSES = ["open", "closed", "hidden", "unknown"] as const;
export type OsmNoteStatus = (typeof OSM_NOTE_STATUSES)[number];

export const OSM_SUBMISSION_STATES = [
  "not_submitted",
  "submitting",
  "published",
  "failed",
] as const;
export type OsmSubmissionState = (typeof OSM_SUBMISSION_STATES)[number];

export interface OsmNoteSnapshot {
  id: string;
  status: OsmNoteStatus;
  createdAt: string | null;
  closedAt: string | null;
}

export interface OsmPublicTextSource {
  placeName: string;
  placeAddress: string;
  placeCity: string;
  category: PlaceDataReportCategory;
  description: string;
}

const PUBLIC_REFERENCE_PATTERN = /^MR-[A-Z0-9]{10}$/;
const PUBLIC_TEXT_MIN = 20;
const PUBLIC_TEXT_MAX = 1000;

const categoryIntro: Record<PlaceDataReportCategory, string> = {
  closed_or_replaced: "Verksamheten på platsen verkar vara stängd eller ersatt.",
  wrong_name: "Namnet i kartdatan verkar vara inaktuellt.",
  wrong_address: "Adressen eller kartpositionen verkar vara fel.",
  wrong_website: "Webbplatsen i kartdatan verkar vara fel eller inaktuell.",
  duplicate: "Det verkar finnas en dubblett av verksamheten i kartdatan.",
  other: "Platsinformationen verkar behöva kontrolleras.",
};

function normalizeLineBreaks(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function normalizeOsmPublicText(value: string): string {
  const normalized = normalizeLineBreaks(value).trim();
  if (normalized.length < PUBLIC_TEXT_MIN) {
    throw new Error("Den offentliga texten måste vara minst 20 tecken.");
  }
  if (normalized.length > PUBLIC_TEXT_MAX) {
    throw new Error("Den offentliga texten får vara högst 1000 tecken.");
  }
  return normalized;
}

export function buildDefaultOsmPublicText(report: OsmPublicTextSource): string {
  const location = [report.placeAddress, report.placeCity].filter(Boolean).join(", ");
  const observation = normalizeLineBreaks(report.description).trim().slice(0, 700);
  return normalizeOsmPublicText(
    [
      categoryIntro[report.category],
      `Matställe: ${report.placeName}${location ? ` (${location})` : ""}.`,
      `Observation: ${observation}`,
      "Kontrollera gärna uppgifterna på plats eller mot lämpliga källor innan kartan ändras.",
    ].join("\n\n"),
  );
}

export function composeOsmNoteText(publicText: string, publicReference: string): string {
  if (!PUBLIC_REFERENCE_PATTERN.test(publicReference)) {
    throw new Error("Ogiltig offentlig OSM-referens.");
  }
  return `${normalizeOsmPublicText(publicText)}\n\nRapporterat via Matrundan. Referens: ${publicReference}`;
}

export function normalizeOsmNoteStatus(value: unknown): OsmNoteStatus {
  if (value === "open" || value === "closed") return value;
  return "unknown";
}

const osmFeatureSchema = z.object({
  geometry: z
    .object({
      coordinates: z.tuple([z.number(), z.number()]),
    })
    .optional(),
  properties: z.object({
    id: z.union([z.number().int().positive(), z.string().regex(/^[1-9][0-9]*$/)]),
    status: z.string(),
    date_created: z.string().nullable().optional(),
    closed_at: z.string().nullable().optional(),
    comments: z
      .array(
        z.object({
          text: z.string().optional(),
        }),
      )
      .optional(),
  }),
});

export function parseOsmNoteFeature(value: unknown): OsmNoteSnapshot {
  const feature = osmFeatureSchema.parse(value);
  return {
    id: String(feature.properties.id),
    status: normalizeOsmNoteStatus(feature.properties.status),
    createdAt: feature.properties.date_created ?? null,
    closedAt: feature.properties.closed_at ?? null,
  };
}

const featureCollectionSchema = z.object({
  features: z.array(osmFeatureSchema),
});

export function findOsmNoteByReference(
  value: unknown,
  publicReference: string,
  expectedLat: number,
  expectedLng: number,
): OsmNoteSnapshot | null {
  if (!PUBLIC_REFERENCE_PATTERN.test(publicReference)) return null;
  const collection = featureCollectionSchema.parse(value);
  const match = collection.features.find((feature) => {
    const comments = feature.properties.comments ?? [];
    const containsReference = comments.some((comment) =>
      comment.text?.includes(`Referens: ${publicReference}`),
    );
    const coordinates = feature.geometry?.coordinates;
    const closeEnough =
      coordinates != null &&
      Math.abs(coordinates[1] - expectedLat) < 0.00001 &&
      Math.abs(coordinates[0] - expectedLng) < 0.00001;
    return containsReference && closeEnough;
  });
  return match ? parseOsmNoteFeature(match) : null;
}

export const OSM_NOTE_STATUS_LABEL: Record<OsmNoteStatus, string> = {
  open: "Öppen i OpenStreetMap",
  closed: "Stängd i OpenStreetMap",
  hidden: "Dold av OpenStreetMap",
  unknown: "Okänd status i OpenStreetMap",
};
