import { execFileSync } from "node:child_process";

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function fail(message) {
  console.error(`public-readiness: ${message}`);
  process.exitCode = 1;
}

function trackedFiles(ref = "HEAD") {
  return git(["ls-tree", "-r", "--name-only", ref])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseEnv(content) {
  const entries = new Map();
  for (const [index, rawLine] of content.split("\n").entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) {
      fail(`ogiltig env-rad på rad ${index + 1}`);
      continue;
    }
    const [, key, value] = match;
    if (entries.has(key)) fail(`duplicerad env-variabel: ${key}`);
    entries.set(key, value);
  }
  return entries;
}

const allowedEnvFiles = new Set([".env", ".env.example"]);
const secretFilePatterns = [
  /^\.env(?:\.|$)/,
  /\.pem$/i,
  /\.key$/i,
  /(?:^|\/)id_(?:rsa|dsa|ecdsa|ed25519)$/i,
  /(?:^|\/)credentials(?:\.[^/]*)?$/i,
];

const currentTracked = trackedFiles();
const unsafeTrackedPaths = currentTracked.filter((path) => {
  if (allowedEnvFiles.has(path)) return false;
  return secretFilePatterns.some((pattern) => pattern.test(path));
});

if (unsafeTrackedPaths.length > 0) {
  fail(`secret-liknande filer är versionshanterade: ${unsafeTrackedPaths.join(", ")}`);
}

const allowedTrackedEnvKeys = new Set([
  "SUPABASE_PROJECT_ID",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_URL",
  "VITE_SUPABASE_PROJECT_ID",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_URL",
  "VITE_GEOAPIFY_MAPS_KEY",
]);

let trackedEnv = "";
try {
  trackedEnv = git(["show", "HEAD:.env"]);
} catch {
  fail("Lovables versionshanterade .env saknas från HEAD");
}

const trackedEnvEntries = parseEnv(trackedEnv);
for (const key of trackedEnvEntries.keys()) {
  if (!allowedTrackedEnvKeys.has(key)) {
    fail(`.env innehåller en icke-godkänd variabel: ${key}`);
  }
}
for (const key of allowedTrackedEnvKeys) {
  if (!trackedEnvEntries.has(key)) {
    fail(`.env saknar Lovable/public konfiguration: ${key}`);
  }
}

const suspiciousValuePatterns = [
  "sb_secret_[A-Za-z0-9._-]{20,}",
  "github_pat_[A-Za-z0-9_]{40,}",
  "ghp_[A-Za-z0-9]{30,}",
  "AKIA[0-9A-Z]{16}",
  "-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----",
];
const combinedPattern = suspiciousValuePatterns.join("|");

const trackedEnvForbiddenNamePattern = /(SECRET|SERVICE_ROLE|PRIVATE_KEY|PASSWORD|DATABASE_URL|ACCESS_TOKEN)/i;
for (const key of trackedEnvEntries.keys()) {
  if (trackedEnvForbiddenNamePattern.test(key)) {
    fail(`.env innehåller ett secret-liknande variabelnamn: ${key}`);
  }
}

let historyMatch = false;
try {
  const revisions = git(["rev-list", "--all"])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = 0; index < revisions.length; index += 50) {
    const batch = revisions.slice(index, index + 50);
    try {
      const output = execFileSync(
        "git",
        ["grep", "-I", "-l", "-E", combinedPattern, ...batch],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        },
      ).trim();
      if (output) {
        const paths = Array.from(
          new Set(
            output
              .split("\n")
              .map((line) => line.replace(/^[0-9a-f]{40}:/, ""))
              .filter(Boolean),
          ),
        );
        console.error(
          `public-readiness: misstänkt hemlighetsmönster finns i nåbar Git-historik (${paths.join(", ")}). Värden skrivs inte ut.`,
        );
        historyMatch = true;
        break;
      }
    } catch (error) {
      if (error?.status !== 1) throw error;
    }
  }
} catch (error) {
  fail(`kunde inte skanna Git-historiken: ${error instanceof Error ? error.message : String(error)}`);
}

if (historyMatch) process.exitCode = 1;

const requiredTemplateMarkers = [
  "SUPABASE_PUBLISHABLE_KEY=",
  "VITE_GEOAPIFY_MAPS_KEY=",
  "SUPABASE_SERVICE_ROLE_KEY=",
  "GEOAPIFY_API_KEY=",
  "VAPID_PRIVATE_KEY=",
];

let envExample = "";
try {
  envExample = git(["show", "HEAD:.env.example"]);
} catch {
  fail(".env.example saknas från HEAD");
}

for (const marker of requiredTemplateMarkers) {
  if (!envExample.includes(marker)) {
    fail(`.env.example saknar ${marker}`);
  }
}

if (!process.exitCode) {
  console.log(
    "public-readiness: tracked Lovable-env, current tree och nåbar Git-historik passerar grundkontrollen. Gör även manuell granskning av issues, PR:er, Actions-loggar, branches och licens innan visibility ändras.",
  );
}
