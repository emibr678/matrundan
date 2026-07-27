import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createRpcClient, type RpcExecutor } from "./rpc-client";

describe("rpc-client", () => {
  test("validerar och returnerar ett giltigt svar", async () => {
    const execute: RpcExecutor = async () => ({ data: "id-123", error: null });
    const client = createRpcClient(execute);

    await expect(client.call("create_place", {}, z.string().min(1))).resolves.toBe("id-123");
  });

  test("behåller serverns felmeddelande", async () => {
    const execute: RpcExecutor = async () => ({
      data: null,
      error: { message: "Du saknar behörighet." },
    });
    const client = createRpcClient(execute);

    await expect(client.callVoid("archive_group", {})).rejects.toThrow("Du saknar behörighet.");
  });

  test("stoppar oväntade returvärden vid integrationsgränsen", async () => {
    const execute: RpcExecutor = async () => ({ data: { id: "fel format" }, error: null });
    const client = createRpcClient(execute);

    await expect(client.call("create_place", {}, z.string())).rejects.toThrow(
      "Servern svarade med ett oväntat format.",
    );
  });

  test("callVoid accepterar RPC:er utan meningsfull returdata", async () => {
    const execute: RpcExecutor = async () => ({ data: null, error: null });
    const client = createRpcClient(execute);

    await expect(client.callVoid("reactivate_group", {})).resolves.toBeUndefined();
  });
});
