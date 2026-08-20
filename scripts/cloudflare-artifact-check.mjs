import { access, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

const root = process.cwd();
const sourceConfigPath = resolve(root, "wrangler.json");
const redirectPath = resolve(root, ".wrangler/deploy/config.json");
const expectedGeneratedConfigPath = resolve(root, ".output/server/wrangler.json");
const expectedWorkerEntryPath = resolve(root, ".output/server/index.mjs");
const expectedPublicDir = resolve(root, ".output/public");

function fail(message) {
  throw new Error(`Cloudflare staging-artifact ogiltigt: ${message}`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function assertStagingOnlyConfig(config, label) {
  if (config.name !== "matrundan-staging") {
    fail(`${label} måste använda Worker-namnet matrundan-staging.`);
  }

  if (config.workers_dev !== true || config.preview_urls !== true) {
    fail(`${label} måste vara begränsad till workers.dev med preview-URL:er aktiverade.`);
  }

  if (config.keep_vars !== true) {
    fail(`${label} måste behålla runtime-variabler som hanteras utanför repot.`);
  }

  const compatibilityFlags = Array.isArray(config.compatibility_flags)
    ? config.compatibility_flags
    : [];
  if (!compatibilityFlags.includes("nodejs_compat")) {
    fail(`${label} måste behålla nodejs_compat för nuvarande runtime.`);
  }

  for (const forbiddenKey of ["route", "routes", "triggers", "vars"]) {
    if (forbiddenKey in config) {
      fail(`${label} får inte innehålla ${forbiddenKey} i den isolerade stagingfasen.`);
    }
  }
}

const sourceConfig = await readJson(sourceConfigPath);
assertStagingOnlyConfig(sourceConfig, "wrangler.json");

const redirect = await readJson(redirectPath);
if (typeof redirect.configPath !== "string" || !redirect.configPath.trim()) {
  fail("Nitro skapade ingen giltig Wrangler-redirect.");
}

const generatedConfigPath = resolve(dirname(redirectPath), redirect.configPath);
if (generatedConfigPath !== expectedGeneratedConfigPath) {
  fail(
    `Wrangler-redirecten pekar på ${relative(root, generatedConfigPath)} i stället för .output/server/wrangler.json.`,
  );
}

const generatedConfig = await readJson(generatedConfigPath);
assertStagingOnlyConfig(generatedConfig, "genererad Wrangler-konfiguration");

if (typeof generatedConfig.main !== "string") {
  fail("den genererade konfigurationen saknar Worker-entrypoint.");
}
const workerEntryPath = resolve(dirname(generatedConfigPath), generatedConfig.main);
if (workerEntryPath !== expectedWorkerEntryPath) {
  fail(`Worker-entrypoint är oväntad: ${relative(root, workerEntryPath)}.`);
}
await access(workerEntryPath);

if (!generatedConfig.assets || typeof generatedConfig.assets.directory !== "string") {
  fail("den genererade konfigurationen saknar katalog för statiska assets.");
}
const publicDir = resolve(dirname(generatedConfigPath), generatedConfig.assets.directory);
if (publicDir !== expectedPublicDir) {
  fail(`asset-katalogen är oväntad: ${relative(root, publicDir)}.`);
}
await access(resolve(publicDir, "manifest.webmanifest"));
await access(resolve(publicDir, "push-sw.js"));

console.log(
  "Cloudflare staging-artifact godkänt: matrundan-staging, Worker-entrypoint, statiska assets och deploy-redirect är isolerade och reproducerbara.",
);
