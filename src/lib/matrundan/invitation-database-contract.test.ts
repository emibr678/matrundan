import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260806203500_issue_142_reusable_open_invitations.sql",
  ),
  "utf8",
);
const preflight = readFileSync(
  resolve(process.cwd(), "supabase/production-preflight-invitations.sql"),
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

describe("inbjudningskontrakt", () => {
  test("lägger till ett explicit och säkert fleranvändarfält", () => {
    expect(migration).toMatch(
      /ADD COLUMN IF NOT EXISTS is_multi_use boolean NOT NULL DEFAULT false/i,
    );
    expect(migration).toContain("CHECK (NOT is_multi_use OR invited_email IS NULL)");
    expect(migration).toContain("accepted_at IS NULL");
    expect(migration).toContain("revoked_at IS NULL");
    expect(migration).toContain("expires_at >= now()");
  });

  test("gör bara nya eller fortsatt aktiva öppna länkar fleranvändbara", () => {
    const create = functionBody("create_group_invitation");
    expect(create).toContain("_is_multi_use := _email IS NULL");
    expect(create).toContain("is_multi_use");
    expect(create).toContain("'is_multi_use', _is_multi_use");
  });

  test("förbrukar bara e-postbundna engångsinbjudningar", () => {
    const preview = functionBody("get_invitation_preview");
    const accept = functionBody("accept_group_invitation");

    expect(preview).toContain("NOT _row.is_multi_use AND _row.accepted_at IS NOT NULL");
    expect(accept).toContain("IF NOT _inv.is_multi_use AND _inv.accepted_at IS NOT NULL THEN");
    expect(accept).toContain("IF NOT _inv.is_multi_use THEN");
    expect(accept).toContain("SET accepted_at = now(), accepted_by = _uid");
  });

  test("är idempotent för aktiva medlemmar utan dubbla aktiviteter", () => {
    const accept = functionBody("accept_group_invitation");
    const activeMemberBranch = accept.match(
      /IF _existing\.status = 'active' THEN[\s\S]*?RETURN jsonb_build_object\('group_id', _inv\.group_id, 'already', true\);/i,
    )?.[0];

    expect(activeMemberBranch).toBeDefined();
    expect(activeMemberBranch).not.toContain("INSERT INTO public.activity");
    expect(accept).toContain("IF _joined THEN");
    expect(accept).toContain("INSERT INTO public.activity");
  });

  test("håller fleranvändarlänken aktiv och möjlig att återkalla", () => {
    const list = functionBody("list_group_invitations");
    const revoke = functionBody("revoke_group_invitation");

    expect(list).toContain("WHEN NOT i.is_multi_use AND i.accepted_at IS NOT NULL");
    expect(revoke).toContain("AND (is_multi_use OR accepted_at IS NULL)");
  });

  test("behåller låst search_path och minsta nödvändiga grants", () => {
    for (const name of [
      "create_group_invitation",
      "get_invitation_preview",
      "accept_group_invitation",
      "revoke_group_invitation",
      "list_group_invitations",
    ]) {
      expect(functionBody(name)).toMatch(/SECURITY DEFINER[\s\S]*SET search_path = public/i);
    }

    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.accept_group_invitation(text) FROM PUBLIC, anon",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_invitation_preview(text) TO anon, authenticated",
    );
  });

  test("har en riktad produktionspreflight", () => {
    expect(preflight).toContain("invitations:multi-use-column");
    expect(preflight).toContain("invitations:multi-use-open-only");
    expect(preflight).toContain("invitation_rpc:multi-use-semantics");
    expect(preflight).toContain("invitation_rpc:protected-writes");
    expect(preflight).toContain("invitation_rpc:public-preview-only");
  });
});
