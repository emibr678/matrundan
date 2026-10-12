/**
 * Live-repository för att dela besök mellan grupper och styra
 * synlighet av egna recensioner per grupp.
 */
import { z } from "zod";
import { rpcClient } from "./rpc-client";
import type { Occasion } from "./types";

const visibleParticipantSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  avatar: z.string().nullable(),
  avatarImage: z.string().nullable(),
  status: z.enum(["active", "left"]),
});

const visitShareTargetSchema = z.object({
  groupId: z.string().min(1),
  name: z.string(),
  emoji: z.string(),
  alreadyLinked: z.boolean(),
  placeExistsInGroup: z.boolean(),
  hasExperienceClassification: z.boolean().default(true),
  externalParticipantCount: z.number().int().nonnegative(),
  visibleParticipants: z.array(visibleParticipantSchema),
  relevantReviewCount: z.number().int().nonnegative(),
  ownHasComment: z.boolean(),
  ownHasPhoto: z.boolean(),
  ownPhotoShared: z.boolean(),
  ownCommentShared: z.boolean(),
  sharedVisitsCountForProgression: z.boolean(),
});

const placeShareTargetSchema = z.object({
  groupId: z.string().min(1),
  name: z.string(),
  emoji: z.string(),
  placeExistsInGroup: z.boolean(),
  hasExperienceClassification: z.boolean().default(true),
  sharedVisitsCountForProgression: z.boolean(),
});

const ownVisitForPlaceSchema = z.object({
  visitId: z.string().min(1),
  visitedOn: z.string(),
  mealType: z.string(),
  groupId: z.string().min(1),
  groupName: z.string(),
  groupEmoji: z.string(),
  alreadySharedToTarget: z.boolean(),
  ownHasComment: z.boolean(),
  ownHasPhoto: z.boolean(),
});

export interface VisibleParticipant {
  id: string;
  name: string;
  avatar: string | null;
  avatarImage: string | null;
  /** active = fortfarande medlem i målgruppen; left = tidigare medlem. */
  status: "active" | "left";
}

export interface VisitShareTarget {
  groupId: string;
  name: string;
  emoji: string;
  alreadyLinked: boolean;
  placeExistsInGroup: boolean;
  hasExperienceClassification: boolean;
  externalParticipantCount: number;
  visibleParticipants: VisibleParticipant[];
  relevantReviewCount: number;
  ownHasComment: boolean;
  ownHasPhoto: boolean;
  ownPhotoShared: boolean;
  ownCommentShared: boolean;
  sharedVisitsCountForProgression: boolean;
}

export interface PlaceShareTarget {
  groupId: string;
  name: string;
  emoji: string;
  placeExistsInGroup: boolean;
  hasExperienceClassification: boolean;
  sharedVisitsCountForProgression: boolean;
}

export interface OwnVisitForPlace {
  visitId: string;
  visitedOn: string;
  mealType: string;
  groupId: string;
  groupName: string;
  groupEmoji: string;
  alreadySharedToTarget: boolean;
  ownHasComment: boolean;
  ownHasPhoto: boolean;
}

export async function listVisitShareTargets(visitId: string): Promise<VisitShareTarget[]> {
  return rpcClient.call(
    "list_visit_share_targets_v6",
    { _visit_id: visitId },
    z.array(visitShareTargetSchema),
    "Kunde inte läsa vilka grupper besöket kan delas till.",
  );
}

export async function listPlaceShareTargets(placeId: string): Promise<PlaceShareTarget[]> {
  return rpcClient.call(
    "list_place_share_targets_v4b",
    { _place_id: placeId },
    z.array(placeShareTargetSchema),
    "Kunde inte läsa vilka grupper stället kan delas till.",
  );
}

export async function listOwnVisitsForPlaceOnAdd(
  placeId: string,
  targetGroupId: string,
): Promise<OwnVisitForPlace[]> {
  return rpcClient.call(
    "list_own_visits_for_place_on_add_v2",
    { _place_id: placeId, _target_group_id: targetGroupId },
    z.array(ownVisitForPlaceSchema),
    "Kunde inte läsa dina tidigare besök på stället.",
  );
}

export async function shareVisitToGroup(
  visitId: string,
  targetGroupId: string,
  shareOwnComment: boolean,
  allowStrongDuplicate = false,
  shareOwnPhoto = false,
  confirmedExperience?: Occasion[],
): Promise<string> {
  if (confirmedExperience?.length) {
    return rpcClient.call(
      "share_visit_to_group_v6",
      {
        _visit_id: visitId,
        _target_group_id: targetGroupId,
        _share_own_comment: shareOwnComment,
        _allow_strong_duplicate: allowStrongDuplicate,
        _share_own_photo: shareOwnPhoto,
        _confirmed_occasions: confirmedExperience,
      },
      z.string().min(1),
      "Kunde inte dela besöket.",
    );
  }
  return rpcClient.call(
    "share_visit_to_group_v5",
    {
      _visit_id: visitId,
      _target_group_id: targetGroupId,
      _share_own_comment: shareOwnComment,
      _allow_strong_duplicate: allowStrongDuplicate,
      _share_own_photo: shareOwnPhoto,
    },
    z.string().min(1),
    "Kunde inte dela besöket.",
  );
}

export async function shareOwnVisitPhotoToGroup(
  visitId: string,
  targetGroupId: string,
): Promise<void> {
  await rpcClient.call(
    "grant_own_visit_photo_visibility_v1",
    { _visit_id: visitId, _target_group_id: targetGroupId },
    z.string().min(1),
    "Kunde inte dela din bild.",
  );
}

export async function removeSharedVisitFromGroup(visitId: string, groupId: string): Promise<void> {
  await rpcClient.callVoid("remove_shared_visit_from_group", {
    _visit_id: visitId,
    _group_id: groupId,
  });
}

export async function setReviewGroupVisibility(
  reviewId: string,
  groupId: string,
  ratingVisible: boolean,
  commentVisible: boolean,
): Promise<void> {
  await rpcClient.callVoid("set_review_group_visibility", {
    _review_id: reviewId,
    _group_id: groupId,
    _rating_visible: ratingVisible,
    _comment_visible: commentVisible,
  });
}

export interface VisitContentImpact {
  commentSharedElsewhere: boolean;
  photoSharedElsewhere: boolean;
}
export async function getVisitContentImpact(
  visitId: string,
  groupId: string,
  photoOwnerId?: string,
): Promise<VisitContentImpact> {
  return rpcClient.call(
    "get_visit_content_impact_v1",
    { _visit_id: visitId, _group_id: groupId, _photo_owner_id: photoOwnerId ?? null },
    z.object({ commentSharedElsewhere: z.boolean(), photoSharedElsewhere: z.boolean() }),
  );
}
