import { describe, expect, test } from "bun:test";

const source = await Bun.file("src/lib/matrundan/geoapify-boundaries.functions.ts").text();

describe("Geoapify boundary-resolver", () => {
  test("går direkt till Boundaries API för bred administrativ geografi", () => {
    const broadBranch = source.indexOf(
      "if (isBroadAdministrativeSearchArea(input.resultType, input.label))",
    );
    const partOfCall = source.indexOf(
      "const inherited = await loadPartOfBoundary(input.placeId, input.label);",
      broadBranch,
    );
    const detailsCall = source.indexOf(
      "const direct = await loadPlaceDetailsBoundary(input.placeId);",
      broadBranch,
    );

    expect(broadBranch).toBeGreaterThanOrEqual(0);
    expect(partOfCall).toBeGreaterThan(broadBranch);
    expect(detailsCall).toBeGreaterThan(partOfCall);
  });

  test("behåller Place Details först för övriga boundary-kandidater", () => {
    const broadBranch = source.indexOf(
      "if (isBroadAdministrativeSearchArea(input.resultType, input.label))",
    );
    const broadReturn = source.indexOf(
      'return { searchMode: "point", boundary: null, boundaryPlaceId: null };',
      broadBranch,
    );
    const detailsCall = source.indexOf(
      "const direct = await loadPlaceDetailsBoundary(input.placeId);",
      broadReturn + 1,
    );
    const partOfCall = source.indexOf(
      "const inherited = await loadPartOfBoundary(input.placeId, input.label);",
      detailsCall,
    );

    expect(detailsCall).toBeGreaterThan(broadReturn);
    expect(partOfCall).toBeGreaterThan(detailsCall);
  });
});
