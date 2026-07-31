import { describe, expect, test } from "bun:test";
import {
  CURRENT_GROUP_STATE_RPC,
  shouldFallbackToPreviousGroupStateRpc,
} from "./read-model-version";

describe("read-model-fallback", () => {
  test("faller tillbaka när PostgREST saknar den aktuella funktionen", () => {
    expect(
      shouldFallbackToPreviousGroupStateRpc({
        code: "PGRST202",
        message: `Could not find the function public.${CURRENT_GROUP_STATE_RPC}`,
      }),
    ).toBe(true);
  });

  test("känner igen saknad funktion även utan felkod", () => {
    expect(
      shouldFallbackToPreviousGroupStateRpc({
        message: `Could not find the function public.${CURRENT_GROUP_STATE_RPC}(_group_id)`,
      }),
    ).toBe(true);
  });

  test("döljer inte behörighets-, nätverks- eller datafel", () => {
    expect(
      shouldFallbackToPreviousGroupStateRpc({ code: "42501", message: "permission denied" }),
    ).toBe(false);
    expect(
      shouldFallbackToPreviousGroupStateRpc({ code: "PGRST301", message: "JWT expired" }),
    ).toBe(false);
    expect(shouldFallbackToPreviousGroupStateRpc(null)).toBe(false);
  });
});
