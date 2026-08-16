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
  test("den som registrerar ett nytt besök är låst som deltagare", () => {
    expect(visitDialog).toContain("Du registrerar besöket och räknas därför som deltagare");
    expect(visitDialog).toContain("member.id === state.currentUserId");
    expect(visitDialog).toContain("Den som registrerar besöket måste vara deltagare");
    expect(visitDialog).not.toContain("registrerar åt gruppen");
    expect(liveMutations).toContain('"create_visit_with_review_v3"');
  });

  test("registreraren erbjuds inte att korrigera bort sitt eget deltagande", () => {
    expect(participationControls).toContain("visit.createdBy === currentUserId");
    expect(participationControls).toContain("if (isRegistrar) return null");
    expect(participationControls).toContain("Jag var inte med");
  });

  test("kompletteringsflödet visar alla fyra betyg som kärnfält", () => {
    expect(reviewDialog).toContain('label="Helhetsbetyg"');
    expect(reviewDialog).toContain('label="Smak"');
    expect(reviewDialog).toContain('label="Service"');
    expect(reviewDialog).toContain('label="Prisvärdhet"');
    expect(reviewDialog).toContain("av 4 betyg satta");
    expect(reviewDialog).toContain("inget nytt besök skapas");
    expect(reviewDialog).toContain("Lägg till ditt omdöme");
  });

  test("andra deltagares självkorrigering är tydlig och återställningsbar utan egen review-CTA", () => {
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
    expect(visitReviews).toContain("AddVisitReviewDialog");
    expect(visitReviews).toContain("DemoAddVisitReviewDialog");
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
