import { describe, expect, test } from "bun:test";

const migration = await Bun.file(
  "supabase/migrations/20260801170000_manual_place_source_linking.sql",
).text();

describe("manuell källkopplings databaskontrakt", () => {
  test("rapporttypen för saknade OSM-ställen kräver kartposition och saknad OSM-källa", () => {
    expect(migration).toContain("'missing_in_osm'");
    expect(migration).toContain("Verifierad kartposition krävs");
    expect(migration).toContain("Matstället har redan en aktiv OpenStreetMap-koppling");
  });

  test("endast ägare och admin får länka till ett aktivt manuellt gruppställe", () => {
    expect(migration).toContain("has_group_role(_group_id, _uid, ARRAY['owner', 'admin'])");
    expect(migration).toContain("gp.origin = 'manual'");
    expect(migration).toContain("gp.collection_status = 'active'");
  });

  test("målplatsen måste sakna aktiv källa och externa identiteter får inte återanvändas", () => {
    expect(migration).toContain("Matstället har redan en aktiv extern källa");
    expect(migration).toContain("Geoapify-identitet är redan länkad");
    expect(migration).toContain("OpenStreetMap-identitet är redan länkad");
    expect(migration).not.toContain("UPDATE public.group_places\n  SET origin = 'provider'");
  });

  test("servern kräver exakt en konservativ match och bevarar plats-id", () => {
    expect(migration).toContain("_candidate_distance <= 0.1");
    expect(migration).toContain("_candidate_count > 1");
    expect(migration).toContain("_matched_place_id <> _place_id");
    expect(migration).toContain("RETURN _place_id");
    expect(migration).not.toContain("DELETE FROM public.places");
    expect(migration).not.toContain("UPDATE public.visits");
  });

  test("RPC:n är autentiserad men inte anonym", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.link_provider_source_to_existing_place_v1",
    );
    expect(migration).toContain("FROM PUBLIC, anon");
    expect(migration).toContain("TO authenticated");
  });
});
