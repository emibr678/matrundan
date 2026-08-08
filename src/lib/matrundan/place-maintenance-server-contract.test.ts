import { describe, expect, test } from "bun:test";

const path = "src/lib/matrundan/place-maintenance.functions.ts";
const source = await Bun.file(path).text();

function between(startText: string, endText?: string) {
  const start = source.indexOf(startText);
  expect(start).toBeGreaterThan(-1);
  const end = endText ? source.indexOf(endText, start + startText.length) : source.length;
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("Platsunderhålls serverkontrakt", () => {
  test("klienten kan bara välja förbättringsärende och provideridentitet", () => {
    const input = between("const workItemInputSchema", "export interface PlaceMaintenanceProviderMatch");
    expect(input).toContain('kind: z.literal("improvement_candidate")');
    expect(input).toContain("workItemId: z.string().uuid()");
    expect(input).toContain("providerPlaceId: z.string().trim().min(1).max(240)");
    expect(input).not.toContain("lat:");
    expect(input).not.toContain("lng:");
    expect(input).not.toContain("raw:");
    expect(input).not.toContain("groupId:");
  });

  test("sökcentrum läses från maintenance-RPC på servern", () => {
    const load = between("async function loadCandidate", "async function fetchProviderMatches");
    expect(load).toContain("get_place_improvement_candidate_for_maintenance_v1");
    expect(load).toContain("_candidate_id: workItemId");

    const search = between("async function fetchProviderMatches", "function toPublicMatch");
    expect(search).toContain("candidate.lng");
    expect(search).toContain("candidate.lat");
    expect(search).toContain("candidate.name");
    expect(search).not.toContain("groupId");
  });

  test("Geoapify-nyckel och rå providerdata stannar server-side", () => {
    expect(source).toContain("process.env.GEOAPIFY_API_KEY");
    const publicMatch = between(
      "function toPublicMatch",
      "export const searchPlaceMaintenanceProviderMatches",
    );
    expect(publicMatch).not.toContain("raw:");
    expect(publicMatch).not.toContain("GEOAPIFY_API_KEY");
  });

  test("länkning gör en färsk serversökning före den gemensamma maintenance-RPC:n", () => {
    const link = between("export const linkPlaceMaintenanceProviderMatch");
    const loadIndex = link.indexOf("await loadCandidate");
    const searchIndex = link.indexOf("await fetchProviderMatches", loadIndex);
    const rpcIndex = link.indexOf(
      'rpc("link_provider_source_for_maintenance_work_item_v1"',
      searchIndex,
    );
    expect(loadIndex).toBeGreaterThan(-1);
    expect(searchIndex).toBeGreaterThan(loadIndex);
    expect(rpcIndex).toBeGreaterThan(searchIndex);
    expect(link).toContain("_kind: data.kind");
    expect(link).toContain("_work_item_id: candidate.candidateId");
    expect(link).toContain("_provider_place_id: match.externalId");
    expect(link).toContain("_raw: raw");
  });
});
