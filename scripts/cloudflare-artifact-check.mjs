import { access, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const root = process.cwd();
const sourceConfigPath = resolve(root, "wrangler.json");
const redirectPath = resolve(root, ".wrangler/deploy/config.json");
const generatedConfigPath = resolve(root, ".output/server/wrangler.json");
const expectedWorkerEntryPath = resolve(root, ".output/server/index.mjs");
const expectedPublicDir = resolve(root, ".output/public");

function fail(message) {
  throw new Error(`Cloudflare-artifact ogiltigt: ${message}`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function assertMissing(path, label) {
  try {
    await access(path);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
  fail(`${label} får inte finnas när wrangler.json är deploy-source of truth.`);
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

  if (config.no_bundle !== true) {
    fail(`${label} måste deploya den redan byggda Nitro-artefakten med no_bundle=true.`);
  }

  if (typeof config.main !== "string") {
    fail(`${label} saknar Worker-entrypoint.`);
  }
  const workerEntryPath = resolve(root, config.main);
  if (workerEntryPath !== expectedWorkerEntryPath) {
    fail(`Worker-entrypoint är oväntad: ${relative(root, workerEntryPath)}.`);
  }

  if (!config.assets || typeof config.assets.directory !== "string") {
    fail(`${label} saknar katalog för statiska assets.`);
  }
  const publicDir = resolve(root, config.assets.directory);
  if (publicDir !== expectedPublicDir) {
    fail(`asset-katalogen är oväntad: ${relative(root, publicDir)}.`);
  }

  const esModuleRule = Array.isArray(config.rules)
    ? config.rules.find((rule) => rule?.type === "ESModule")
    : undefined;
  const globs = Array.isArray(esModuleRule?.globs) ? esModuleRule.globs : [];
  if (!globs.includes("**/*.mjs") || !globs.includes("**/*.js")) {
    fail(`${label} måste inkludera Nitros JS/MJS-moduler i no_bundle-deploymenten.`);
  }

  const compatibilityFlags = Array.isArray(config.compatibility_flags)
    ? config.compatibility_flags
    : [];
  if (
    typeof config.compatibility_date === "string" &&
    config.compatibility_date >= "2026-08-04" &&
    compatibilityFlags.includes("nodejs_compat")
  ) {
    fail(`${label} får inte ange nodejs_compat explicit från compatibility date 2026-08-04.`);
  }

  assertNoInlineRuntimeConfig(config, label);
  assertEnvironment(config, "staging", "staging", true, label);
  assertEnvironment(config, "prod", "app", false, label);
}

const sourceConfig = await readJson(sourceConfigPath);
assertMatrundanCloudflareConfig(sourceConfig, "wrangler.json");

// Nitro får bygga Worker-koden men inte skriva en redirected deploy-konfiguration;
// Wrangler environments ska lösas från repoets egna wrangler.json vid deploy.
await assertMissing(redirectPath, ".wrangler/deploy/config.json");
await assertMissing(generatedConfigPath, ".output/server/wrangler.json");

await access(expectedWorkerEntryPath);
await access(resolve(expectedPublicDir, "manifest.webmanifest"));
await access(resolve(expectedPublicDir, "push-sw.js"));

console.log(
  "Cloudflare-artifact godkänt: wrangler.json äger staging/prod, Nitro-artefakten finns och ingen redirected deploy-config kan kringgå miljökontraktet.",
);
