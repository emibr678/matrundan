import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");
const visitDialogFlow = readFileSync(
  resolve(root, "src/components/matrundan/VisitDialog.tsx"),
  "utf8",
);
const visitDialogCore = readFileSync(
  resolve(root, "src/components/matrundan/VisitDialogCore.tsx"),
  "utf8",
);
const visitPlaceOccasionDialog = readFileSync(
  resolve(root, "src/components/matrundan/VisitPlaceOccasionDialog.tsx"),
  "utf8",
);
const addReviewDialog = readFileSync(
  resolve(root, "src/components/matrundan/AddVisitReviewDialog.tsx"),
  "utf8",
);
const demoAddReviewDialog = readFileSync(
  resolve(root, "src/components/matrundan/DemoAddVisitReviewDialog.tsx"),
  "utf8",
);
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
const editVisitDialog = readFileSync(
  resolve(root, "src/components/matrundan/EditVisitDialog.tsx"),
  "utf8",
);
const reviewEditFields = readFileSync(
  resolve(root, "src/components/matrundan/ReviewEditFields.tsx"),
  "utf8",
);

describe("Issue #307 — reviewmodellens UX-kontrakt", () => {
  test("saknat Passar för löses som platsmetadata före registreringsdialogen", () => {
    expect(visitDialogFlow).toContain("needsOccasionClassification");
    expect(visitDialogFlow).toContain("<VisitPlaceOccasionDialog");
    expect(visitDialogFlow).toContain("open={open && !needsOccasionClassification}");
    expect(visitDialogCore).toContain("<ReviewScoreFields");

    expect(visitPlaceOccasionDialog).toContain("När passar stället bäst?");
    expect(visitPlaceOccasionDialog).toContain(
      "Välj en eller två kategorier som bäst beskriver när ni skulle välja stället.",
    );
    expect(visitPlaceOccasionDialog).toContain("sparas för gruppen.");
    expect(visitPlaceOccasionDialog).toContain("OCCASION_LABEL[occasion]");
    expect(visitPlaceOccasionDialog).not.toContain('occasion === "snabbt"');
    expect(visitPlaceOccasionDialog).toContain("whitespace-nowrap");
    expect(visitPlaceOccasionDialog).toContain("grid grid-cols-3");
    expect(visitPlaceOccasionDialog).toContain("Vad betyder alternativen?");
    expect(visitPlaceOccasionDialog).toContain("Spara och fortsätt");
    expect(visitPlaceOccasionDialog).not.toContain("saknar Passar för");
    expect(visitPlaceOccasionDialog).not.toContain("Atmosfär");
  });

  test("komplettering av äldre omdöme kräver saknat Passar för även vid Hämtmat", () => {
    for (const source of [addReviewDialog, demoAddReviewDialog]) {
      expect(source).toContain("classificationComplete");
      expect(source).toContain("required");
      expect(source).toContain(
        "Stället saknar Passar för. Välj en eller två kategorier innan du sparar omdömet.",
      );
      expect(source).not.toContain("Valfritt – välj vad stället passar för");
    }
  });

  test("helhetsbetyget presenteras som härlett i stället för separat input", () => {
    expect(scoreFields).toContain("Helhetsbetyg");
    expect(scoreFields).toContain("deriveReviewOverall");
    expect(scoreFields).toContain('label="Atmosfär"');
    expect(scoreFields).toContain("— / 5");
    expect(scoreFields).toContain("showEmpty");
  });

  test("Hämtmat och Snabbt & enkelt använder samma Varför-mönster", () => {
    expect(modelNotice).toContain("Varför ingår inte Atmosfär vid Hämtmat?");
    expect(modelNotice).toContain("OCCASION_LABEL.snabbt");
    expect(modelNotice).toContain("OCCASION_LABEL.avslappnat");
    expect(modelNotice).toContain("OCCASION_LABEL.middag");
    expect(modelNotice).toContain("<strong");
    expect(modelNotice).toContain("Varför räknas inte Atmosfär?");
    expect(modelNotice).toContain("inte en del av just den");
    expect(modelNotice).toContain("besöksupplevelsen och räknas inte in i helhetsbetyget");
    expect(modelNotice).toContain("mindre avgörande för");
    expect(modelNotice).toContain("helhetsupplevelsen");
    expect(modelNotice).toContain("en enklare atmosfär är mer");
    expect(modelNotice).toContain("förväntad");
    expect(modelNotice).toContain("Avslappnat eller Något extra");

    for (const source of [
      visitDialogCore,
      addReviewDialog,
      demoAddReviewDialog,
      reviewEditFields,
    ]) {
      expect(source).toContain("<ReviewScoreFields");
      expect(source).not.toContain("Atmosfär ingår inte vid Hämtmat.");
      expect(source).not.toContain("Atmosfär ingår inte för Snabbt & enkelt.");
    }
  });

  test("legacy-review behåller explicit äldre redigeringsmodell", () => {
    expect(editDialog).toContain("Det här är ett äldre omdöme");
    expect(reviewEditFields).toContain("Äldre detaljbetyg (frivilligt)");
    expect(reviewEditFields).toContain("review.reviewModel");
  });

  test("samma omdömesfält återanvänds i separat och kombinerad redigering", () => {
    expect(editDialog).toContain("<ReviewEditFields");
    expect(editVisitDialog).toContain("<ReviewEditFields");
    expect(editVisitDialog).not.toContain("<ReviewScoreFields");
    expect(editVisitDialog).not.toContain("<RatingInput");
  });
});
