import { supabase } from "@/integrations/supabase/client";
import type { Occasion, PlaceCategory, VisibleReview } from "./types";

type RpcResponse = {
  data: unknown;
  error: { message?: string } | null;
};

type RpcCall = (fn: string, args?: Record<string, unknown>) => Promise<RpcResponse>;

const rpc = supabase.rpc.bind(supabase) as unknown as RpcCall;

function toErr(error: RpcResponse["error"]): Error {
  return new Error(error?.message ?? "Något gick fel mot servern. Försök igen.");
}

async function run(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await rpc(fn, args);
  if (error) throw toErr(error);
  return data;
}

export async function archiveGroup(groupId: string): Promise<void> {
  await run("archive_group", { _group_id: groupId });
}

export async function reactivateGroup(groupId: string): Promise<void> {
  await run("reactivate_group", { _group_id: groupId });
}

export async function archiveGroupPlace(groupId: string, placeId: string): Promise<void> {
  await run("archive_group_place", {
    _group_id: groupId,
    _place_id: placeId,
  });
}

export async function restoreGroupPlace(groupId: string, placeId: string): Promise<void> {
  await run("restore_group_place", {
    _group_id: groupId,
    _place_id: placeId,
  });
}

export interface GroupPlaceMetadataInput {
  categoryOverride: PlaceCategory | null;
  cuisinesOverride: string[] | null;
  occasions: Occasion[];
  notes: string | null;
}

export async function updateGroupPlaceMetadata(
  groupId: string,
  placeId: string,
  input: GroupPlaceMetadataInput,
): Promise<void> {
  await run("update_group_place_metadata", {
    _group_id: groupId,
    _place_id: placeId,
    _category_override: input.categoryOverride,
    _cuisines_override: input.cuisinesOverride,
    _occasions: input.occasions,
    _notes: input.notes,
  });
}

export type ReviewEditInput = Pick<
  VisibleReview,
  "overall" | "taste" | "value" | "service" | "comment"
>;

export async function updateOwnReview(
  groupId: string,
  reviewId: string,
  input: ReviewEditInput,
): Promise<void> {
  await run("update_own_review", {
    _group_id: groupId,
    _review_id: reviewId,
    _overall: input.overall,
    _taste: input.taste ?? null,
    _value: input.value ?? null,
    _service: input.service ?? null,
    _comment: input.comment ?? null,
  });
}
