import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260802023000_place_data_signals.sql"),
  "utf8",
);

function functionBody(name: string): string {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = migration.indexOf("CREATE OR REPLACE FUNCTION public.", start + 1);
  return migration.slice(start, next === -1 ? migration.length : next);
}

describe("platsdatasignalernas databaskontrakt", () => {
  test("läser endast en neutral slutsats och exkluderar den aktuella gruppens privata evidens", () => {
    const body = functionBody("get_place_data_signals_v1");

    expect(body).toContain("report.group_id <> _group_id");
    expect(body).toContain("confirmation.group_id <> _group_id");
    expect(body).toContain("'closureStatus'");
    expect(body).toContain("'limitedInformation'");
    expect(body).toContain("'recentlyConfirmedOpen'");
    expect(body).not.toContain("'groupId'");
    expect(body).not.toContain("'userId'");
    expect(body).not.toContain("'description'");
    expect(body).not.toContain("'reportId'");
  });

  test("kräver aktivt medlemskap och validerar kanoniska mål mot gruppens historik", () => {
    const readBody = functionBody("get_place_data_signals_v1");
    const confirmBody = functionBody("confirm_place_data_signal_v1");

    expect(readBody).toContain("public.has_membership(_group_id, _uid)");
    expect(readBody).toContain("FROM public.group_places gp");
    expect(confirmBody).toContain("public.group_is_active(_group_id)");
    expect(confirmBody).toContain("public.has_membership(_group_id, _uid)");
    expect(confirmBody).toContain(">= 50");
    expect(confirmBody).toContain("dygnsgränsen för platsdatabekräftelser");
  });

  test("använder åldrande, verkliga besök som motbevisning och tri-state för öppettider", () => {
    const body = functionBody("get_place_data_signals_v1");

    expect(body).toContain("interval '90 days'");
    expect(body).toContain("interval '180 days'");
    expect(body).toContain("interval '365 days'");
    expect(body).toContain("FROM public.visits visit");
    expect(body).not.toContain("visit.deleted_at");
    expect(body).toContain("c.has_opening_hours IS FALSE");
  });

  test("spärrar direkt tabellåtkomst och ger bara autentiserade användare RPC-rättigheter", () => {
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.place_data_signal_confirmations\n  FROM PUBLIC, anon, authenticated;",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.get_place_data_signals_v1(uuid, jsonb)\n  FROM PUBLIC, anon;",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_place_data_signals_v1(uuid, jsonb)\n  TO authenticated;",
    );
    expect(migration).toContain("DELETE FROM public.place_data_signal_confirmations");
  });
});
