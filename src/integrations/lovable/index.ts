// Temporär kompatibilitetsadapter under plattformsmigrationen.
// OAuth går direkt via Supabase Auth; inga Lovable Cloud-authanrop görs här.

import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google", opts?: SignInOptions) => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: opts?.redirect_uri,
          queryParams: opts?.extraParams,
        },
      });

      return { error };
    },
  },
};
