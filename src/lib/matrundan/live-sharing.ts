/**
 * Live-repository för att dela besök mellan grupper och styra
 * synlighet av egna recensioner per grupp.
 */
import { z } from "zod";
import { rpcClient } from "./rpc-client";

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
  externalParticipantCount: z.number().int().nonnegative(),
  visibleParticipants: z.array(visibleParticipantSchema),
  relevantReviewCount: z.number().int().nonnegative(),
  ownHasComment: z.boolean(),
  sharedVisitsCountForProgression: z.boolean(),
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
  externalParticipantCount: number;
  visibleParticipants: VisibleParticipant[];
  relevantReviewCount: number;
  ownHasComment: boolean;
  sharedVisitsCountForProgression: boolean;
}

export async function listVisitShareTargets(visitId: string): Promise<VisitShareTarget[]> {
  return rpcClient.call(
    "list_visit_share_targets_v4b",
    { _visit_id: visitId },
    z.array(visitShareTargetSchema),
    "Kunde inte läsa vilka grupper besöket kan delas till.",
  );
}

export async function shareVisitToGroup(
  visitId: string,
  targetGroupId: string,
  shareOwnComment: boolean,
): Promise<string> {
  return rpcClient.call(
    "share_visit_to_group",
    {
      _visit_id: visitId,
      _target_group_id: targetGroupId,
      _share_own_comment: shareOwnComment,
    },
    z.string().min(1),
    "Kunde inte dela besöket.",
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
