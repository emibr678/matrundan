export const CURRENT_GROUP_STATE_RPC = "get_group_app_state_v5j";
export const PREVIOUS_GROUP_STATE_RPC = "get_group_app_state_v5i";

export interface PostgrestErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

/**
 * Fallback får endast användas när PostgREST uttryckligen saknar den aktuella
 * funktionen. Behörighets-, nätverks- och datafel ska aldrig döljas genom att
 * prova en äldre read-model.
 */
export function shouldFallbackToPreviousGroupStateRpc(
  error: PostgrestErrorLike | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "PGRST202") return true;

  const text = [error.message, error.details, error.hint].filter(Boolean).join(" ");
  return (
    /could not find the function/i.test(text) &&
    text.toLocaleLowerCase("en-US").includes(CURRENT_GROUP_STATE_RPC.toLocaleLowerCase("en-US"))
  );
}
