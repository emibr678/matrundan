import { describe, expect, test } from "bun:test";

const visitDialog = await Bun.file("src/components/matrundan/VisitDialog.tsx").text();
const reviewDialog = await Bun.file("src/components/matrundan/AddVisitReviewDialog.tsx").text();
const participationControls = await Bun.file(
  "src/components/matrundan/VisitParticipationControls.tsx",
).text();
const visitDetail = await Bun.file("src/components/matrundan/VisitDetailSheet.tsx").text();
const visitReviews = await Bun.file("src/components/matrundan/VisitReviewsSection.tsx").text();
const visitHistory = await Bun.file("src/routes/besok.tsx").text();
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

  test("självkorrigering är tydlig och återställningsbar utan egen review-CTA", () => {
    expect(participationControls).toContain("Jag var inte med");
    expect(participationControls).toContain("Jag var med");
    expect(participationControls).toContain("progression");
    expect(participationControls).toContain("kan återställa");
    expect(participationControls).not.toContain("AddVisitReviewDialog");
    expect(participationControls).not.toContain("DemoAddVisitReviewDialog");
  });

  test("besöksdetaljen samlar omdömen i en gemensam informationsyta", () => {
    expect(visitDetail).toContain("VisitReviewsSection");
    expect(visitReviews).toContain("Gängets omdömen");
    expect(visitReviews).toContain("Lägg till ditt omdöme");
    expect(visitReviews).toContain("Visa alla");
    expect(visitDetail).not.toContain("Kommentar från gänget");
    expect(visitDetail).not.toContain("Din synlighet");
    expect(visitDetail).not.toContain("<Detail");
  });

  test("besök utan deltagaromdöme visas som obesvarat i stället för nollbetyg", () => {
    expect(visitReviews).toContain("visit.overall > 0");
    expect(visitReviews).toContain("Inget omdöme ännu");
    expect(visitHistory).toContain("visit.overall > 0");
    expect(visitHistory).toContain("Inget omdöme ännu");
  });
});
