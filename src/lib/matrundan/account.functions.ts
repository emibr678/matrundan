import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccountDeletionCandidate = {
  id: string;
  name: string;
  avatar: string | null;
};

export type AccountDeletionGroup = {
  groupId: string;
  name: string;
  emoji: string;
  lifecycleStatus: "active" | "archived";
  otherMemberCount: number;
  requiresSuccessor: boolean;
  willBeDeleted: boolean;
  candidates: AccountDeletionCandidate[];
};

export type AccountDeletionRequirements = {
  groups: AccountDeletionGroup[];
  transferGroupCount: number;
  soloGroupCount: number;
};

type RpcResponse = {
  data: unknown;
  error: { message?: string } | null;
};

type RpcCall = (fn: string, args?: Record<string, unknown>) => Promise<RpcResponse>;

function deletionRequirements(value: unknown): AccountDeletionRequirements {
  const parsed = z
    .object({
      groups: z.array(
        z.object({
          groupId: z.string().uuid(),
          name: z.string(),
          emoji: z.string(),
          lifecycleStatus: z.enum(["active", "archived"]),
          otherMemberCount: z.number().int().nonnegative(),
          requiresSuccessor: z.boolean(),
          willBeDeleted: z.boolean(),
          candidates: z.array(
            z.object({
              id: z.string().uuid(),
              name: z.string(),
              avatar: z.string().nullable(),
            }),
          ),
        }),
      ),
      transferGroupCount: z.number().int().nonnegative(),
      soloGroupCount: z.number().int().nonnegative(),
    })
    .parse(value);
  return parsed;
}

export const getAccountDeletionRequirements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountDeletionRequirements> => {
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as RpcCall;
    const { data, error } = await rpc("get_account_deletion_requirements");
    if (error) {
      throw new Error(error.message ?? "Kunde inte förbereda kontoborttagningen.");
    }
    return deletionRequirements(data);
  });

export const deleteOwnAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        confirmation: z.literal("RADERA"),
        confirmSoloGroupDeletion: z.boolean(),
        successors: z.record(z.string().uuid(), z.string().uuid()),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ deleted: true }> => {
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as RpcCall;
    const prepared = await rpc("prepare_own_account_deletion", {
      _successors: data.successors,
      _confirm_solo_group_deletion: data.confirmSoloGroupDeletion,
    });
    if (prepared.error) {
      throw new Error(prepared.error.message ?? "Kunde inte förbereda kontoborttagningen.");
    }

    const payload = z.object({ storagePaths: z.array(z.string()) }).parse(prepared.data);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (let index = 0; index < payload.storagePaths.length; index += 100) {
      const paths = payload.storagePaths.slice(index, index + 100);
      const { error } = await supabaseAdmin.storage.from("visit-photos").remove(paths);
      if (error) {
        throw new Error("Kontot är anonymiserat, men bilderna kunde inte tas bort. Försök igen.");
      }
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(context.userId, true);
    if (deleteError) {
      throw new Error(
        "Uppgifterna är anonymiserade, men inloggningen kunde inte tas bort. Försök igen.",
      );
    }

    const adminRpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as RpcCall;
    const completion = await adminRpc("complete_account_deletion", {
      _user_id: context.userId,
    });
    if (completion.error) {
      console.error("[Matrundan] kunde inte slutföra raderingsjobbet:", completion.error);
    }

    return { deleted: true };
  });
