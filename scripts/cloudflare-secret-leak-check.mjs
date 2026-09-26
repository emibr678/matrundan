import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }

  return files;
}

export async function findArtifactSecretLeaks(rootDirectory, secretEntries) {
  const root = resolve(rootDirectory);
  const secrets = secretEntries.map(([envName, value]) => {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`artifact-secret-scan: missing required value for ${envName}`);
    }
    if (value.length < 16) {
      throw new Error(`artifact-secret-scan: ${envName} is unexpectedly short`);
    }
    return { envName, bytes: Buffer.from(value, "utf8") };
  });

  const findings = [];
  for (const file of await collectFiles(root)) {
    const contents = await readFile(file);
    for (const secret of secrets) {
      if (contents.includes(secret.bytes)) {
        findings.push({
          envName: secret.envName,
          path: relative(root, file) || ".",
        });
      }
    }
  }

  return findings;
}

export function formatArtifactSecretLeakFailure(findings) {
  const summary = findings
    .map((finding) => `${finding.envName} in ${finding.path}`)
    .join(", ");
  return `artifact-secret-scan: server secret material detected in production artifact (${summary})`;
}

async function main() {
  const [rootDirectory = ".output", ...envNames] = process.argv.slice(2);
  if (envNames.length === 0) {
    throw new Error(
      "artifact-secret-scan: provide at least one environment variable name to verify",
    );
  }

  const entries = envNames.map((envName) => [envName, process.env[envName] ?? ""]);
  const findings = await findArtifactSecretLeaks(rootDirectory, entries);
  if (findings.length > 0) {
    throw new Error(formatArtifactSecretLeakFailure(findings));
  }

  console.log(
    `artifact-secret-scan: verified ${envNames.length} server secret(s) are absent from ${rootDirectory}`,
  );
}

if (import.meta.main) {
  await main();
}
