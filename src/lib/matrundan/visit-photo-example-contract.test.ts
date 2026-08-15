import { expect, test } from "bun:test";
import { EXAMPLE_IDS, EXAMPLE_STATE } from "./example-data";
import { canAddOrReplaceVisitPhoto, canDeleteVisitPhoto } from "./visit-photo";

test("exempelgruppen visar en annan deltagares foto skrivskyddat för Alex", () => {
  const visit = EXAMPLE_STATE.visits.find(
    (item) => item.id === EXAMPLE_IDS.visits.repeatCafeLatest,
  );
  const alex = EXAMPLE_STATE.members.find((member) => member.id === EXAMPLE_IDS.members.alex);

  expect(visit?.photo?.uploadedBy).toBe(EXAMPLE_IDS.members.robin);
  expect(alex?.role).toBe("ägare");
  expect(
    canAddOrReplaceVisitPhoto(visit!, EXAMPLE_STATE.currentUserId, alex?.role, false),
  ).toBe(false);
  expect(
    canDeleteVisitPhoto(visit!, EXAMPLE_STATE.currentUserId, alex?.role, false),
  ).toBe(true);
});
