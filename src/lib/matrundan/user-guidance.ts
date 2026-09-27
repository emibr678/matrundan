import { supabase } from "@/integrations/supabase/client";

export const USER_GUIDANCE = {
  coreIntro: { key: "core-intro", version: 1 },
  occasionGuide: { key: "occasion-guide", version: 1 },
} as const;

export type UserGuidanceDefinition =
  (typeof USER_GUIDANCE)[keyof typeof USER_GUIDANCE];

export type UserGuidanceIdentifier = `${string}@${number}`;

export type UserGuidanceRow = {
  guidance_key: string;
  guidance_version: number;
};

export type CoreIntroEligibility = {
  isLive: boolean;
  hasUser: boolean;
  hasActiveGroup: boolean;
  onHomeRoute: boolean;
  pendingInvitationsReady: boolean;
  pendingInvitationCount: number;
  guidanceReady: boolean;
  acknowledged: boolean;
  alreadyHandled: boolean;
};

export function shouldAutoShowCoreIntro({
  isLive,
  hasUser,
  hasActiveGroup,
  onHomeRoute,
  pendingInvitationsReady,
  pendingInvitationCount,
  guidanceReady,
  acknowledged,
  alreadyHandled,
}: CoreIntroEligibility): boolean {
  return (
    isLive &&
    hasUser &&
    hasActiveGroup &&
    onHomeRoute &&
    pendingInvitationsReady &&
    pendingInvitationCount === 0 &&
    guidanceReady &&
    !acknowledged &&
    !alreadyHandled
  );
}

export function guidanceIdentifier(
  definition: UserGuidanceDefinition,
): UserGuidanceIdentifier {
  return `${definition.key}@${definition.version}`;
}

export function guidanceRowsToIdentifiers(
  rows: UserGuidanceRow[],
): Set<UserGuidanceIdentifier> {
  return new Set(
    rows.map(
      (row) =>
        `${row.guidance_key}@${row.guidance_version}` as UserGuidanceIdentifier,
    ),
  );
}

export async function loadAcknowledgedGuidance(
  userId: string,
): Promise<Set<UserGuidanceIdentifier>> {
  const { data, error } = await supabase
    .from("user_guidance_state")
    .select("guidance_key, guidance_version")
    .eq("user_id", userId);

  if (error) throw error;
  return guidanceRowsToIdentifiers(data ?? []);
}

export async function acknowledgeUserGuidance(
  userId: string,
  definition: UserGuidanceDefinition,
): Promise<void> {
  const { error } = await supabase.from("user_guidance_state").upsert(
    {
      user_id: userId,
      guidance_key: definition.key,
      guidance_version: definition.version,
    },
    {
      onConflict: "user_id,guidance_key,guidance_version",
      ignoreDuplicates: true,
    },
  );

  if (error) throw error;
}
