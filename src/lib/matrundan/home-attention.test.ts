import { describe, expect, test } from "bun:test";

import { resolveHomeAttention } from "./home-attention";

describe("Hem-uppmärksamhet", () => {
  test("prioriterar gruppinbjudan framför väntande omdöme", () => {
    expect(resolveHomeAttention(1, 3)).toBe("group-invitation");
  });

  test("visar väntande omdöme när ingen gruppinbjudan finns", () => {
    expect(resolveHomeAttention(0, 2)).toBe("pending-review");
  });

  test("lämnar plats åt lågprioriterad app-nudge när inget annat väntar", () => {
    expect(resolveHomeAttention(0, 0)).toBe("app-nudge");
  });
});
