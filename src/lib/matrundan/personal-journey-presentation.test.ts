import { describe, expect, test } from "bun:test";
import { formatPersonalJourneyGroups } from "./personal-journey-presentation";

const group = (groupName: string) => ({
  groupId: crypto.randomUUID(),
  groupName,
  isArchived: false,
  isWritable: true,
});

describe("gruppkontext i Min matresa", () => {
  test("visar en grupp utan teknisk metadata", () => {
    expect(formatPersonalJourneyGroups([group("Fredagsgänget")])).toBe("Fredagsgänget");
  });

  test("komprimerar flera grupper utan att dölja att fler finns", () => {
    expect(formatPersonalJourneyGroups([group("Familjen"), group("Jobbet")])).toBe(
      "Familjen +1 grupp",
    );
    expect(
      formatPersonalJourneyGroups([group("Familjen"), group("Jobbet"), group("Vännerna")]),
    ).toBe("Familjen +2 grupper");
  });
});
