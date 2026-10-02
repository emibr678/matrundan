import { describe, expect, test } from "bun:test";

import { resolveHomeAttention } from "./home-attention";

describe("Hem-uppmärksamhet", () => {
  test("visar inget lägre prioriterat innan gruppinbjudningarna är laddade", () => {
    expect(resolveHomeAttention(false, 0, 3)).toBeNull();
  });

  test("prioriterar gruppinbjudan framför väntande omdöme", () => {
    expect(resolveHomeAttention(true, 1, 3)).toBe("group-invitation");
  });

  test("visar väntande omdöme när ingen gruppinbjudan finns", () => {
    expect(resolveHomeAttention(true, 0, 2)).toBe("pending-review");
  });

  test("prioriterar gruppinbjudan framför Min matresa-introt", () => {
    expect(resolveHomeAttention(true, 1, 0, true)).toBe("group-invitation");
  });

  test("visar Min matresa-introt före lågprioriterad app-nudge", () => {
    expect(resolveHomeAttention(true, 0, 0, true)).toBe("personal-journey-intro");
  });

  test("prioriterar väntande omdöme framför Min matresa-introt", () => {
    expect(resolveHomeAttention(true, 0, 1, true)).toBe("pending-review");
  });

  test("lämnar plats åt lågprioriterad app-nudge när inget annat väntar", () => {
    expect(resolveHomeAttention(true, 0, 0)).toBe("app-nudge");
  });
});
