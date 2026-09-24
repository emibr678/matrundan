import { describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const roots = [
  resolve(process.cwd(), ".github/workflows"),
  resolve(process.cwd(), ".github/actions"),
];

function yamlFiles(root: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root)) {
    const path = resolve(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...yamlFiles(path));
      continue;
    }
    if (entry.endsWith(".yml") || entry.endsWith(".yaml")) {
      files.push(path);
    }
  }

  return files.sort();
}

const files = roots.flatMap(yamlFiles);

describe("GitHub Actions supply-chain contract", () => {
  test.each(files)("%s pins every external action to a full commit SHA", (file) => {
    const source = Bun.file(file).text();
    return source.then((workflow) => {
      const targets = workflow
        .split("\n")
        .map((line) => line.match(/^\s*-?\s*uses:\s*([^\s#]+)/)?.[1])
        .filter((target): target is string => Boolean(target));

      for (const target of targets) {
        if (target.startsWith("./")) continue;
        expect(
          target,
          `${relative(process.cwd(), file)} must pin ${target} to a full 40-character commit SHA`,
        ).toMatch(/^[^@\s]+@[0-9a-f]{40}$/);
      }
    });
  });
});
