import { expect, test } from "bun:test";
import { EXAMPLE_IDS, EXAMPLE_STATE } from "./example-data";
import {
  canAddOrReplaceVisitPhoto,
  canDeleteVisitPhoto,
  getOwnVisitPhoto,
  getVisitPhotos,
} from "./visit-photo";

test("exempelgruppen visar två individuellt ägda deltagarbilder", () => {
  const visit = EXAMPLE_STATE.visits.find(
    (item) => item.id === EXAMPLE_IDS.visits.repeatCafeLatest,
  );
  const alex = EXAMPLE_STATE.members.find((member) => member.id === EXAMPLE_IDS.members.alex);

  expect(visit).toBeDefined();
  expect(getVisitPhotos(visit!).map((photo) => photo.uploadedBy)).toEqual([
    EXAMPLE_IDS.members.robin,
    EXAMPLE_IDS.members.alex,
  ]);
  expect(visit?.photo?.uploadedBy).toBe(EXAMPLE_IDS.members.robin);
  expect(getOwnVisitPhoto(visit!, EXAMPLE_STATE.currentUserId)?.uploadedBy).toBe(
    EXAMPLE_IDS.members.alex,
  );
  expect(alex?.role).toBe("ägare");
  expect(canAddOrReplaceVisitPhoto(visit!, EXAMPLE_STATE.currentUserId, alex?.role, false)).toBe(
    true,
  );
  expect(
    canDeleteVisitPhoto(
      visit!,
      EXAMPLE_IDS.members.robin,
      EXAMPLE_STATE.currentUserId,
      alex?.role,
      false,
    ),
  ).toBe(true);
});
