import { describe, expect, test } from "bun:test";

const visitDialogCore = await Bun.file("src/components/matrundan/VisitDialogCore.tsx").text();

describe("registrering + delning för Issue #214", () => {
  test("fortsätter till precis gästkoppling först efter sparat och delat besök", () => {
    expect(visitDialogCore).toContain("const continueToGuestLink");
    expect(visitDialogCore).toContain('mode === "live"');
    expect(visitDialogCore).toContain("guests.length > 0");
    expect(visitDialogCore).toContain("sharedCount > 0");
    expect(visitDialogCore).toContain("!!created?.id");
    expect(visitDialogCore).toContain(
      "setGuestLinkPayload({ visitId: created.id, sourceGroupId: activeGroupId })",
    );
  });

  test("stänger registreringsdialogen innan gästkopplingsdialogen tar över", () => {
    const continuation = visitDialogCore.slice(
      visitDialogCore.indexOf("const continueToGuestLink"),
      visitDialogCore.indexOf('toast.success("Besök registrerat"'),
    );

    expect(continuation).toContain("onOpenChange(false)");
    expect(continuation).toContain("setGuestLinkPayload");
    expect(continuation.indexOf("onOpenChange(false)")).toBeLessThan(
      continuation.indexOf("setGuestLinkPayload"),
    );
  });
});
