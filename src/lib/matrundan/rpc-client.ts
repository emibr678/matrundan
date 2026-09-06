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
  // Wrappern tar RPC-namn dynamiskt medan Supabase-klienten typas per konkret funktionsnamn.
  // Håll den strukturella adaptern på denna integrationsgräns och validera svaren med Zod.
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
