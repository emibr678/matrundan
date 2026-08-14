import { describe, expect, test } from "bun:test";

const visitDialog = await Bun.file("src/components/matrundan/VisitDialog.tsx").text();
const reviewDialog = await Bun.file("src/components/matrundan/AddVisitReviewDialog.tsx").text();
const participationControls = await Bun.file(
  "src/components/matrundan/VisitParticipationControls.tsx",
).text();
const visitDetail = await Bun.file("src/components/matrundan/VisitDetailSheet.tsx").text();
const liveMutations = await Bun.file("src/lib/matrundan/live-mutations.ts").text();

describe("UX-kontrakt för gemensamma besök", () => {
  test("registrering skiljer registrerare från faktisk deltagare", () => {
    expect(visitDialog).toContain("currentUserParticipates");
    expect(visitDialog).toContain("du bara\n              registrerar åt gruppen");
    expect(visitDialog).toContain("Du registrerar besöket åt gruppen");
    expect(liveMutations).toContain('"create_visit_with_review_v3"');
    expect(liveMutations).toContain("registrarParticipates");
  });

  test("kompletteringsflödet visar alla fyra betyg som kärnfält", () => {
    expect(reviewDialog).toContain('label="Helhetsbetyg"');
    expect(reviewDialog).toContain('label="Smak"');
    expect(reviewDialog).toContain('label="Service"');
    expect(reviewDialog).toContain('label="Prisvärdhet"');
    expect(reviewDialog).toContain("av 4 betyg satta");
    expect(reviewDialog).toContain("inget nytt besök skapas");
  });

  test("självkorrigering är tydlig och återställningsbar", () => {
    expect(participationControls).toContain("Jag var inte med");
    expect(participationControls).toContain("Jag var med");
    expect(participationControls).toContain("progression");
    expect(participationControls).toContain("kan återställa");
  });

  test("besök utan deltagaromdöme visas som obesvarat i stället för nollbetyg", () => {
    expect(visitDetail).toContain("visit.overall > 0");
    expect(visitDetail).toContain("Inget omdöme ännu");
  });
});
