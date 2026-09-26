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
  const pending = temporaryDirectories.splice(0);

  for (const directory of pending) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe("production artifact secret scan", () => {
  test("reports leaks without printing the secret", async () => {
    const root = await mkdtemp(join(tmpdir(), "matrundan-secret-scan-"));
    const serverDirectory = join(root, "server");
    const artifactPath = join(serverDirectory, "index.mjs");
    const secret = "synthetic-server-secret-0123456789";
    const secretEntries = [["TEST_SERVER_SECRET", secret]];

    temporaryDirectories.push(root);
    await mkdir(serverDirectory, { recursive: true });
    await writeFile(artifactPath, "export const safe = true;\n");

    const cleanFindings = await findArtifactSecretLeaks(root, secretEntries);
    expect(cleanFindings).toEqual([]);

    await writeFile(artifactPath, `export const leaked = "${secret}";\n`);

    const findings = await findArtifactSecretLeaks(root, secretEntries);
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
