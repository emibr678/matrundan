import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dir, "../../start.ts"), "utf8");

describe("TanStack Starts CSRF-skydd", () => {
  test("skyddar globala serverfunktioner när projektet har en egen startfil", () => {
    expect(source).toContain("createCsrfMiddleware");
    expect(source).toContain('context.handlerType === "serverFn"');
    expect(source).toMatch(
      /requestMiddleware:\s*\[csrfMiddleware,\s*errorMiddleware\]/,
    );
  });
});
