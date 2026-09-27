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
const firstReviewGuidance = readFileSync(
  resolve(root, "src/components/matrundan/FirstReviewGuidance.tsx"),
  "utf8",
);
const occasionPicker = readFileSync(
  resolve(root, "src/components/matrundan/OccasionPicker.tsx"),
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
  test("saknat Typ av upplevelse löses som platsmetadata före registreringsdialogen", () => {
    expect(visitDialogFlow).toContain("needsOccasionClassification");
    expect(visitDialogFlow).toContain("<VisitPlaceOccasionDialog");
    expect(visitDialogFlow).toContain("open={open && !needsOccasionClassification}");
    expect(visitDialogCore).toContain("<ReviewScoreFields");

    expect(visitPlaceOccasionDialog).toContain(
      "Hur skulle ni beskriva matupplevelsen?",
    );
    expect(visitPlaceOccasionDialog).toContain(
      "Välj den typ av upplevelse som bäst beskriver stället",
    );
    expect(visitPlaceOccasionDialog).toContain("Valet sparas för gruppen.");
    expect(visitPlaceOccasionDialog).toContain("Innan du sätter betyg");
    expect(visitPlaceOccasionDialog).toContain("<FirstReviewGuidance");
    expect(visitPlaceOccasionDialog).toContain("USER_GUIDANCE.reviewContext");
    expect(visitPlaceOccasionDialog).toContain("OccasionClassificationChoices");
    expect(visitPlaceOccasionDialog).not.toContain('occasion === "snabbt"');
    expect(occasionPicker).toContain("OCCASION_LABEL[occasion]");
    expect(occasionPicker).toContain("whitespace-nowrap");
    expect(occasionPicker).toContain("grid grid-cols-3");
    expect(occasionPicker).toContain("Så fungerar det");
    expect(visitPlaceOccasionDialog).toContain("Spara och fortsätt");
    expect(visitPlaceOccasionDialog).not.toContain("saknar Typ av upplevelse");
    expect(visitPlaceOccasionDialog).not.toContain("Atmosfär");
  });

  test("komplettering av äldre omdöme löser saknad Typ av upplevelse före betyget", () => {
    expect(addReviewDialog).toContain("classificationActive");
    expect(addReviewDialog).toContain("saveClassificationAndContinue");
    expect(addReviewDialog).toContain("updatePlaceMetadata");
    expect(addReviewDialog).toContain("Spara och fortsätt");
    expect(addReviewDialog).toContain("OccasionClassificationChoices");

    expect(demoAddReviewDialog).toContain("classificationActive");
    expect(demoAddReviewDialog).toContain("saveClassificationAndContinue");
    expect(demoAddReviewDialog).toContain("updatePlaceMetadata");
    expect(demoAddReviewDialog).toContain("Spara och fortsätt");
    expect(demoAddReviewDialog).toContain("OccasionClassificationChoices");
    expect(addReviewDialog).not.toContain("Valfritt – välj vad stället passar för");
    expect(demoAddReviewDialog).not.toContain("Valfritt – välj vad stället passar för");
  });

  test("första omdömesguiden är ett separat steg före klassificering och stjärnor", () => {
    expect(firstReviewGuidance).toContain("Kul att du ska lämna ditt första omdöme!");
    expect(firstReviewGuidance).toContain("Ett enkelt gatukök och en finkrog");
    expect(firstReviewGuidance).toContain("Båda");
    expect(firstReviewGuidance).toContain("kan få lika höga betyg");
    expect(firstReviewGuidance).toContain("Tre typer av matupplevelser");
    expect(firstReviewGuidance).toContain(
      "Ett matställe kan beskrivas med en eller två av dem.",
    );
    expect(firstReviewGuidance).toContain("showConclusion={false}");
    expect(firstReviewGuidance).toContain("Jag förstår");
    expect(addReviewDialog).toContain("firstGuidanceActive");
    expect(addReviewDialog).toContain("classificationActive");
  });

  test("helhetsbetyget presenteras som härlett i stället för separat input", () => {
    expect(scoreFields).toContain("Helhetsbetyg");
    expect(scoreFields).toContain("contextOccasions");
    expect(scoreFields).toContain("<OccasionSummary");
    expect(scoreFields).not.toContain("ReviewContextHelp");
    expect(scoreFields).not.toContain("Om betygen");
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

  test("Typ av upplevelse-hjälpen förklarar olika matupplevelser", () => {
    expect(occasionPicker).toContain(
      "Typ av upplevelse gäller matstället",
    );
    expect(occasionPicker).toContain(
      "vilken sorts matupplevelse gruppen förknippar det med",
    );
    expect(occasionPicker).toContain("Båda kan få lika");
    expect(occasionPicker).toContain("OCCASION_DESCRIPTION");
    expect(occasionPicker).toContain("Typ av upplevelse");
    expect(occasionPicker).toContain("Så fungerar det");
    expect(occasionPicker).toContain("showInstructions");
    expect(occasionPicker).toContain("OccasionClassificationChoices");
    expect(occasionPicker).toContain("OccasionSummary");
    expect(occasionPicker).toContain("<OccasionGuide compact");
    expect(occasionPicker).toContain("min-h-14");
  });

  test("3D-reviews använder ordinarie härlett flöde och explicit modelluppgradering", () => {
    expect(editDialog).toContain("canUpgradeReviewModelWithAtmosphere");
    expect(editDialog).toContain("upgradeOwnReviewModel");
    expect(editDialog).toContain("modelUpgrade={");
    expect(scoreFields).toContain("Ingick inte i betyget när omdömet skapades.");
    expect(scoreFields).toContain("Lägg till Atmosfär");
    expect(scoreFields).toContain(
      "När du sparar läggs Atmosfär till i omdömet och helhetsbetyget räknas om.",
    );
    expect(scoreFields).toContain("Ångra");
    expect(editDialog).toContain("Lägga till Atmosfär?");
    expect(editDialog).toContain("Lägg till och spara");
    expect(editDialog).toContain("inte ta bort Atmosfär igen");
    expect(reviewEditFields).not.toContain("Äldre detaljbetyg (frivilligt)");
    expect(reviewEditFields).not.toContain('label="Helhetsbetyg"');
  });

  test("omdöme och besöksbild redigeras separat från den gemensamma besökshändelsen", () => {
    expect(editDialog).toContain("<ReviewEditFields");
    expect(editVisitDialog).not.toContain("<ReviewEditFields");
    expect(editVisitDialog).not.toContain("<VisitPhotoManager");
    expect(editVisitDialog).not.toContain("<ReviewScoreFields");
    expect(editVisitDialog).not.toContain("<RatingInput");
    expect(editVisitDialog).toContain("Omdömet bevaras");
  });

  test("omdömesdialogerna visar bildvalet utan teknisk komprimeringscopy", () => {
    expect(addReviewDialog).toContain("showHelpText={false}");
    expect(demoAddReviewDialog).toContain("showHelpText={false}");
  });
});
