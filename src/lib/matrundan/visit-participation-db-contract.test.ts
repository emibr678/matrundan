import { describe, expect, test } from "bun:test";

const migration = await Bun.file(
  "supabase/migrations/20260814020500_visit_participation_and_reviews_v1.sql",
).text();
const registrarGuard = await Bun.file(
  "supabase/migrations/20260815070000_visit_registrar_participation_guard_v1.sql",
).text();
const preflight = await Bun.file("supabase/production-preflight-visit-participation.sql").text();

describe("databaskontrakt för gemensamma besök och deltagaromdömen", () => {
  test("nya besök kräver registreraren som deltagare med eget omdöme", () => {
    expect(registrarGuard).toContain(
      "CREATE OR REPLACE FUNCTION public.create_visit_with_review_v3(",
    );
    expect(registrarGuard).toContain(
      "_uid = ANY(COALESCE(_participant_ids, '{}'::uuid[]))",
    );
    expect(registrarGuard).toContain("Den som registrerar besöket måste vara deltagare");
    expect(registrarGuard).toContain("Helhetsbetyg måste vara 1–5");
    expect(registrarGuard).toContain("INSERT INTO public.reviews");
    expect(registrarGuard).not.toContain("IF _registrar_participates THEN");
  });

  test("registreraren kan inte korrigera bort sitt eget deltagande", () => {
    expect(registrarGuard).toContain(
      "CREATE OR REPLACE FUNCTION public.set_own_visit_participation_v1(",
    );
    expect(registrarGuard).toContain("created_by = _uid");
    expect(registrarGuard).toContain("IF NOT _participating AND EXISTS");
    expect(registrarGuard).toContain("Den som registrerade besöket måste vara deltagare");
  });

  test("egen review på befintligt besök kräver faktisk deltagarstatus", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.save_own_review_for_visit_v1(");
    expect(migration).toContain("FROM public.visit_participants");
    expect(migration).toContain("Endast faktiska deltagare kan lämna ett omdöme");
    expect(migration).toContain("ON CONFLICT (visit_id, user_id) DO UPDATE");
  });

  test("självkorrigering kan inte användas som godtycklig självtaggning", () => {
    expect(registrarGuard).toContain(
      "CREATE OR REPLACE FUNCTION public.set_own_visit_participation_v1(",
    );
    expect(registrarGuard).toContain("_correction_status IS DISTINCT FROM 'declined'");
    expect(registrarGuard).toContain("Deltagandet kan bara återställas efter en egen korrigering");
    expect(registrarGuard).toContain("DELETE FROM public.visit_participants");
  });

  test("v5i och v5j filtrerar reviews mot kanoniskt deltagande", () => {
    expect(migration).toContain("RENAME TO get_group_app_state_v5i_participation_base");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_group_app_state_v5i(");
    expect(migration).toContain("'currentUserParticipationStatus'");
    expect(migration).toContain("AS active_reviews");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_group_app_state_v5j(");
  });

  test("korrigeringstabellen är server-only och preflight skyddar gränserna", () => {
    expect(migration).toContain("REVOKE ALL ON TABLE public.visit_participation_self_corrections");
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.get_group_app_state_v5i_participation_base(uuid)",
    );
    expect(preflight).toContain("read_rpc:participant-review-filter");
    expect(preflight).toContain("visit_rpc:registrar-must-participate");
    expect(preflight).toContain("participation_rpc:registrar-cannot-decline");
    expect(preflight).toContain("participation_rpc:restore-needs-own-decline");
    expect(preflight).toContain("isolation:no-authenticated-correction-table-read");
  });
});
