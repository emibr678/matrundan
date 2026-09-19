#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, extname, relative, resolve } from "node:path";
import { format } from "prettier";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const root = process.cwd();
const srcRoot = resolve(root, "src");
const routesRoot = resolve(srcRoot, "routes");
const uiRoot = resolve(srcRoot, "components/ui");

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function isSourceFile(path) {
  return SOURCE_EXTENSIONS.includes(extname(path)) && !path.includes(".test.");
}

function resolveSourceImport(importer, specifier) {
  let candidate;
  if (specifier.startsWith("@/")) {
    candidate = resolve(srcRoot, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    candidate = resolve(dirname(importer), specifier);
  } else {
    return null;
  }

  const attempts = [
    candidate,
    ...SOURCE_EXTENSIONS.map((extension) => `${candidate}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => resolve(candidate, `index${extension}`)),
  ];

  return attempts.find((path) => existsSync(path) && statSync(path).isFile()) ?? null;
}

function importSpecifiers(source) {
  const specifiers = new Set();
  const patterns = [
    /(?:import|export)\s+(?:type\s+)?[^"']*?\sfrom\s*["']([^"']+)["']/g,
    /import\s*["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) specifiers.add(match[1]);
    }
  }

  return [...specifiers];
}

const sourceFiles = walk(srcRoot).filter(isSourceFile);
const graph = new Map(
  sourceFiles.map((file) => {
    const imports = importSpecifiers(readFileSync(file, "utf8"))
      .map((specifier) => resolveSourceImport(file, specifier))
      .filter(Boolean);
    return [file, imports];
  }),
);

const roots = sourceFiles.filter(
  (file) => dirname(file) === srcRoot || file === routesRoot || file.startsWith(`${routesRoot}/`),
);
const reachable = new Set();
const pending = [...roots];

while (pending.length > 0) {
  const file = pending.pop();
  if (!file || reachable.has(file)) continue;
  reachable.add(file);
  for (const dependency of graph.get(file) ?? []) {
    if (!reachable.has(dependency)) pending.push(dependency);
  }
}

const uiFiles = walk(uiRoot).filter(isSourceFile);
const unusedUiFiles = uiFiles
  .filter((file) => !reachable.has(file))
  .map((file) => relative(root, file))
  .sort((left, right) => left.localeCompare(right));

if (unusedUiFiles.length > 0) {
  console.error("Oanvända UI-primitiver hittades:");
  unusedUiFiles.forEach((file) => console.error(`- ${file}`));
  console.error(
    "Ta bort filerna eller koppla dem till ett verkligt appflöde. Behåll inte shadcn-primitiver enbart för tänkbar framtida användning.",
  );
  process.exit(1);
}

console.log(`Dead-code-kontroll godkänd: ${uiFiles.length} nåbara UI-primitiver.`);


const formatDiagnosticTargets = [
  "src/components/matrundan/VisitDetailSheet.tsx",
  "src/components/matrundan/VisitPhotoManager.tsx",
  "src/lib/matrundan/store.tsx",
  "src/lib/matrundan/visit-photo.test.ts",
  "src/lib/matrundan/visit-photo.ts",
];

for (const target of formatDiagnosticTargets) {
  const absolute = resolve(root, target);
  const source = readFileSync(absolute, "utf8");
  const formatted = await format(source, { filepath: absolute });
  if (formatted === source) continue;

  const temporary = resolve("/tmp", target.replaceAll("/", "__"));
  writeFileSync(temporary, formatted, "utf8");
  console.log(`FORMAT-DIFF-BEGIN ${target}`);
  try {
    execFileSync(
      "git",
      ["diff", "--no-index", "--no-color", "--", absolute, temporary],
      { encoding: "utf8" },
    );
  } catch (error) {
    const output = error?.stdout?.toString?.() ?? "";
    console.log(output.replaceAll(temporary, absolute));
  } finally {
    unlinkSync(temporary);
  }
  console.log(`FORMAT-DIFF-END ${target}`);
}
