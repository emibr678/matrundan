import { z } from "zod";

import { rpcClient } from "./rpc-client";

const proposalStatusSchema = z.enum(["pending", "deferred", "declined", "accepted"]);

const guestMemberTargetSchema = z.object({
  guestId: z.string().min(1),
  guestName: z.string().min(1),
  groupId: z.string().min(1),
  groupName: z.string().min(1),
  groupEmoji: z.string().nullable(),
  memberId: z.string().min(1),
  memberName: z.string().min(1),
  memberAvatar: z.string().nullable(),
  memberAvatarImage: z.string().nullable(),
  proposalStatus: proposalStatusSchema.nullable(),
});

const sharedMemberCandidateSchema = z.object({
  memberId: z.string().min(1),
  memberName: z.string().min(1),
  memberAvatar: z.string().nullable(),
  memberAvatarImage: z.string().nullable(),
  proposalStatus: proposalStatusSchema.nullable(),
});

const ownProposalSchema = z
  .object({
    proposalId: z.string().min(1),
    status: z.enum(["pending", "deferred"]),
  })
  .nullable();

export type GuestMemberProposalStatus = z.infer<typeof proposalStatusSchema>;
export type GuestMemberTarget = z.infer<typeof guestMemberTargetSchema>;
export type SharedVisitMemberCandidate = z.infer<typeof sharedMemberCandidateSchema>;
export type OwnGuestMemberProposal = Exclude<z.infer<typeof ownProposalSchema>, null>;
export type GuestMemberProposalResponse = "accept" | "decline" | "defer";

export async function listVisitGuestMemberTargets(
  sourceGroupId: string,
  visitId: string,
): Promise<GuestMemberTarget[]> {
  return rpcClient.call(
    "list_visit_guest_member_targets_v1",
    { _source_group_id: sourceGroupId, _visit_id: visitId },
    z.array(guestMemberTargetSchema),
    "Kunde inte läsa vilka medlemmar gästerna kan kopplas till.",
  );
}

export async function proposeVisitGuestMember(
  sourceGroupId: string,
  visitId: string,
  guestId: string,
  targetGroupId: string,
  targetUserId: string,
): Promise<string> {
  return rpcClient.call(
    "propose_visit_guest_member_v1",
    {
      _source_group_id: sourceGroupId,
      _visit_id: visitId,
      _guest_id: guestId,
      _target_group_id: targetGroupId,
      _target_user_id: targetUserId,
    },
    z.string().min(1),
    "Kunde inte skapa deltagandeförslaget.",
  );
}

export async function listSharedVisitMemberCandidates(
  groupId: string,
  visitId: string,
): Promise<SharedVisitMemberCandidate[]> {
  return rpcClient.call(
    "list_visit_shared_member_candidates_v1",
    { _group_id: groupId, _visit_id: visitId },
    z.array(sharedMemberCandidateSchema),
    "Kunde inte läsa möjliga deltagare i gruppen.",
  );
}

export async function proposeSharedVisitMember(
  groupId: string,
  visitId: string,
  targetUserId: string,
): Promise<string> {
  return rpcClient.call(
    "propose_shared_visit_member_v1",
    {
      _group_id: groupId,
      _visit_id: visitId,
      _target_user_id: targetUserId,
    },
    z.string().min(1),
    "Kunde inte skapa deltagandeförslaget.",
  );
}

export async function confirmSharedVisitSelf(groupId: string, visitId: string): Promise<void> {
  await rpcClient.callVoid("confirm_shared_visit_self_v1", {
    _group_id: groupId,
    _visit_id: visitId,
  });
}

export async function getOwnVisitGuestProposal(
  groupId: string,
  visitId: string,
): Promise<OwnGuestMemberProposal | null> {
  return rpcClient.call(
    "get_own_visit_guest_proposal_v1",
    { _group_id: groupId, _visit_id: visitId },
    ownProposalSchema,
    "Kunde inte läsa deltagandeförslaget.",
  );
}

export async function respondVisitGuestProposal(
  groupId: string,
  proposalId: string,
  response: GuestMemberProposalResponse,
): Promise<void> {
  await rpcClient.callVoid("respond_visit_guest_proposal_v1", {
    _group_id: groupId,
    _proposal_id: proposalId,
    _response: response,
  });
}
