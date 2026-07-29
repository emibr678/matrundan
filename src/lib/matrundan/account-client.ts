import { supabase } from "@/integrations/supabase/client";

export type OwnProfile = {
  displayName: string;
  avatarEmoji: string | null;
};

export async function loadOwnProfile(): Promise<OwnProfile | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, avatar_emoji")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;

  return {
    displayName: data?.display_name ?? "",
    avatarEmoji: data?.avatar_emoji ?? null,
  };
}

export async function clearLocalAccountSession(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
}
