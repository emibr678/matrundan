/**
 * Enhetstester för den privata gamification-modulen. Kör med `bun test`.
 * Testerna bygger små AppState-fixturer och verifierar reglerna i
 * paket 3D-spec: nivågränser, badge-triggers, delad-flaggan,
 * competition-ranking, tidigare medlemmar och unlink-beteende.
 */
import { describe, expect, test } from "bun:test";
import {
  BADGES,
  LEVELS,
  computeGroupMilestones,
  computeLeaderboard,
  computeMemberProgression,
  countsForProgression,
  levelForCount,
} from "./gamification";
import type { AppState, Member, Place, Visit } from "./types";
import { APP_VERSION } from "./version";

function member(id: string, name: string = id): Member {
  return { id, name, avatar: "🙂", role: "medlem" };
}

function place(overrides: Partial<Place> & { id: string }): Place {
  const { id, ...rest } = overrides;
  return {
    id,
    name: id,
    category: "restaurang",
    cuisines: [],
    occasions: [],
    address: "",
    city: "",
    addedBy: "m1",
    addedAt: "2026-01-01",
    origin: "manual",
    ...rest,
  };
}

function visit(
  id: string,
  placeId: string,
  date: string,
  participantIds: string[],
  overrides: Partial<Visit> = {},
): Visit {
  return {
    id,
    placeId,
    date,
    meal: "middag",
    participantIds,
    overall: 4,
    createdBy: participantIds[0] ?? "m1",
    linkType: "original",
    ...overrides,
  };
}

function state(overrides: Partial<AppState>): AppState {
  return {
    version: APP_VERSION,
    currentUserId: "m1",
    group: {
      id: "g1",
      name: "Test",
      emoji: "🍽️",
      city: "",
      createdAt: "2025-01-01T00:00:00.000Z",
      ownerId: "m1",
      sharedVisitsCountForProgression: true,
    },
    members: [],
    places: [],
    visits: [],
    favorites: [],
    activity: [],
    nextPlaceId: null,
    ...overrides,
  };
}

/* ---------- Nivåer ---------- */

describe("nivågränser", () => {
  test("exakta trösklar från spec", () => {
    expect(LEVELS.map((l) => l.threshold)).toEqual([0, 1, 4, 10, 20, 40, 75]);
    expect(LEVELS.map((l) => l.name)).toEqual([
      "Nyfiken",
      "Provsmakaren",
      "Krogspanaren",
      "Matupptäckaren",
      "Smakjägaren",
      "Matkonnässören",
      "Matrundemästaren",
    ]);
  });

  test("off-by-one kring varje tröskel", () => {
    expect(levelForCount(0).name).toBe("Nyfiken");
    expect(levelForCount(1).name).toBe("Provsmakaren");
    expect(levelForCount(3).name).toBe("Provsmakaren");
    expect(levelForCount(4).name).toBe("Krogspanaren");
    expect(levelForCount(9).name).toBe("Krogspanaren");
    expect(levelForCount(10).name).toBe("Matupptäckaren");
    expect(levelForCount(19).name).toBe("Matupptäckaren");
    expect(levelForCount(20).name).toBe("Smakjägaren");
    expect(levelForCount(39).name).toBe("Smakjägaren");
    expect(levelForCount(40).name).toBe("Matkonnässören");
    expect(levelForCount(74).name).toBe("Matkonnässören");
    expect(levelForCount(75).name).toBe("Matrundemästaren");
    expect(levelForCount(75).nextThreshold).toBeNull();
  });
});

/* ---------- Progression, kredit, delad progression ---------- */

describe("progression och kredit", () => {
  test("registrerare utan participant ger ingen kredit", () => {
    const s = state({
      members: [member("m1"), member("m2")],
      places: [place({ id: "p1" })],
      visits: [visit("v1", "p1", "2026-01-01", ["m1"], { createdBy: "m2" })],
    });
    expect(computeMemberProgression(s, "m1").visits).toBe(1);
    expect(computeMemberProgression(s, "m2").visits).toBe(0);
    expect(computeMemberProgression(s, "m2").badges).toEqual([]);
  });

  test("återbesök räknas – Stammis på tredje besöket", () => {
    const s = state({
      members: [member("m1")],
      places: [place({ id: "p1" })],
      visits: [
        visit("v1", "p1", "2026-01-01", ["m1"]),
        visit("v2", "p1", "2026-01-15", ["m1"]),
        visit("v3", "p1", "2026-02-01", ["m1"]),
      ],
    });
    const prog = computeMemberProgression(s, "m1");
    expect(prog.visits).toBe(3);
    const stammis = prog.badges.find((b) => b.id === "regular");
    expect(stammis?.earnedAt).toBe("2026-02-01");
  });

  test("Världsvan utlöses på femte unika normaliserade cuisine", () => {
    const s = state({
      members: [member("m1")],
      places: [
        place({ id: "p1", cuisines: [" Italienskt "] }),
        place({ id: "p2", cuisines: ["italienskt"] }), // dubblett efter normalisering
        place({ id: "p3", cuisines: ["Japanskt"] }),
        place({ id: "p4", cuisines: ["Thai"] }),
        place({ id: "p5", cuisines: ["Mexikanskt"] }),
        place({ id: "p6", cuisines: ["Nordiskt"] }),
      ],
      visits: [
        visit("v1", "p1", "2026-01-01", ["m1"]),
        visit("v2", "p2", "2026-01-02", ["m1"]),
        visit("v3", "p3", "2026-01-03", ["m1"]),
        visit("v4", "p4", "2026-01-04", ["m1"]),
        visit("v5", "p5", "2026-01-05", ["m1"]),
        visit("v6", "p6", "2026-01-06", ["m1"]),
      ],
    });
    const prog = computeMemberProgression(s, "m1");
    expect(prog.uniqueCuisines).toBe(5);
    expect(prog.badges.find((b) => b.id === "world-taster")?.earnedAt).toBe(
      "2026-01-06",
    );
  });

  test("Brett register utlöses på fjärde kategori (ej occasions)", () => {
    const s = state({
      members: [member("m1")],
      places: [
        place({ id: "p1", category: "restaurang", occasions: ["snabbt", "middag"] }),
        place({ id: "p2", category: "café" }),
        place({ id: "p3", category: "bageri" }),
        place({ id: "p4", category: "matvagn" }),
      ],
      visits: [
        visit("v1", "p1", "2026-01-01", ["m1"]),
        visit("v2", "p2", "2026-01-02", ["m1"]),
        visit("v3", "p3", "2026-01-03", ["m1"]),
        visit("v4", "p4", "2026-01-04", ["m1"]),
      ],
    });
    const prog = computeMemberProgression(s, "m1");
    expect(prog.breadthCategories).toBe(4);
    expect(prog.badges.find((b) => b.id === "broad-register")?.earnedAt).toBe(
      "2026-01-04",
    );
  });

  test("Fullträff kräver annan gruppmedlem och icke-shared origin", () => {
    const s1 = state({
      currentUserId: "m1",
      members: [member("m1"), member("m2")],
      places: [place({ id: "p1", addedBy: "m1", origin: "manual" })],
      // ensam förslagsställare – ingen annan medlem, ingen badge
      visits: [visit("v1", "p1", "2026-01-01", ["m1"])],
    });
    expect(
      computeMemberProgression(s1, "m1").badges.find((b) => b.id === "bullseye"),
    ).toBeUndefined();

    const s2 = { ...s1, visits: [visit("v2", "p1", "2026-02-01", ["m1", "m2"])] };
    expect(
      computeMemberProgression(s2, "m1").badges.find((b) => b.id === "bullseye")
        ?.earnedAt,
    ).toBe("2026-02-01");

    // shared origin: förslagsställaren är importör, ska ej belönas
    const s3 = state({
      currentUserId: "m1",
      members: [member("m1"), member("m2")],
      places: [place({ id: "p1", addedBy: "m1", origin: "shared" })],
      visits: [visit("v1", "p1", "2026-02-01", ["m1", "m2"])],
    });
    expect(
      computeMemberProgression(s3, "m1").badges.find((b) => b.id === "bullseye"),
    ).toBeUndefined();

    // originalbesök krävs; ett shared besök ska inte utlösa Fullträff
    const s4 = state({
      currentUserId: "m1",
      members: [member("m1"), member("m2")],
      places: [place({ id: "p1", addedBy: "m1", origin: "manual" })],
      visits: [
        visit("v1", "p1", "2026-02-01", ["m1", "m2"], { linkType: "shared" }),
      ],
    });
    expect(
      computeMemberProgression(s4, "m1").badges.find((b) => b.id === "bullseye"),
    ).toBeUndefined();
  });

  test("shared progression av/på påverkar alla värden", () => {
    const base = state({
      members: [member("m1")],
      places: [
        place({ id: "p1", cuisines: ["a"], category: "restaurang" }),
        place({ id: "p2", cuisines: ["b"], category: "café" }),
      ],
      visits: [
        visit("v1", "p1", "2026-01-01", ["m1"], { linkType: "original" }),
        visit("v2", "p2", "2026-02-01", ["m1"], {
          linkType: "shared",
          countsForProgression: true,
        }),
      ],
    });
    const on = computeMemberProgression(base, "m1");
    expect(on.visits).toBe(2);
    expect(on.uniqueCuisines).toBe(2);

    const offGroup: AppState = {
      ...base,
      group: { ...base.group, sharedVisitsCountForProgression: false },
    };
    const off = computeMemberProgression(offGroup, "m1");
    expect(off.visits).toBe(1);
    expect(off.uniqueCuisines).toBe(1);
    expect(
      countsForProgression(offGroup, offGroup.visits[1]),
    ).toBe(false);

    // Även när gruppen tillåter delat, respekteras enskilt besöks flagga.
    const perVisitOff: AppState = {
      ...base,
      visits: [
        base.visits[0],
        { ...base.visits[1], countsForProgression: false },
      ],
    };
    expect(computeMemberProgression(perVisitOff, "m1").visits).toBe(1);
  });

  test("dubblett med samma Visit.id räknas bara en gång i progression, topplista och milstolpar", () => {
    const dup = visit("v1", "p1", "2026-01-01", ["m1"]);
    const s = state({
      members: [member("m1")],
      places: [place({ id: "p1" })],
      // Två poster med samma id och samma deltagare – defensiv dedup ska hålla.
      visits: [dup, { ...dup }],
    });
    const prog = computeMemberProgression(s, "m1");
    expect(prog.visits).toBe(1);
    expect(prog.uniquePlaces).toBe(1);

    const rows = computeLeaderboard(s, "visits", "all");
    expect(rows.find((r) => r.memberId === "m1")?.value).toBe(1);

    // Även milstolpar dedupliserar (första-besöks-datum stabilt).
    const s10 = state({
      members: [member("m1")],
      places: Array.from({ length: 10 }, (_, i) => place({ id: `p${i + 1}` })),
      visits: [
        // p1-besöket dubblerat; övriga p2..p10 unika.
        visit("v1", "p1", "2026-01-01", ["m1"]),
        visit("v1", "p1", "2026-01-01", ["m1"]),
        ...Array.from({ length: 9 }, (_, i) =>
          visit(`v${i + 2}`, `p${i + 2}`, `2026-01-${String(i + 2).padStart(2, "0")}`, ["m1"]),
        ),
      ],
    });
    const ms = computeGroupMilestones(s10);
    expect(ms.find((x) => x.id === "places-10")?.at).toBe("2026-01-10");
  });

  test("shared-toggle på gruppnivå tar bort delade besök från topplistan", () => {
    const s = state({
      members: [member("m1", "Alva"), member("m2", "Bea")],
      places: [place({ id: "p1" }), place({ id: "p2" })],
      visits: [
        visit("v1", "p1", "2026-01-01", ["m1"], { linkType: "original" }),
        visit("v2", "p2", "2026-02-01", ["m1"], {
          linkType: "shared",
          countsForProgression: true,
        }),
      ],
    });
    const on = computeLeaderboard(s, "visits", "all");
    expect(on.find((r) => r.memberId === "m1")?.value).toBe(2);

    const off: AppState = {
      ...s,
      group: { ...s.group, sharedVisitsCountForProgression: false },
    };
    const rows = computeLeaderboard(off, "visits", "all");
    expect(rows.find((r) => r.memberId === "m1")?.value).toBe(1);
  });

  test("borttaget/unlinkat besök omräknas vid nästa läsning", () => {
    const s1 = state({
      members: [member("m1")],
      places: [place({ id: "p1" })],
      visits: [
        visit("v1", "p1", "2026-01-01", ["m1"]),
        visit("v2", "p1", "2026-01-02", ["m1"]),
      ],
    });
    expect(computeMemberProgression(s1, "m1").visits).toBe(2);
    const s2 = { ...s1, visits: [s1.visits[0]] };
    expect(computeMemberProgression(s2, "m1").visits).toBe(1);
  });
});

/* ---------- Topplistor ---------- */

describe("topplistor", () => {
  test("competition-ranking (1,1,3) och tidigare medlem exkluderas", () => {
    // AppState.members är redan aktiva. En tidigare medlem finns endast
    // som participant på visits – hen ska inte visas i listan.
    const s = state({
      members: [member("m1", "Alva"), member("m2", "Bea"), member("m3", "Cim")],
      places: [place({ id: "p1" })],
      visits: [
        visit("v1", "p1", "2026-01-01", ["m1", "m4"]), // m4 = tidigare medlem
        visit("v2", "p1", "2026-01-02", ["m2"]),
      ],
    });
    // m1 och m2 har 1 besök; m3 har 0.
    const rows = computeLeaderboard(s, "visits", "all");
    expect(rows.map((r) => `${r.memberId}:${r.rank}:${r.value}`)).toEqual([
      "m1:1:1",
      "m2:1:1",
      "m3:3:0",
    ]);
    expect(rows.some((r) => r.memberId === "m4")).toBe(false);
  });
});

/* ---------- Milstolpar ---------- */

describe("gruppmilstolpar", () => {
  test("10 unika platser ger milstolpe med korrekt datum", () => {
    const places: Place[] = Array.from({ length: 10 }, (_, i) =>
      place({ id: `p${i + 1}` }),
    );
    const visits: Visit[] = places.map((p, i) =>
      visit(`v${i + 1}`, p.id, `2026-01-${String(i + 1).padStart(2, "0")}`, ["m1"]),
    );
    const s = state({ members: [member("m1")], places, visits });
    const ms = computeGroupMilestones(s);
    const m10 = ms.find((x) => x.id === "places-10");
    expect(m10?.at).toBe("2026-01-10");
  });
});
