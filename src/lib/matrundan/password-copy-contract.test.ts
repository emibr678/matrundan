import { describe, expect, test } from "bun:test";

const emailAuthSource = await Bun.file("src/components/matrundan/EmailAuthDialog.tsx").text();
const newPasswordSource = await Bun.file("src/routes/nytt-losenord.tsx").text();

describe("Issue #427 – lösenordscopy", () => {
  test("lovar bara verifierade lösenordskrav i aktiva auth-flöden", () => {
    expect(emailAuthSource).toContain("Minst 8 tecken.");
    expect(emailAuthSource).toContain(
      "Lösenordet godkändes inte. Välj ett annat lösenord med minst 8 tecken.",
    );
    expect(newPasswordSource).toContain(
      "Lösenordet godkändes inte. Välj ett annat lösenord med minst 8 tecken.",
    );

    expect(emailAuthSource).not.toContain("kontrolleras mot kända läckor");
    expect(emailAuthSource).not.toContain("finns i kända läckor");
    expect(newPasswordSource).not.toContain("finns i kända läckor");
  });

  test("behåller åtta tecken som enda uttryckliga krav", () => {
    expect(emailAuthSource).toContain("const MIN_PASSWORD_LENGTH = 8;");
    expect(newPasswordSource).toContain("const MIN_PASSWORD_LENGTH = 8;");
  });
});
