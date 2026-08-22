import { access, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

const root = process.cwd();
const sourceConfigPath = resolve(root, "wrangler.json");
const redirectPath = resolve(root, ".wrangler/deploy/config.json");
const expectedGeneratedConfigPath = resolve(root, ".output/server/wrangler.json");
const expectedWorkerEntryPath = resolve(root, ".output/server/index.mjs");
const expectedPublicDir = resolve(root, ".output/public");

function fail(message) {
  throw new Error(`Cloudflare-artifact ogiltigt: ${message}`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function assertNoInlineRuntimeConfig(config, label) {
  for (const forbiddenKey of ["route", "routes", "triggers", "vars"]) {
    if (forbiddenKey in config) {
      fail(`${label} får inte innehålla ${forbiddenKey} i den isolerade migrationsfasen.`);
    }
  }
}

function assertEnvironment(config, envName, workerName, previewUrls, label) {
  const environment = config.env?.[envName];
  if (!environment || typeof environment !== "object") {
    fail(`${label} saknar Wrangler-miljön ${envName}.`);
  }
  if (environment.name !== workerName) {
    fail(`${label} måste låta ${envName} använda Worker-namnet ${workerName}.`);
  }
  if (environment.workers_dev !== true) {
    fail(`${label} måste låta ${envName} använda workers.dev.`);
  }
  if (environment.preview_urls !== previewUrls) {
    fail(`${label} måste ha preview_urls=${String(previewUrls)} för ${envName}.`);
  }
  assertNoInlineRuntimeConfig(environment, `${label} (${envName})`);
}

function assertMatrundanCloudflareConfig(config, label) {
  // Defaulten är medvetet staging så ett glömt --env aldrig kan publicera prod.
  if (config.name !== "staging") {
    fail(`${label} måste använda staging som säker default-Worker.`);
  }

  if (config.workers_dev !== true || config.preview_urls !== true) {
    fail(`${label} måste ha workers.dev och preview-URL:er aktiverade för staging-defaulten.`);
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

  assertNoInlineRuntimeConfig(config, label);
  assertEnvironment(config, "staging", "staging", true, label);
  assertEnvironment(config, "prod", "app", false, label);
}

const sourceConfig = await readJson(sourceConfigPath);
assertMatrundanCloudflareConfig(sourceConfig, "wrangler.json");

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
assertMatrundanCloudflareConfig(generatedConfig, "genererad Wrangler-konfiguration");

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
  "Cloudflare-artifact godkänt: staging/prod-kontrakt, Worker-entrypoint, statiska assets och deploy-redirect är isolerade och reproducerbara.",
);
