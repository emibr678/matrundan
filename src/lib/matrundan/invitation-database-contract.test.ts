import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const legacyMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260806203500_issue_142_reusable_open_invitations.sql",
  ),
  "utf8",
);
const directedMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260925013000_issue_350_internal_group_invitations.sql",
  ),
  "utf8",
);
const preflight = readFileSync(
  resolve(process.cwd(), "supabase/production-preflight-invitations.sql"),
  "utf8",
);

function functionBody(source: string, name: string): string {
  const match = source.match(
    new RegExp(
      `CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${name}\\b[\\s\\S]*?\\$function\\$;`,
      "i",
    ),
  );
  if (!match) throw new Error(`Funktionen ${name} saknas i migrationen.`);
  return match[0];
}

describe("inbjudningskontrakt", () => {
  test("behåller säkra fleranvändarlänkar", () => {
    expect(legacyMigration).toMatch(
      /ADD COLUMN IF NOT EXISTS is_multi_use boolean NOT NULL DEFAULT false/i,
    );
    const preview = functionBody(legacyMigration, "get_invitation_preview");
    const accept = functionBody(legacyMigration, "accept_group_invitation");
    expect(preview).toContain("NOT _row.is_multi_use AND _row.accepted_at IS NOT NULL");
    expect(accept).toContain("IF NOT _inv.is_multi_use THEN");
  });

  test("har en explicit riktad inbjudningsform utan token", () => {
    expect(directedMigration).toContain(
      "ADD COLUMN IF NOT EXISTS invited_user_id uuid NULL",
    );
    expect(directedMigration).toContain(
      "ADD COLUMN IF NOT EXISTS declined_at timestamptz NULL",
    );
    expect(directedMigration).toContain("ALTER COLUMN token_hash DROP NOT NULL");
    expect(directedMigration).toContain("invitations_target_shape_check");
    expect(directedMigration).toContain("invitations_one_pending_user_per_group");
  });

  test("låter alla aktiva gruppmedlemmar skapa inbjudningar utan rolleskalering", () => {
    const createLink = functionBody(directedMigration, "create_group_invitation");
    const createInternal = functionBody(
      directedMigration,
      "create_group_member_invitations",
    );

    for (const body of [createLink, createInternal]) {
      expect(body).toContain("membership.status = 'active'");
      expect(body).toContain("group_is_active");
      expect(body).not.toContain("ARRAY['owner', 'admin']");
    }
    expect(createLink).toContain("'member'");
    expect(createInternal).toContain("'member'");
  });

  test("begränsar kandidater till aktiva gemensamma grupper", () => {
    const candidates = functionBody(
      directedMigration,
      "list_group_invite_candidates",
    );
    const create = functionBody(
      directedMigration,
      "create_group_member_invitations",
    );

    expect(candidates).toContain("own_membership.status = 'active'");
    expect(candidates).toContain("other_membership.status = 'active'");
    expect(candidates).toContain("source_group.lifecycle_status = 'active'");
    expect(candidates).toContain("profile.deleted_at IS NULL");
    expect(create).toContain("source_group.lifecycle_status = 'active'");
    expect(create).toContain("cardinality(_deduped) > 25");
  });

  test("mottagaren är ensam behörig att acceptera eller avböja", () => {
    const list = functionBody(directedMigration, "list_my_group_invitations");
    const accept = functionBody(
      directedMigration,
      "accept_group_member_invitation",
    );
    const decline = functionBody(
      directedMigration,
      "decline_group_member_invitation",
    );

    expect(list).toContain("invitation.invited_user_id = auth.uid()");
    expect(accept).toContain("_invitation.invited_user_id <> _uid");
    expect(decline).toContain("_invitation.invited_user_id <> _uid");
    expect(accept).toContain("INSERT INTO public.activity");
  });

  test("vanlig medlem återkallar bara egna väntande inbjudningar", () => {
    const revoke = functionBody(directedMigration, "revoke_group_invitation");
    expect(revoke).toContain(
      "_invitation.invited_by <> _uid AND _role NOT IN ('owner', 'admin')",
    );
    expect(revoke).toContain("declined_at IS NULL");
    expect(revoke).toContain("accepted_at IS NULL");
  });

  test("medlemskapets slut återkallar avsändarens väntande inbjudningar", () => {
    const trigger = functionBody(
      directedMigration,
      "revoke_invitations_when_membership_ends",
    );
    expect(trigger).toContain("OLD.status = 'active' AND NEW.status <> 'active'");
    expect(trigger).toContain("invited_by = OLD.user_id");
    expect(directedMigration).toContain(
      "CREATE TRIGGER trg_revoke_invitations_when_membership_ends",
    );
  });

  test("behåller låst search_path och minsta nödvändiga grants", () => {
    for (const name of [
      "create_group_invitation",
      "list_group_invite_candidates",
      "create_group_member_invitations",
      "list_my_group_invitations",
      "accept_group_member_invitation",
      "decline_group_member_invitation",
      "revoke_group_invitation",
      "list_group_invitations",
      "list_own_group_invitations",
    ]) {
      expect(functionBody(directedMigration, name)).toMatch(
        /SECURITY DEFINER[\s\S]*SET search_path TO 'public'/i,
      );
    }

    expect(directedMigration).toContain(
      "REVOKE ALL ON FUNCTION public.accept_group_member_invitation(uuid)",
    );
    expect(directedMigration).toContain(
      "GRANT EXECUTE ON FUNCTION public.list_my_group_invitations()",
    );
  });

  test("har riktad produktionspreflight för båda inbjudningsformerna", () => {
    for (const key of [
      "invitations:multi-use-column",
      "invitations:directed-columns",
      "invitations:target-shape",
      "invitation_rpc:member-can-invite",
      "invitation_rpc:directed-privacy",
      "invitation_rpc:revoke-ownership",
      "invitation_rpc:public-preview-only",
    ]) {
      expect(preflight).toContain(key);
    }
  });
});
