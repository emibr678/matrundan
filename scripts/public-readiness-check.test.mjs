import { describe, expect, test } from "bun:test";

const suspiciousValuePatterns = [
  /sb_secret_[A-Za-z0-9._-]{20,}/,
  /github_pat_[A-Za-z0-9_]{40,}/,
  /ghp_[A-Za-z0-9]{30,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

function isSuspicious(value) {
  return suspiciousValuePatterns.some((pattern) => pattern.test(value));
}

describe("public-readiness secret patterns", () => {
  test("flaggar riktiga secret-liknande värden", () => {
    expect(isSuspicious(`sb_secret_${"a".repeat(24)}`)).toBe(true);
    expect(isSuspicious(`ghp_${"A".repeat(36)}`)).toBe(true);
    expect(isSuspicious(`AKIA${"A".repeat(16)}`)).toBe(true);
    expect(isSuspicious("-----BEGIN PRIVATE KEY-----")).toBe(true);
  });

  test("flaggar inte dokumenterade prefix eller placeholders", () => {
    expect(isSuspicious("value.startsWith(\"sb_secret_\")")).toBe(false);
    expect(isSuspicious("sb_publishable_your_key")).toBe(false);
    expect(isSuspicious("replace-with-server-secret")).toBe(false);
  });
});
