import type { ZodType, ZodTypeDef } from "zod";
import { supabase } from "@/integrations/supabase/client";

interface RpcErrorLike {
  message?: string;
}

export interface RpcResult {
  data: unknown;
  error: RpcErrorLike | null;
}

export type RpcExecutor = (
  functionName: string,
  args?: Record<string, unknown>,
) => Promise<RpcResult>;

const DEFAULT_SERVER_ERROR = "Något gick fel mot servern. Försök igen.";
const INVALID_SERVER_RESPONSE = "Servern svarade med ett oväntat format.";
const RPC_UNAVAILABLE_MESSAGES: Partial<Record<string, string>> = {
  create_place_data_report_from_suggestion_v1:
    "Platsdatarapportering är tillfälligt otillgänglig. Ladda om appen och försök igen.",
  list_visit_guest_member_targets_v1:
    "Deltagarvalet är tillfälligt otillgängligt. Ladda om och försök igen.",
  propose_visit_guest_member_v1:
    "Kunde inte skicka frågan just nu. Ladda om och försök igen.",
  list_visit_shared_member_candidates_v1:
    "Deltagarvalet är tillfälligt otillgängligt. Ladda om och försök igen.",
  propose_shared_visit_member_v1:
    "Kunde inte skicka frågan just nu. Ladda om och försök igen.",
  get_own_visit_guest_proposal_v1:
    "Deltagarfrågan är tillfälligt otillgänglig. Ladda om och försök igen.",
  respond_visit_guest_proposal_v1:
    "Kunde inte spara ditt svar just nu. Ladda om och försök igen.",
};

function toRpcError(functionName: string, error: RpcErrorLike | null): Error {
  const message = error?.message ?? DEFAULT_SERVER_ERROR;
  const unavailableMessage = RPC_UNAVAILABLE_MESSAGES[functionName];
  if (unavailableMessage && /could not find the function|schema cache/i.test(message)) {
    return new Error(unavailableMessage);
  }
  return new Error(message);
}

async function executeSupabaseRpc(
  functionName: string,
  args?: Record<string, unknown>,
): Promise<RpcResult> {
  // De genererade Supabase-typerna ligger tillfälligt efter migrationerna.
  // Typ-escape hatchen hålls därför på denna enda integrationsgräns.
  const execute = supabase.rpc.bind(supabase) as unknown as RpcExecutor;
  return execute(functionName, args);
}

export function createRpcClient(execute: RpcExecutor) {
  async function read(functionName: string, args?: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await execute(functionName, args);
    if (error) throw toRpcError(functionName, error);
    return data;
  }

  return {
    async call<T>(
      functionName: string,
      args: Record<string, unknown>,
      schema: ZodType<T, ZodTypeDef, unknown>,
      invalidResponseMessage = INVALID_SERVER_RESPONSE,
    ): Promise<T> {
      const parsed = schema.safeParse(await read(functionName, args));
      if (!parsed.success) throw new Error(invalidResponseMessage);
      return parsed.data;
    },

    async callVoid(functionName: string, args: Record<string, unknown>): Promise<void> {
      await read(functionName, args);
    },
  };
}

export const rpcClient = createRpcClient(executeSupabaseRpc);
