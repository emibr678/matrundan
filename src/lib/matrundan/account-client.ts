import { supabase } from "@/integrations/supabase/client";
import { normalizeProfileAvatarKind, type ProfileAvatarKind } from "./avatar";

export type OwnProfile = {
  displayName: string;
  avatarKind: ProfileAvatarKind;
  avatarEmoji: string | null;
  avatarSeed: string | null;
  accountAvatarUrl: string | null;
};

function accountAvatarUrl(metadata: Record<string, unknown> | undefined): string | null {
  for (const key of ["avatar_url", "picture"]) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export async function loadOwnProfile(): Promise<OwnProfile | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) return null;

  const current = await supabase
    .from("profiles")
    .select("display_name, avatar_kind, avatar_emoji, avatar_seed")
    .eq("id", userId)
    .maybeSingle();

  if (!current.error) {
    return {
      displayName: current.data?.display_name ?? "",
      avatarKind: normalizeProfileAvatarKind(current.data?.avatar_kind),
      avatarEmoji: current.data?.avatar_emoji ?? null,
      avatarSeed: current.data?.avatar_seed ?? null,
      accountAvatarUrl: accountAvatarUrl(userData.user?.user_metadata as Record<string, unknown>),
    };
  }

  const missingAvatarColumns =
    current.error.message.includes("avatar_kind") || current.error.message.includes("avatar_seed");
  if (!missingAvatarColumns) throw current.error;

  // Gör branchpreview användbar före separat godkänd stagingmigration.
  const legacy = await supabase
    .from("profiles")
    .select("display_name, avatar_emoji")
    .eq("id", userId)
    .maybeSingle();
  if (legacy.error) throw legacy.error;

  return {
    displayName: legacy.data?.display_name ?? "",
    avatarKind: legacy.data?.avatar_emoji ? "emoji" : "account",
    avatarEmoji: legacy.data?.avatar_emoji ?? null,
    avatarSeed: null,
    accountAvatarUrl: accountAvatarUrl(userData.user?.user_metadata as Record<string, unknown>),
  };
}

export async function clearLocalAccountSession(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
}

export function subscribeToPasswordRecovery(onRecovery: () => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") onRecovery();
  });
  return () => data.subscription.unsubscribe();
}

export async function hasCurrentAccountSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

export async function updateOwnPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
