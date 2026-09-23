import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

function yamlFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) {
      files.push(...yamlFiles(path));
    } else if (path.endsWith(".yml") || path.endsWith(".yaml")) {
      files.push(path);
    }
  }
  return files.sort();
}

const roots = [
  resolve(process.cwd(), ".github/workflows"),
  resolve(process.cwd(), ".github/actions"),
];

describe("GitHub Actions supply-chain-kontrakt", () => {
  test("alla externa actions är SHA-pinnade", () => {
    const unpinned: string[] = [];

    for (const file of roots.flatMap(yamlFiles)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/^\s*uses:\s*([^\s#]+)/gm)) {
        const action = match[1];
        if (action.startsWith("./")) continue;
        if (!/@[0-9a-f]{40}$/.test(action)) {
          unpinned.push(file.replace(process.cwd() + "/", "") + ": " + action);
        }
      }
    }

    expect(unpinned).toEqual([]);
  });
});
