import { describe, expect, test } from "bun:test";

const migrationPath =
  "supabase/migrations/20260927032930_user_guidance_state_v1.sql";
const preflightPath = "supabase/production-preflight-user-guidance.sql";
const allPreflightPath = "supabase/production-preflight-all.sql";

const migration = await Bun.file(migrationPath).text();
const preflight = await Bun.file(preflightPath).text();
const allPreflight = await Bun.file(allPreflightPath).text();

describe("produktguidningens databaskontrakt", () => {
  test("är kontobundet, versionsstyrt och idempotent", () => {
    expect(migration).toContain("CREATE TABLE public.user_guidance_state");
    expect(migration).toContain(
      "PRIMARY KEY (user_id, guidance_key, guidance_version)",
    );
    expect(migration).toContain("ON DELETE CASCADE");
    expect(migration).toContain(
      "ON CONFLICT (user_id, guidance_key, guidance_version) DO NOTHING",
    );
  });

  test("ger klienten minsta möjliga egenåtkomst", () => {
    expect(migration).toContain(
      "REVOKE ALL ON public.user_guidance_state FROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain(
      "GRANT SELECT, INSERT ON public.user_guidance_state TO authenticated",
    );
    expect(migration).toContain(
      "ALTER TABLE public.user_guidance_state ENABLE ROW LEVEL SECURITY",
    );
    expect(migration.match(/\(SELECT auth\.uid\(\)\) = user_id/g)).toHaveLength(
      2,
    );
    expect(migration).not.toContain(
      "GRANT UPDATE ON public.user_guidance_state",
    );
    expect(migration).not.toContain(
      "GRANT DELETE ON public.user_guidance_state",
    );
  });

  test("backfillar bara kärnintroduktionen för befintliga medlemmar", () => {
    expect(migration).toContain("'core-intro'");
    expect(migration).toContain("FROM public.memberships membership");
    expect(migration).toContain("profile.deleted_at IS NULL");
    const backfill = migration.slice(
      migration.indexOf("INSERT INTO public.user_guidance_state"),
      migration.indexOf(
        "CREATE OR REPLACE FUNCTION public.clear_user_guidance_on_profile_soft_delete",
      ),
    );
    expect(backfill).not.toContain("'review-context'");
  });

  test("rensar kvitton vid både mjuk och fysisk kontoradering", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.clear_user_guidance_on_profile_soft_delete",
    );
    expect(migration).toContain(
      "OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL",
    );
    expect(migration).toContain(
      "DELETE FROM public.user_guidance_state",
    );
    expect(migration).toContain(
      "profiles_clear_user_guidance_on_soft_delete",
    );
  });

  test("ingår i den samlade skrivskyddade driftkontrollen", () => {
    expect(preflight).toContain("user_guidance:self-only-policies");
    expect(preflight).toContain("user_guidance:soft-delete-cleanup");
    expect(allPreflight).toContain(
      "\\ir production-preflight-user-guidance.sql",
    );
  });
});
