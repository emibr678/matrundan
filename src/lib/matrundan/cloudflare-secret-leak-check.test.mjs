import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  findArtifactSecretLeaks,
  formatArtifactSecretLeakFailure,
} from "../../../scripts/cloudflare-secret-leak-check.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("production artifact secret scan", () => {
  test("passes clean artifacts and reports leaks without printing the secret", async () => {
    const root = await mkdtemp(join(tmpdir(), "matrundan-secret-scan-"));
    temporaryDirectories.push(root);
    await mkdir(join(root, "server"), { recursive: true });

    const secret = "synthetic-server-secret-0123456789";
    await writeFile(join(root, "server", "index.mjs"), "export const safe = true;\n");

    expect(\n      await findArtifactSecretLeaks(root, [["TEST_SERVER_SECRET", secret]]),\n    ).toEqual([]);

    await writeFile(
      join(root, "server", "index.mjs"),
      `export const leaked = "${secret}";\n`,
    );

    const findings = await findArtifactSecretLeaks(root, [\n      ["TEST_SERVER_SECRET", secret],\n    ]);
    expect(findings).toEqual([
      {
        envName: "TEST_SERVER_SECRET",
        path: "server/index.mjs",
      },
    ]);

    const failure = formatArtifactSecretLeakFailure(findings);
    expect(failure).toContain("TEST_SERVER_SECRET");
    expect(failure).toContain("server/index.mjs");
    expect(failure).not.toContain(secret);
  });
});
