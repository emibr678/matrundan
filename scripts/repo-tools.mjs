#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const FORMAT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
]);
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const ALTERNATE_LOCKFILES = [
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
];
const MAP_FILES = new Set([
  "src/components/matrundan/PlaceMap.tsx",
  "src/lib/matrundan/maplibre-client.ts",
  "playwright.config.ts",
  "tests/e2e/mobile-matstallen.spec.ts",
]);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...options.env },
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    if (options.capture) {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    }
    process.exit(result.status ?? 1);
  }

  return result;
}

function capture(command, args, allowFailure = false) {
  const result = run(command, args, { capture: true, allowFailure });
  return result.status === 0 ? result.stdout.trim() : "";
}

function git(args, allowFailure = false) {
  return capture("git", args, allowFailure);
}

function lines(value) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function repositoryRoot() {
  const root = git(["rev-parse", "--show-toplevel"], true);
  return root || process.cwd();
}

const root = repositoryRoot();
process.chdir(root);

const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const packageManagerMatch = /^bun@(\d+\.\d+\.\d+)$/.exec(packageJson.packageManager ?? "");
const expectedBunVersion = packageManagerMatch?.[1] ?? null;

function validCommit(candidate) {
  if (!candidate) return false;
  const result = spawnSync("git", ["cat-file", "-e", `${candidate}^{commit}`], {
    cwd: root,
    stdio: "ignore",
  });
  return result.status === 0;
}

function resolveBase(explicitBase) {
  const candidates = [
    explicitBase,
    process.env.MATRUNDAN_BASE_SHA,
    git(["merge-base", "HEAD", "origin/main"], true),
    git(["rev-parse", "HEAD^"], true),
  ];

  return candidates.find(validCommit) ?? null;
}

function collectChangedFiles(explicitBase) {
  const files = new Set();
  const base = resolveBase(explicitBase);

  if (base) {
    lines(git(["diff", "--name-only", "--diff-filter=ACMR", base, "HEAD"], true)).forEach(
      (file) => files.add(file),
    );
  }

  lines(git(["diff", "--name-only", "--diff-filter=ACMR"], true)).forEach((file) =>
    files.add(file),
  );
  lines(git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"], true)).forEach(
    (file) => files.add(file),
  );
  lines(git(["ls-files", "--others", "--exclude-standard"], true)).forEach((file) =>
    files.add(file),
  );

  return [...files]
    .filter((file) => existsSync(resolve(root, file)))
    .sort((left, right) => left.localeCompare(right));
}

function isFormatFile(file) {
  return FORMAT_EXTENSIONS.has(extname(file));
}

function isCodeFile(file) {
  return CODE_EXTENSIONS.has(extname(file));
}

function isUiFile(file) {
  return (
    file.startsWith("src/components/") ||
    file.startsWith("src/routes/") ||
    file.startsWith("tests/e2e/") ||
    file === "playwright.config.ts" ||
    (file.startsWith("src/") && (file.endsWith(".tsx") || file.endsWith(".css")))
  );
}

function isMapFile(file) {
  return MAP_FILES.has(file);
}

function classify(files) {
  return {
    all: files,
    format: files.filter(isFormatFile),
    code: files.filter(isCodeFile),
    ui: files.filter(isUiFile),
    map: files.filter(isMapFile),
    workflows: files.filter((file) => file.startsWith(".github/workflows/")),
    dependencies: files.filter((file) => file === "package.json" || file === "bun.lock"),
  };
}

function printFiles(files) {
  if (files.length > 0) process.stdout.write(`${files.join("\n")}\n`);
}

function runForFiles(command, prefixArgs, files, emptyMessage) {
  if (files.length === 0) {
    console.log(emptyMessage);
    return;
  }
  run(command, [...prefixArgs, ...files]);
}

function doctor() {
  const errors = [];
  const warnings = [];
  const actualBunVersion = process.versions.bun ?? null;
  const branch = git(["branch", "--show-current"], true) || "frånkopplad HEAD";
  const status = lines(git(["status", "--porcelain"], true));

  if (!expectedBunVersion) {
    errors.push('package.json måste ange ett exakt "packageManager": "bun@x.y.z".');
  } else if (actualBunVersion !== expectedBunVersion) {
    errors.push(
      `Bun ${expectedBunVersion} krävs, men ${actualBunVersion ?? "ingen Bun-runtime"} körs.`,
    );
  }

  if (!existsSync(resolve(root, "bun.lock"))) errors.push("bun.lock saknas.");
  if (!existsSync(resolve(root, "node_modules"))) {
    errors.push("node_modules saknas. Kör bash scripts/bootstrap-agent.sh.");
  }

  for (const lockfile of ALTERNATE_LOCKFILES) {
    if (existsSync(resolve(root, lockfile))) {
      errors.push(`Otillåten alternativ lockfil hittades: ${lockfile}.`);
    }
  }

  if (!existsSync(resolve(root, ".git"))) warnings.push("Ingen lokal .git-katalog hittades.");
  if (status.length > 0) {
    warnings.push(`Arbetsytan har ${status.length} ändrad eller otrackad fil.`);
  }

  console.log("Matrundan doctor");
  console.log(`- repo: ${root}`);
  console.log(`- branch: ${branch}`);
  console.log(
    `- Bun: ${actualBunVersion ?? "saknas"} (förväntad ${expectedBunVersion ?? "ogiltig"})`,
  );
  console.log(
    `- beroenden: ${existsSync(resolve(root, "node_modules")) ? "installerade" : "saknas"}`,
  );
  console.log(`- arbetsyta: ${status.length === 0 ? "ren" : `${status.length} ändring(ar)`}`);

  warnings.forEach((warning) => console.warn(`Varning: ${warning}`));
  errors.forEach((error) => console.error(`Fel: ${error}`));

  if (errors.length > 0) process.exit(1);
}

function readBasePackage(base) {
  if (!base) return null;
  const raw = git(["show", `${base}:package.json`], true);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function guardTooling(explicitBase) {
  const base = resolveBase(explicitBase);
  const changed = classify(collectChangedFiles(base));
  const changedSet = new Set(changed.all);
  const basePackage = readBasePackage(base);

  if (changedSet.has("bun.lock") && !changedSet.has("package.json")) {
    console.error("bun.lock har ändrats utan package.json. Återställ oavsiktlig lockfilsdrift.");
    process.exit(1);
  }

  if (basePackage && changedSet.has("package.json")) {
    const before = JSON.stringify({
      dependencies: basePackage.dependencies ?? {},
      devDependencies: basePackage.devDependencies ?? {},
    });
    const after = JSON.stringify({
      dependencies: packageJson.dependencies ?? {},
      devDependencies: packageJson.devDependencies ?? {},
    });

    if (before !== after && !changedSet.has("bun.lock")) {
      console.error("Beroenden har ändrats i package.json utan motsvarande bun.lock-ändring.");
      process.exit(1);
    }
  }

  if (changed.workflows.length > 0) {
    console.warn(`Workflowändringar kräver uttrycklig granskning: ${changed.workflows.join(", ")}`);
  }

  console.log("Verktygs- och lockfilsskydd godkänt.");
}

function formatChanged(checkOnly, explicitBase) {
  const files = classify(collectChangedFiles(explicitBase)).format;
  runForFiles(
    "bunx",
    ["prettier", checkOnly ? "--check" : "--write"],
    files,
    "Inga ändrade filer stöds av Prettier.",
  );
}

function lintChanged(explicitBase) {
  const files = classify(collectChangedFiles(explicitBase)).code;
  runForFiles("bunx", ["eslint"], files, "Inga ändrade kodfiler behöver ESLint.");
}

function verifyChanged(explicitBase) {
  doctor();
  guardTooling(explicitBase);
  formatChanged(true, explicitBase);
  lintChanged(explicitBase);
  run("bun", ["run", "test:unit"]);
  run("bun", ["run", "typecheck"]);
  run("bun", ["run", "build"]);
}

function verifyAgent(explicitBase) {
  verifyChanged(explicitBase);
  const changed = classify(collectChangedFiles(explicitBase));

  if (changed.ui.length > 0) {
    run("bun", ["run", "test:mobile"]);
  } else {
    console.log("Browserkontroll behövs inte: inga UI-filer har ändrats.");
  }

  if (changed.map.length > 0) {
    if (process.env.MATRUNDAN_VERIFY_WEBKIT === "1") {
      run("bun", ["run", "test:map:cross-browser"]);
    } else {
      console.log(
        "Kartans WebKit/desktop-matris körs av redo-CI. Sätt MATRUNDAN_VERIFY_WEBKIT=1 för lokal körning.",
      );
    }
  }
}

function ciFlags(explicitBase) {
  const base = resolveBase(explicitBase);
  const changed = classify(collectChangedFiles(base));
  const bool = (value) => (value ? "true" : "false");

  console.log(`base_sha=${base ?? ""}`);
  console.log(`has_format=${bool(changed.format.length > 0)}`);
  console.log(`has_code=${bool(changed.code.length > 0)}`);
  console.log(`has_ui=${bool(changed.ui.length > 0)}`);
  console.log(`has_map=${bool(changed.map.length > 0)}`);
  console.log(`has_workflow=${bool(changed.workflows.length > 0)}`);
  console.log(`has_dependencies=${bool(changed.dependencies.length > 0)}`);
}

const [command = "help", ...args] = process.argv.slice(2);
const explicitBase = args.find((arg) => !arg.startsWith("--"));

switch (command) {
  case "doctor":
    doctor();
    break;
  case "changed-files": {
    const group =
      args.find((arg) => ["all", "format", "code", "ui", "map"].includes(arg)) ?? "all";
    printFiles(classify(collectChangedFiles(explicitBase))[group]);
    break;
  }
  case "format-changed":
    formatChanged(args.includes("--check"), explicitBase);
    break;
  case "lint-changed":
    lintChanged(explicitBase);
    break;
  case "guard-tooling":
    guardTooling(explicitBase);
    break;
  case "verify-changed":
    verifyChanged(explicitBase);
    break;
  case "verify-agent":
    verifyAgent(explicitBase);
    break;
  case "ci-flags":
    ciFlags(explicitBase);
    break;
  default:
    console.log(`Användning: bun scripts/repo-tools.mjs <kommando>\n\nKommandon:\n  doctor\n  changed-files [all|format|code|ui|map]\n  format-changed [--check]\n  lint-changed\n  guard-tooling\n  verify-changed\n  verify-agent\n  ci-flags`);
    if (command !== "help") process.exit(1);
}
