import { describe, expect, test } from "bun:test";

const visitDialog = await Bun.file("src/components/matrundan/VisitDialog.tsx").text();

describe("registrering + delning för Issue #214", () => {
  test("fortsätter till precis gästkoppling först efter sparat och delat besök", () => {
    expect(visitDialog).toContain("const continueToGuestLink");
    expect(visitDialog).toContain('mode === "live"');
    expect(visitDialog).toContain("guests.length > 0");
    expect(visitDialog).toContain("sharedCount > 0");
    expect(visitDialog).toContain("!!created?.id");
    expect(visitDialog).toContain(
      "setGuestLinkPayload({ visitId: created.id, sourceGroupId: activeGroupId })",
    );
  });

  test("stänger registreringsdialogen innan gästkopplingsdialogen tar över", () => {
    const continuation = visitDialog.slice(
      visitDialog.indexOf("const continueToGuestLink"),
      visitDialog.indexOf('toast.success("Besök registrerat"'),
    );

    expect(continuation).toContain("onOpenChange(false)");
    expect(continuation).toContain("setGuestLinkPayload");
    expect(continuation.indexOf("onOpenChange(false)")).toBeLessThan(
      continuation.indexOf("setGuestLinkPayload"),
    );
  });
});
