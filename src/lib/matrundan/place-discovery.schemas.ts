import { z } from "zod";

export const candidateDecisionSchema = z.object({
  placeId: z.string().uuid(),
  version: z.string().regex(/^[a-f0-9]{32}$/),
});

export const canonicalPlaceCandidateSchema = z.object({
  placeId: z.string().uuid(),
  name: z.string(),
  category: z.enum(["restaurang", "café", "bageri", "snabbmat", "pub", "matvagn"]),
  cuisines: z.array(z.string()),
  address: z.string(),
  area: z.string().nullable(),
  city: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  groupStatus: z.enum(["active", "archived", "not_linked"]),
  version: z.string(),
});

export const identityCandidateSchema = canonicalPlaceCandidateSchema.extend({
  matchKind: z.enum(["strong", "possible"]),
  distanceKm: z.number().nonnegative(),
  canConfirmSource: z.boolean().default(false),
});

export const providerIdentityReviewSchema = z.object({
  providerPlaceId: z.string(),
  providerVersion: z.string(),
  knownPlace: canonicalPlaceCandidateSchema
    .extend({
      lat: z.number().nullable(),
      lng: z.number().nullable(),
    })
    .nullable(),
  candidates: z.array(identityCandidateSchema),
  reviewRequired: z.boolean(),
  identityConflict: z.boolean(),
});

export const placeResolutionSchema = z.object({
  status: z.enum([
    "created",
    "linked",
    "restored",
    "already_active",
    "review_required",
    "identity_conflict",
    "verification_required",
  ]),
  placeId: z.string().uuid().optional(),
  candidates: z.array(identityCandidateSchema).optional(),
  providerVersion: z.string().optional(),
});

export const resolveProviderPlaceInputSchema = z.object({
  groupId: z.string().uuid(),
  providerPlaceId: z.string().trim().min(1).max(240),
  choice: z.enum(["auto", "link", "separate"]).default("auto"),
  placeId: z.string().uuid().optional(),
  decisions: z.array(candidateDecisionSchema).max(100).default([]),
  providerVersion: z
    .string()
    .regex(/^[a-f0-9]{32}$/)
    .optional(),
  occasions: z
    .array(z.enum(["snabbt", "avslappnat", "middag"]))
    .max(2)
    .default([]),
  notes: z.string().max(2000).optional(),
});
