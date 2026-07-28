import { describe, expect, test } from "bun:test";
import {
  canManageNextStopDateProposal,
  countNextStopDateResponses,
  formatNextStopDate,
  normalizeNextStopTime,
} from "./next-stop-date";
import type { NextStopDateProposal } from "./types";

const proposal: NextStopDateProposal = {
  id: "proposal-1",
  placeId: "place-1",
  date: "2026-08-14",
  time: "18:30",
  createdBy: "member-1",
  status: "active",
  createdAt: "2026-07-28T10:00:00.000Z",
  updatedAt: "2026-07-28T10:00:00.000Z",
  responses: [
    { memberId: "member-1", response: "fits", updatedAt: "2026-07-28T10:00:00.000Z" },
    { memberId: "member-2", response: "fits", updatedAt: "2026-07-28T11:00:00.000Z" },
    { memberId: "member-3", response: "unsure", updatedAt: "2026-07-28T12:00:00.000Z" },
  ],
};

describe("datumförslag för nästa stopp", () => {
  test("formaterar svensk dag och valfri tid", () => {
    expect(formatNextStopDate("2026-08-14", "18:30")).toContain("14 augusti");
    expect(formatNextStopDate("2026-08-14", "18:30")).toContain("kl. 18:30");
    expect(formatNextStopDate("2026-08-14", null)).not.toContain("kl.");
  });

  test("normaliserar tid och avvisar ogiltigt format", () => {
    expect(normalizeNextStopTime("18:30")).toBe("18:30");
    expect(normalizeNextStopTime(" ")).toBeNull();
    expect(() => normalizeNextStopTime("25:00")).toThrow();
  });

  test("låter förslagsställare, ägare och admin hantera förslaget", () => {
    expect(canManageNextStopDateProposal(proposal, "member-1", "medlem")).toBe(true);
    expect(canManageNextStopDateProposal(proposal, "member-2", "ägare")).toBe(true);
    expect(canManageNextStopDateProposal(proposal, "member-2", "admin")).toBe(true);
    expect(canManageNextStopDateProposal(proposal, "member-2", "medlem")).toBe(false);
  });

  test("räknar aktuella svar per alternativ", () => {
    expect(countNextStopDateResponses(proposal)).toEqual({
      fits: 2,
      not_fits: 0,
      unsure: 1,
    });
  });
});
