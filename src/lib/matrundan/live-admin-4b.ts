import type { Occasion, PlaceCategory, VisibleReview } from "./types";
import { rpcClient } from "./rpc-client";

export async function archiveGroup(groupId: string): Promise<void> {
  await rpcClient.callVoid("archive_group", { _group_id: groupId });
}

export async function reactivateGroup(groupId: string): Promise<void> {
  await rpcClient.callVoid("reactivate_group", { _group_id: groupId });
}

export async function archiveGroupPlace(groupId: string, placeId: string): Promise<void> {
  await rpcClient.callVoid("archive_group_place", {
    _group_id: groupId,
    _place_id: placeId,
  });
}

export async function restoreGroupPlace(groupId: string, placeId: string): Promise<void> {
  await rpcClient.callVoid("restore_group_place", {
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
  await rpcClient.callVoid("update_group_place_metadata", {
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
  "overall" | "taste" | "value" | "service" | "atmosphere" | "comment"
>;

export async function updateOwnReview(
  groupId: string,
  reviewId: string,
  input: ReviewEditInput,
): Promise<void> {
  await rpcClient.callVoid("update_own_review_v3", {
    _group_id: groupId,
    _review_id: reviewId,
    _overall: input.overall,
    _taste: input.taste ?? null,
    _value: input.value ?? null,
    _service: input.service ?? null,
    _atmosphere: input.atmosphere ?? null,
    _comment: input.comment ?? null,
  });
}
