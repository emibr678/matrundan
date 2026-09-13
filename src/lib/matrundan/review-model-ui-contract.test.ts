import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");
const visitDialog = readFileSync(resolve(root, "src/components/matrundan/VisitDialog.tsx"), "utf8");
const scoreFields = readFileSync(
  resolve(root, "src/components/matrundan/ReviewScoreFields.tsx"),
  "utf8",
);
const modelNotice = readFileSync(
  resolve(root, "src/components/matrundan/ReviewModelNotice.tsx"),
  "utf8",
);
const editDialog = readFileSync(
  resolve(root, "src/components/matrundan/EditReviewDialog.tsx"),
  "utf8",
);

describe("Issue #307 — reviewmodellens UX-kontrakt", () => {
  test("nytt besök använder dimensionsbetyg och kan sparas utan omdöme när Passar för saknas", () => {
    expect(visitDialog).toContain("<ReviewScoreFields");
    expect(visitDialog).toContain("Spara besöket nu, omdömet kan vänta");
    expect(visitDialog).toContain("Spara besök utan omdöme");
    expect(visitDialog).not.toContain("Detaljbetyg (frivilligt)");
  });

  test("saknat Passar för försvinner inte när Hämtmat väljs", () => {
    expect(visitDialog).toContain("placeNeedsOccasionClassification");
    expect(visitDialog).toContain("Valfritt – välj vad stället passar för");
    expect(visitDialog).toContain("reviewOccasions.length > 0");
  });

  test("helhetsbetyget presenteras som härlett i stället för separat input", () => {
    expect(scoreFields).toContain("Helhetsbetyg");
    expect(scoreFields).toContain("deriveReviewOverall");
    expect(scoreFields).toContain('label="Atmosfär"');
    expect(scoreFields).toContain("— / 5");
    expect(scoreFields).toContain("showEmpty");
  });

  test("Snabbt och enkelt har en frivillig förklaring till varför Atmosfär utelämnas", () => {
    expect(modelNotice).toContain("Varför räknas inte Atmosfär?");
    expect(modelNotice).toContain("mindre avgörande för helhetsupplevelsen");
    expect(modelNotice).toContain("en enklare atmosfär är mer förväntad");
    expect(modelNotice).toContain("Avslappnat eller Något extra");
  });

  test("legacy-review behåller explicit äldre redigeringsmodell", () => {
    expect(editDialog).toContain("Det här är ett äldre omdöme");
    expect(editDialog).toContain("Äldre detaljbetyg (frivilligt)");
    expect(editDialog).toContain("review.reviewModel");
  });
});
