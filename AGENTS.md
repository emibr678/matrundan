<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Matrundan agent instructions

These instructions apply to the entire repository. Read
[`docs/architecture.md`](docs/architecture.md) before changing the data model,
sharing, authentication, Geoapify integration, group privacy, or gamification.

## Product guardrails

Matrundan is a private, group-centred app for friends and families who explore
restaurants and cafés together. It is not a public review site, a public social
feed, or a global leaderboard.

Preserve these rules:

- Group content is private and isolated between groups.
- Never expose the source group's identity, private comments, membership, or
  internal identifiers when a visit is shared.
- `places` and `visits` are canonical real-world entities. Sharing must link to
  them rather than duplicate them.
- Only actual visit participants receive progression. The user who registers a
  visit gets no extra credit.
- Repeat visits count and are part of the product.
- Gamification is warm, discreet, and secondary. No global/public rankings.
- A group's default search area is only a prefilled search location, never a
  geographical restriction.
- Product copy is Swedish unless a technical identifier must remain English.
- Keep demo mode and authenticated live mode working side by side.
- Treat 360 px mobile layout as a supported target, not an edge case.

## Planning versus implementation

For large features, architecture changes, or explicit planning requests:

1. Inspect the actual implementation and relevant database objects.
2. Produce a concrete plan with edge cases and tests.
3. Do not modify files, migrations, database state, commits, or deployments
   until the user explicitly approves implementation.

`plan_mode`, "Gör endast en plan", and "ej implementation" are absolute. Do
not interpret them as permission to create a draft implementation.

For approved implementation, make the smallest coherent change that satisfies
the agreed specification. Do not silently broaden scope.

## Repository map

- `src/routes/` — routed pages such as Hem, Matställen and Gruppen.
- `src/components/matrundan/` — product-specific UI and dialogs.
- `src/components/ui/` — shared shadcn/Radix primitives; prefer reuse.
- `src/lib/matrundan/types.ts` — client read-model types.
- `src/lib/matrundan/store.tsx` — demo/live state boundary and store access.
- `src/lib/matrundan/live-repository.ts` — mapping from the secure live
  read-model into application state.
- `src/lib/matrundan/live-mutations.ts` — approved live write calls.
- `src/lib/matrundan/gamification.ts` — deterministic derived progression.
- `src/lib/matrundan/version.ts` — application version and in-app changelog.
- `src/server/` — server-only integrations, including Geoapify.
- `supabase/migrations/` — schema, RPC, RLS and database changes.
- `docs/architecture.md` — canonical architecture and security decisions.
- `README.md` — current human-facing project overview.
- `CHANGELOG.md` — release history.

Inspect the current tree before assuming these paths or APIs are unchanged.

## Data and security rules

- Sensitive reads must remain scoped to one group and require active
  membership. Prefer the existing `get_group_app_state(_group_id)` read-model.
- Do not reintroduce direct client `SELECT` access to canonical visits,
  participants, reviews, sharing links, or visibility tables.
- Writes must use validated `SECURITY DEFINER` RPCs or server functions with a
  locked `search_path` and explicit membership/role checks.
- Revoke callable database functions from `PUBLIC` and `anon`; grant only the
  intended role, normally `authenticated`.
- Never trust a client-supplied group, user, author, owner, or source-group
  identity without server-side validation.
- Keep `source_group_id` server-only.
- Preserve historical membership data without granting former members current
  access or placing them in active leaderboards.
- Provider places are deduplicated primarily by provider and provider place ID.
- Do not guess a location from unverified free text when coordinates matter.
- Store secrets only in Lovable Cloud Secrets. Never commit them, expose them
  through `VITE_` variables, return them to the client, or print them in logs.
- Database migrations must preserve existing production rows unless destructive
  behaviour is explicitly approved and documented.

## Canonical and shared visit invariants

- One real place corresponds to one canonical `places` row.
- Group-specific notes, occasions and origin belong to `group_places`.
- One real visit corresponds to one canonical `visits` row.
- A visit has exactly one original group link and may have shared links.
- Sharing or unlinking a visit must not duplicate or delete the canonical
  place, visit, participants or reviews.
- Reviews are canonical per visit/user; visibility is controlled per group.
- External participants are represented anonymously as a count and must not be
  treated as group members.
- The same canonical visit must never count twice in one group's progression.

## Gamification rules

- Derive levels, badges, leaderboards and milestones from the current read-model.
- Do not store a mutable score, cached badge ownership, or gamification activity
  event unless a future approved design explicitly requires it.
- Deduplicate by canonical `Visit.id` before all progression calculations.
- Respect both the group's shared-progression setting and the visit's
  `countsForProgression` value.
- Active members may appear in current leaderboards; historical members may
  remain visible in historical visit data.
- Do not reward clicks, comments, ratings, registration work, or administration.

## UI and accessibility

- Follow the existing visual language: warm, simple, rounded and restrained.
- Prefer existing components and patterns over adding parallel UI systems.
- Avoid competing representations of the same information.
- Primary actions must be clear; advanced or destructive actions stay
  secondary and require suitable confirmation.
- Maintain keyboard behaviour and ARIA semantics for autocomplete, dialogs,
  tabs and sheets.
- Interactive targets should be at least 44 px where practical.
- Test long Swedish labels, wrapping, dialog widths and sheets at 360 px.
- No horizontal page overflow is acceptable on supported mobile views.

## Validation before completion

Run the checks relevant to the change. For a normal release candidate, run:

```bash
bunx tsgo --noEmit
bunx eslint <all changed source files>
bun run build
```

Also run focused tests, for example:

```bash
bun test src/lib/matrundan/gamification.test.ts
```

For changed mobile flows, use a real browser/Playwright check at 360 px and
measure that `document.documentElement.scrollWidth <= clientWidth`.

For database/RPC changes, inspect production-compatible definitions and verify:

- membership and role checks;
- `SECURITY DEFINER` and locked `search_path` where applicable;
- grants for `PUBLIC`, `anon` and `authenticated`;
- cross-group isolation;
- preservation of existing rows.

Do not claim a test was run unless it was actually run. State explicitly when
an authenticated live browser test was not possible.

## Releases and documentation

For a release:

- update `src/lib/matrundan/version.ts` and its in-app changelog;
- update `README.md` when current capabilities or limitations change;
- add a correctly headed entry to `CHANGELOG.md`;
- update `docs/architecture.md` when an invariant or architecture decision
  changes;
- keep the version number consistent across all locations;
- publish only after relevant checks are green;
- report the exact commit and actual deployment status.

Documentation-only commits do not require an application deployment unless the
published application itself reads the changed file.

## Git discipline

- Never force-push or rewrite published history.
- Do not amend, rebase or squash commits already synced to Lovable.
- Keep `main` buildable and coherent after each commit.
- Prefer focused commits with descriptive messages.
- Inspect the current branch and latest commit before modifying files because
  Lovable and GitHub can both advance the connected branch.