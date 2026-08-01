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

function toRpcError(error: RpcErrorLike | null): Error {
  return new Error(error?.message ?? DEFAULT_SERVER_ERROR);
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
    if (error) throw toRpcError(error);
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
