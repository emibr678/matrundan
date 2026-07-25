/**
 * Server-mutationer för medlems- och inbjudningsadministration.
 *
 * Klienten anropar bara SECURITY DEFINER-RPC:er här; ingen direkt tabell-
 * skrivning på memberships/invitations sker längre.
 */
import { supabase } from "@/integrations/supabase/client";

function toErr(e: unknown): Error {
  const msg =
    (e as { message?: string } | null)?.message ??
    "Något gick fel mot servern. Försök igen.";
  return new Error(msg);
}

export interface CreatedInvitation {
  invitation_id: string;
  token: string;
  expires_at: string;
}

export async function createGroupInvitation(
  groupId: string,
  invitedEmail: string | null,
  expiresInDays = 7,
): Promise<CreatedInvitation> {
  const { data, error } = await supabase.rpc("create_group_invitation", {
    _group_id: groupId,
    _invited_email: invitedEmail ?? undefined,
    _expires_in_days: expiresInDays,
  });
  if (error) throw toErr(error);
  return data as unknown as CreatedInvitation;
}

export type InvitationState = "valid" | "expired" | "revoked" | "accepted" | "invalid";

export interface InvitationPreview {
  valid: boolean;
  state: InvitationState;
  group_id?: string;
  group_name?: string;
  group_emoji?: string | null;
  expires_at?: string;
  email_bound?: boolean;
}

export async function getInvitationPreview(
  token: string,
): Promise<InvitationPreview> {
  const { data, error } = await supabase.rpc("get_invitation_preview", {
    _token: token,
  });
  if (error) throw toErr(error);
  return data as unknown as InvitationPreview;
}

export async function acceptGroupInvitation(
  token: string,
): Promise<{ group_id: string; already: boolean }> {
  const { data, error } = await supabase.rpc("accept_group_invitation", {
    _token: token,
  });
  if (error) throw toErr(error);
  return data as unknown as { group_id: string; already: boolean };
}

export async function revokeGroupInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_group_invitation", {
    _invitation_id: invitationId,
  });
  if (error) throw toErr(error);
}

export interface InvitationListItem {
  id: string;
  invited_email: string | null;
  role: string;
  invited_by: string;
  invited_by_name: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  state: "active" | "accepted" | "revoked" | "expired";
}

export async function listGroupInvitations(
  groupId: string,
): Promise<InvitationListItem[]> {
  const { data, error } = await supabase.rpc("list_group_invitations", {
    _group_id: groupId,
  });
  if (error) throw toErr(error);
  return (data ?? []) as unknown as InvitationListItem[];
}

export async function updateProfile(
  displayName: string,
  avatarEmoji: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("update_profile", {
    _display_name: displayName,
    _avatar_emoji: avatarEmoji ?? undefined,
  });
  if (error) throw toErr(error);
}

export async function updateGroupSettings(
  groupId: string,
  name: string,
  emoji: string | null,
  homeLabel: string | null,
  sharedVisitsCountForProgression?: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("update_group_settings", {
    _group_id: groupId,
    _name: name,
    _emoji: emoji ?? undefined,
    _home_label: homeLabel ?? undefined,
    _shared_visits_count_for_progression:
      sharedVisitsCountForProgression ?? undefined,
  });
  if (error) throw toErr(error);
}

export async function setMemberRole(
  groupId: string,
  userId: string,
  role: "member" | "admin",
): Promise<void> {
  const { error } = await supabase.rpc("set_member_role", {
    _group_id: groupId,
    _user_id: userId,
    _role: role,
  });
  if (error) throw toErr(error);
}

export async function removeGroupMember(
  groupId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase.rpc("remove_group_member", {
    _group_id: groupId,
    _user_id: userId,
  });
  if (error) throw toErr(error);
}

export async function leaveGroup(groupId: string): Promise<void> {
  const { error } = await supabase.rpc("leave_group", { _group_id: groupId });
  if (error) throw toErr(error);
}

export async function transferGroupOwnership(
  groupId: string,
  newOwnerId: string,
): Promise<void> {
  const { error } = await supabase.rpc("transfer_group_ownership", {
    _group_id: groupId,
    _new_owner_id: newOwnerId,
  });
  if (error) throw toErr(error);
}

export async function createGroupWithOwner(
  name: string,
  emoji: string | null,
  homeLabel: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc("create_group_with_owner", {
    _name: name,
    _emoji: emoji ?? undefined,
    _home_label: homeLabel ?? undefined,
  });
  if (error) throw toErr(error);
  return data as unknown as string;
}
