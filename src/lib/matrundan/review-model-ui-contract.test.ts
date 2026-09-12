import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");
const visitDialog = readFileSync(
  resolve(root, "src/components/matrundan/VisitDialog.tsx"),
  "utf8",
);
const scoreFields = readFileSync(
  resolve(root, "src/components/matrundan/ReviewScoreFields.tsx"),
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

  test("helhetsbetyget presenteras som härlett i stället för separat input", () => {
    expect(scoreFields).toContain("Helhetsbetyg");
    expect(scoreFields).toContain("deriveReviewOverall");
    expect(scoreFields).toContain('label="Atmosfär"');
  });

  test("legacy-review behåller explicit äldre redigeringsmodell", () => {
    expect(editDialog).toContain("Det här är ett äldre omdöme");
    expect(editDialog).toContain("Äldre detaljbetyg (frivilligt)");
    expect(editDialog).toContain("review.reviewModel");
  });
});
