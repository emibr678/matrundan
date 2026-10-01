import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../../supabase/migrations/20261001220000_group_place_symbol_override_v1.sql", import.meta.url),
  "utf8",
);

describe("place symbol override database contract", () => {
  test("lagrar override på grupprelationen och aldrig på den kanoniska platsen", () => {
    expect(migration).toContain("ALTER TABLE public.group_places");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS symbol_override text");
    expect(migration).not.toContain("ALTER TABLE public.places");
  });

  test("skyddar skrivningen med aktiv grupp, medlemskap och kuraterad symbolpool", () => {
    expect(migration).toContain("public.update_group_place_metadata_v2");
    expect(migration).toContain("public.group_is_active(_group_id)");
    expect(migration).toContain("public.has_membership(_group_id, _uid)");
    expect(migration).toContain("RAISE EXCEPTION 'Ogiltig symbol'");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.update_group_place_metadata_v2");
  });

  test("returnerar symbolOverride genom den versionsbundna gruppreaden", () => {
    expect(migration).toContain("public.get_group_app_state_v5o");
    expect(migration).toContain("public.get_group_app_state_v5n(_group_id)");
    expect(migration).toContain("'{symbolOverride}'");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.get_group_app_state_v5o");
  });
});
