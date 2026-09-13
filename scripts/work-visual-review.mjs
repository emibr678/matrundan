import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { chmod, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createBrotliDecompress } from "node:zlib";
import {
  WORK_CHROMIUM_ARGS,
  WORK_CHROMIUM_DOWNLOAD,
  WORK_CHROMIUM_VERSION,
} from "./work-browser-config.ts";

const commandArguments = process.argv.slice(2).filter((argument) => argument !== "--");
const prepareOnly = commandArguments.length === 1 && commandArguments[0] === "--prepare";
const includeDesktop = commandArguments.includes("--desktop");
const routes = commandArguments.filter((argument) => argument !== "--desktop");

if (!prepareOnly && routes.length === 0) {
  console.error(
    "Ange minst en route, exempelvis: bun run test:visual-smoke:work -- /matstallen?demo=1",
  );
  process.exit(2);
}

if (process.platform !== "linux" || process.arch !== "x64") {
  console.error(
    "Work-browsern stöder endast Linux x64. Använd den vanliga Playwright-installationen i andra miljöer.",
  );
  process.exit(1);
}

const cacheBase = process.env.MATRUNDAN_WORK_BROWSER_CACHE
  ? path.resolve(process.env.MATRUNDAN_WORK_BROWSER_CACHE)
  : path.join(homedir(), ".cache", "matrundan", "work-browser");
const cacheDirectory = path.join(cacheBase, `chromium-${WORK_CHROMIUM_VERSION}-x64`);
const archivePath = path.join(cacheDirectory, "chromium-pack.tar");
const packDirectory = path.join(cacheDirectory, "pack");
const runtimeDirectory = path.join(cacheDirectory, "runtime");
const executablePath = path.join(runtimeDirectory, "chromium");
const markerPath = path.join(runtimeDirectory, "ready.json");

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function sha256(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function run(command, options = {}) {
  const child = Bun.spawn(command, {
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? process.env,
    stdin: options.stdin ?? "inherit",
    stdout: options.stdout ?? "inherit",
    stderr: options.stderr ?? "inherit",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    throw new Error(`Kommandot misslyckades (${exitCode}): ${command.join(" ")}`);
  }
}

async function downloadArchive() {
  await mkdir(cacheDirectory, { recursive: true });

  if (await exists(archivePath)) {
    const cachedDigest = await sha256(archivePath);
    if (cachedDigest === WORK_CHROMIUM_DOWNLOAD.sha256) return;
    console.warn("Den cachade Chromium-arkiven har fel checksumma och hämtas om.");
    await rm(archivePath, { force: true });
  }

  const temporaryArchive = `${archivePath}.download-${process.pid}`;
  await rm(temporaryArchive, { force: true });
  console.log(`Hämtar portabel Chromium ${WORK_CHROMIUM_VERSION} för Work …`);
  try {
    await run([
      "curl",
      "-fL",
      "--retry",
      "2",
      "--connect-timeout",
      "15",
      "--max-time",
      "180",
      "--output",
      temporaryArchive,
      WORK_CHROMIUM_DOWNLOAD.url,
    ]);

    const downloadedDigest = await sha256(temporaryArchive);
    if (downloadedDigest !== WORK_CHROMIUM_DOWNLOAD.sha256) {
      throw new Error(
        `Chromium-arkiven har fel checksumma: ${downloadedDigest} (förväntad ${WORK_CHROMIUM_DOWNLOAD.sha256}).`,
      );
    }
    await rename(temporaryArchive, archivePath);
  } finally {
    await rm(temporaryArchive, { force: true });
  }
}

async function inflateFile(sourcePath, targetPath, mode) {
  await pipeline(
    createReadStream(sourcePath),
    createBrotliDecompress(),
    createWriteStream(targetPath),
  );
  if (mode !== undefined) await chmod(targetPath, mode);
}

async function inflateTar(sourcePath, targetDirectory, temporaryName) {
  const temporaryTar = path.join(cacheDirectory, temporaryName);
  await mkdir(targetDirectory, { recursive: true });
  try {
    await inflateFile(sourcePath, temporaryTar);
    await run(["tar", "--no-same-owner", "-xf", temporaryTar, "-C", targetDirectory]);
  } finally {
    await rm(temporaryTar, { force: true });
  }
}

async function runtimeIsReady() {
  if (!(await exists(executablePath)) || !(await exists(markerPath))) return false;
  try {
    const marker = JSON.parse(await readFile(markerPath, "utf8"));
    return (
      marker.version === WORK_CHROMIUM_VERSION && marker.sha256 === WORK_CHROMIUM_DOWNLOAD.sha256
    );
  } catch {
    return false;
  }
}

async function prepareRuntime() {
  if (await runtimeIsReady()) return;

  await downloadArchive();
  await rm(packDirectory, { recursive: true, force: true });
  await rm(runtimeDirectory, { recursive: true, force: true });
  await mkdir(packDirectory, { recursive: true });
  await mkdir(runtimeDirectory, { recursive: true });

  console.log("Packar upp den verifierade Chromium-runtimen …");
  await run(["tar", "--no-same-owner", "-xf", archivePath, "-C", packDirectory]);
  await Promise.all([
    inflateFile(path.join(packDirectory, "chromium.br"), executablePath, 0o700),
    inflateTar(
      path.join(packDirectory, "swiftshader.tar.br"),
      runtimeDirectory,
      `swiftshader-${process.pid}.tar`,
    ),
    inflateTar(
      path.join(packDirectory, "fonts.tar.br"),
      path.join(runtimeDirectory, "fonts"),
      `fonts-${process.pid}.tar`,
    ),
  ]);

  const fontDirectory = path.join(runtimeDirectory, "fonts", "fonts");
  const fontCache = path.join(runtimeDirectory, "font-cache");
  const escapeXml = (value) =>
    value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  await writeFile(
    path.join(runtimeDirectory, "fonts.local.conf"),
    `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n  <dir>${escapeXml(fontDirectory)}</dir>\n  <cachedir>${escapeXml(fontCache)}</cachedir>\n  <config></config>\n</fontconfig>\n`,
  );
  await writeFile(
    markerPath,
    `${JSON.stringify({ version: WORK_CHROMIUM_VERSION, sha256: WORK_CHROMIUM_DOWNLOAD.sha256 })}\n`,
  );
  await rm(packDirectory, { recursive: true, force: true });
}

await prepareRuntime();
console.log(`Work-browser klar: ${executablePath}`);

if (!prepareOnly) {
  const browserEnvironment = {
    ...process.env,
    MATRUNDAN_WORK_CHROMIUM_EXECUTABLE_PATH: executablePath,
    MATRUNDAN_WORK_CHROMIUM_ARGS: JSON.stringify(WORK_CHROMIUM_ARGS),
    FONTCONFIG_FILE: path.join(runtimeDirectory, "fonts.local.conf"),
    LD_LIBRARY_PATH: [runtimeDirectory, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":"),
  };

  for (const [index, route] of routes.entries()) {
    const environment = { ...browserEnvironment };
    if (index > 0) environment.VISUAL_REVIEW_PRESERVE_EXISTING = "1";
    await run(
      ["bun", "run", "test:visual-smoke", "--", route, ...(includeDesktop ? ["--desktop"] : [])],
      { env: environment },
    );
  }
}
