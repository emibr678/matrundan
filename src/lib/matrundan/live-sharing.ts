/**
 * Live-repository för att dela besök mellan grupper och styra
 * synlighet av egna recensioner per grupp.
 */
import { supabase } from "@/integrations/supabase/client";

function toErr(e: unknown): Error {
  const msg =
    (e as { message?: string } | null)?.message ??
    "Något gick fel mot servern. Försök igen.";
  return new Error(msg);
}

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

export async function listVisitShareTargets(
  visitId: string,
): Promise<VisitShareTarget[]> {
  const { data, error } = await supabase.rpc(
    "list_visit_share_targets_v4b" as "list_visit_share_targets",
    { _visit_id: visitId },
  );
  if (error) throw toErr(error);
  return (data ?? []) as unknown as VisitShareTarget[];
}

export async function shareVisitToGroup(
  visitId: string,
  targetGroupId: string,
  shareOwnComment: boolean,
): Promise<string> {
  const { data, error } = await supabase.rpc("share_visit_to_group", {
    _visit_id: visitId,
    _target_group_id: targetGroupId,
    _share_own_comment: shareOwnComment,
  });
  if (error) throw toErr(error);
  return data as unknown as string;
}

export async function removeSharedVisitFromGroup(
  visitId: string,
  groupId: string,
): Promise<void> {
  const { error } = await supabase.rpc("remove_shared_visit_from_group", {
    _visit_id: visitId,
    _group_id: groupId,
  });
  if (error) throw toErr(error);
}

export async function setReviewGroupVisibility(
  reviewId: string,
  groupId: string,
  ratingVisible: boolean,
  commentVisible: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("set_review_group_visibility", {
    _review_id: reviewId,
    _group_id: groupId,
    _rating_visible: ratingVisible,
    _comment_visible: commentVisible,
  });
  if (error) throw toErr(error);
}
