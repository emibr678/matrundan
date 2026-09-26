import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      const nested = await collectFiles(path);
      files.push(...nested);
      continue;
    }

    if (entry.isFile()) {
      files.push(path);
    }
  }

  return files;
}

function normalizeSecretEntries(secretEntries) {
  return secretEntries.map(([envName, value]) => {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(
        `artifact-secret-scan: missing required value for ${envName}`,
      );
    }

    if (value.length < 16) {
      throw new Error(
        `artifact-secret-scan: ${envName} is unexpectedly short`,
      );
    }

    return {
      envName,
      bytes: Buffer.from(value, "utf8"),
    };
  });
}

export async function findArtifactSecretLeaks(rootDirectory, secretEntries) {
  const root = resolve(rootDirectory);
  const secrets = normalizeSecretEntries(secretEntries);
  const findings = [];
  const files = await collectFiles(root);

  for (const file of files) {
    const contents = await readFile(file);

    for (const secret of secrets) {
      if (!contents.includes(secret.bytes)) {
        continue;
      }

      findings.push({
        envName: secret.envName,
        path: relative(root, file) || ".",
      });
    }
  }

  return findings;
}

export function formatArtifactSecretLeakFailure(findings) {
  const matches = [];

  for (const finding of findings) {
    matches.push(`${finding.envName} in ${finding.path}`);
  }

  const summary = matches.join(", ");
  const prefix = "artifact-secret-scan: server secret material detected";
  return `${prefix} in production artifact (${summary})`;
}

async function main() {
  const [rootDirectory = ".output", ...envNames] = process.argv.slice(2);

  if (envNames.length === 0) {
    throw new Error(
      "artifact-secret-scan: provide at least one environment variable name",
    );
  }

  const entries = [];

  for (const envName of envNames) {
    entries.push([envName, process.env[envName] ?? ""]);
  }

  const findings = await findArtifactSecretLeaks(rootDirectory, entries);

  if (findings.length > 0) {
    throw new Error(formatArtifactSecretLeakFailure(findings));
  }

  const count = envNames.length;
  console.log(
    `artifact-secret-scan: verified ${count} server secret(s) are absent`,
  );
  console.log(`artifact-secret-scan: artifact root ${rootDirectory}`);
}

if (import.meta.main) {
  await main();
}
