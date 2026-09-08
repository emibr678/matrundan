import { describe, expect, test } from "bun:test";

const migration = await Bun.file(
  "supabase/migrations/20260908164000_visit_duplicate_guard_v1.sql",
).text();

describe("databaskontrakt för starka besöksdubletter", () => {
  test("registreringskontrollen är auth-styrd och kräver legitim aktiv åtkomst", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.find_registration_visit_duplicate_v1(",
    );
    expect(migration).toContain("_uid uuid := auth.uid();");
    expect(migration).toContain("v.place_id = _place_id");
    expect(migration).toContain("v.visited_on = _visited_on");
    expect(migration).toContain("v.meal_type = _meal_type");
    expect(migration).toContain("vp.user_id = _uid");
    expect(migration).toContain("access_group.lifecycle_status = 'active'");
    expect(migration).toContain("access_membership.status = 'active'");
  });

  test("den minimerade kandidaten exponerar inte grupp- eller kommentarsmetadata", () => {
    const start = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.find_registration_visit_duplicate_v1(",
    );
    const end = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.find_share_visit_duplicate_v1(",
    );
    const registrationFunction = migration.slice(start, end);

    expect(registrationFunction).toContain("'visitId'");
    expect(registrationFunction).toContain("'visitedOn'");
    expect(registrationFunction).toContain("'mealType'");
    expect(registrationFunction).toContain("'alreadyVisibleInTargetGroup'");
    expect(registrationFunction).not.toContain("'groupName'");
    expect(registrationFunction).not.toContain("'sourceGroup'");
    expect(registrationFunction).not.toContain("'comment'");
  });

  test("delningskontrollen kräver både källåtkomst och medlemskap i målgruppen", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.find_share_visit_duplicate_v1(",
    );
    expect(migration).toContain("public.group_is_active(_target_group_id)");
    expect(migration).toContain("public.has_membership(_target_group_id, _uid)");
    expect(migration).toContain("source_group.lifecycle_status = 'active'");
    expect(migration).toContain("source_membership.user_id = _uid");
    expect(migration).toContain("source_membership.status = 'active'");
    expect(migration).toContain("source_access.visit_id = _visit_id");
  });

  test("delningskontrollen letar bara efter ett annat matchande besök i målgruppen", () => {
    expect(migration).toContain("candidate.id <> _visit_id");
    expect(migration).toContain("candidate.place_id = _place_id");
    expect(migration).toContain("candidate.visited_on = _visited_on");
    expect(migration).toContain("candidate.meal_type = _meal_type");
    expect(migration).toContain("target_link.group_id = _target_group_id");
    expect(migration).toContain("candidate_participant.user_id = _uid");
  });

  test("delning kräver explicit bypass när en stark kandidat finns", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.share_visit_to_group_v2(");
    expect(migration).toContain("_allow_strong_duplicate boolean DEFAULT false");
    expect(migration).toContain("IF _duplicate IS NOT NULL AND NOT _allow_strong_duplicate THEN");
    expect(migration).toContain("RETURN public.share_visit_to_group(");
  });

  test("nya RPC:er är låsta till authenticated med fast search_path", () => {
    expect(migration.match(/SECURITY DEFINER/g)?.length).toBe(3);
    expect(migration.match(/SET search_path TO 'public'/g)?.length).toBe(3);
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.find_registration_visit_duplicate_v1(uuid, uuid, date, text)\n  FROM PUBLIC, anon;",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.share_visit_to_group_v2(uuid, uuid, boolean, boolean)\n  TO authenticated;",
    );
  });
});
