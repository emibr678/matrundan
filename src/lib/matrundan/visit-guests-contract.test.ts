import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260803153000_visit_guests_and_history_clarity.sql"),
  "utf8",
);

function functionBody(name: string): string {
  const match = migration.match(
    new RegExp(
      `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${name}\\b[\\s\\S]*?\\$function\\$;`,
      "i",
    ),
  );
  if (!match) throw new Error(`Funktionen ${name} saknas i migrationen.`);
  return match[0];
}

describe("besöksgäster", () => {
  test("ligger i en privat besökslokal tabell", () => {
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.visit_guests/i);
    expect(migration).toMatch(/visit_id uuid NOT NULL REFERENCES public\.visits\(id\) ON DELETE CASCADE/i);
    expect(migration).toMatch(/ALTER TABLE public\.visit_guests ENABLE ROW LEVEL SECURITY/i);
    expect(migration).toMatch(
      /REVOKE ALL ON TABLE public\.visit_guests FROM PUBLIC, anon, authenticated/i,
    );
  });

  test("registrerar bara valda aktiva medlemmar", () => {
    const body = functionBody("create_visit_with_review_v2");
    expect(body).toContain("COALESCE(_participant_ids, '{}'::uuid[])");
    expect(body).not.toMatch(/_participant_ids[\s\S]*ARRAY\[_uid\]/i);
    expect(body).toContain("public.has_membership(_group_id, participant.user_id)");
    expect(body).toContain("IF _participant_count = 0 THEN");
  });

  test("visar gästnamn bara i besökets ursprungsgrupp", () => {
    const body = functionBody("get_group_app_state_v5h");
    expect(body).toContain("WHEN visit_row.is_original THEN");
    expect(body).toContain("COALESCE(visit_row.item->'participants', '[]'::jsonb) || visit_row.guests");
    expect(body).toContain("CASE WHEN visit_row.is_original THEN 0 ELSE visit_row.guest_count END");
    expect(body).toContain("'status', 'guest'");
  });

  test("begränsar antalet och längden på gästnamn", () => {
    const body = functionBody("create_visit_with_review_v2");
    expect(body).toContain("IF _guest_count > 10 THEN");
    expect(body).toContain("Gästnamn får vara högst 60 tecken");
  });
});
