import { z } from "zod";

import { rpcClient } from "./rpc-client";
import type { ReviewReactionKey, ReviewReactionState } from "./review-reactions";

const reactionKeySchema = z.enum(["heart", "drool", "celebrate", "laugh"]);
const reactionPersonSchema = z.object({
  userId: z.string(),
  name: z.string(),
  avatar: z.string().nullable().optional(),
  avatarImage: z.string().nullable().optional(),
  status: z.enum(["active", "left"]),
});
const reactionBucketSchema = z.object({
  reaction: reactionKeySchema,
  count: z.number().int().nonnegative(),
  reactors: z.array(reactionPersonSchema),
});
const reactionStateSchema = z.object({
  reviewId: z.string(),
  myReaction: reactionKeySchema.nullable(),
  reactions: z.array(reactionBucketSchema),
});

export async function loadVisitReviewReactions(
  groupId: string,
  visitId: string,
): Promise<ReviewReactionState[]> {
  return rpcClient.call(
    "get_visit_review_reactions_v1",
    { _group_id: groupId, _visit_id: visitId },
    z.array(reactionStateSchema),
    "Kunde inte läsa reaktionerna.",
  );
}

export async function setOwnReviewReaction(
  groupId: string,
  visitId: string,
  reviewId: string,
  reaction: ReviewReactionKey | null,
): Promise<void> {
  await rpcClient.callVoid("set_own_review_reaction_v1", {
    _group_id: groupId,
    _visit_id: visitId,
    _review_id: reviewId,
    _reaction: reaction,
  });
}
