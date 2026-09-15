<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits pushed to the branch currently selected in Lovable sync back to the
> editor. Keep that branch buildable and verify the selected branch before edits.
<!-- LOVABLE:END -->

# Matrundan agent instructions

These instructions apply repository-wide. A closer `AGENTS.md` may add rules for
its subtree. Keep context proportional: read the documents relevant to the task,
not every document by default.

## Read by task

- `docs/product-roadmap.md` — product direction, packages, priority and backlog
  ordering.
- `docs/architecture.md` — durable data, privacy and security decisions. Follow
  its linked specialist architecture documents when the task touches them.
- `docs/platform-migration-plan.md` — platform boundaries and the active work in
  Issue #207.
- `docs/development-workflow.md` — planning, implementation, verification,
  Lovable, merge, database deployment and publication.
- `docs/visual-review.md` — rendered GUI/UX review and opt-in Lovable rules.
- `DEVELOPMENT.md` — environment setup and canonical commands.
- `CHANGELOG.md` and `src/lib/matrundan/version.ts` — releases.

Inspect current code, docs, `main` and relevant open PRs before assuming paths,
APIs or implementation details are unchanged.

## Product constitution

Matrundan is a private, group-centred app for friends and families who discover,
choose, visit and remember food places together. Search, maps, statistics,
recommendations and gamification support that shared journey; they must not turn
the product into a public restaurant catalogue, review platform, social feed,
individual food diary, generic map service or global leaderboard.

Preserve these invariants:

- The group is the primary product and privacy boundary; group data is private
  and isolated.
- Real places and visits are canonical entities. Link or share them instead of
  silently duplicating them.
- Sharing must not expose the source group, private comments, membership or
  internal identifiers.
- Only actual visit participants receive progression. Registration gives no
  extra credit and repeat visits count.
- Gamification is warm, discreet, private and secondary.
- Saved search areas are preselected search centres, never access or geography
  limits. All are selected when search opens and none is primary.
- Product copy is natural Swedish unless a technical identifier must remain in
  English.
- Example group, demo and authenticated live mode must remain coherent in
  parallel.
- Supported main flows must not have horizontal overflow at 360 px.

## Change control and sources of truth

For a new feature or larger change, inspect the relevant issue, implementation,
database and durable docs; separate product decisions from technical design; and
produce a concrete plan covering edge cases, privacy/security, migration/tests
and the example group when relevant. Do not implement until the user explicitly
approves implementation.

Implementation approval is separate from approval to merge, deploy database
changes or publish. Do not broaden approved scope silently. Corrective docs and
small maintenance may be changed inside an explicit review task only when they
do not introduce product behaviour.

GitHub Issues + labels are the operational backlog. The roadmap is the strategic
product view and GitHub Project is a human-facing projection. Follow the label
semantics documented in the roadmap rather than reproducing them here. When a
roadmap issue changes relative order, keep its `order:*` label and the roadmap
consistent.

In human-facing status and planning, write **Issue #NNN — full title** and
**PR #NNN — full title** when the namespaces could be confused. Machine
references such as `Closes #NNN` remain appropriate in PR metadata.

Do not use chat history, README, a temporary Lovable plan or Project-only fields
as the sole source for durable product or architecture decisions.

## Architecture and security guardrails

- Sensitive reads are group-scoped and require validated membership/role where
  appropriate.
- Sensitive writes belong behind validated server/RPC boundaries; never trust
  client-supplied group, user, author, owner or source-group identity by itself.
- Keep raw provider payloads, source-group identity and privileged credentials
  server-side. Browser-exposed configuration is not a secret.
- Migrations preserve existing production data unless destructive behaviour is
  explicitly approved and documented.
- Place/provider identities and canonical coordinates must remain independent
  of the current map renderer.
- Keep hosting, auth delivery, storage/media, notifications, scheduled jobs,
  provider integrations and observability replaceable at explicit boundaries.
  Do not move domain/privacy rules into vendor callbacks or UI components for
  convenience.
- Web/PWA is the current client, not the domain or security boundary. Avoid
  unnecessary DOM/router coupling in reusable domain logic.
- Portability does not justify speculative wrappers or architectural layers;
  introduce abstractions where a real boundary or replacement risk exists.

When a task changes data model, auth, sharing, privacy, Geoapify/OSM, media,
notifications or gamification, read `docs/architecture.md` and the relevant
specialist document before editing.

## Implementation and verification discipline

Before implementation, verification or merge, re-check current `main` and
relevant open PRs for file and semantic conflicts. Use one branch/PR per coherent
approved task and keep unrelated refactors out.

For non-trivial bugs: reproduce with runtime evidence, state a falsifiable
hypothesis, make the smallest targeted change and remove temporary diagnostics
once the root cause is resolved.

Use the narrowest check that can falsify the current candidate first, then widen
verification as it stabilises. Canonical commands live in `DEVELOPMENT.md` and
`package.json`. Never claim a check, migration, Lovable sync, preview,
deployment or publication happened without evidence.

All rendered GUI changes must also follow the local `src/AGENTS.md` and
`docs/visual-review.md`. Lovable is strictly opt-in: do not consult Lovable,
invoke Lovable implementation, sync a branch to Lovable or create a Lovable
preview unless the user explicitly asks for Lovable in the current task. Normal
rendered review uses repository/browser tooling. When Lovable is requested,
branch selection and head sync must be verified before it writes code. Preview
is review, not publication.

GitHub Actions verify code; they must not patch or push product code back to a
branch. Do not create commits solely to trigger CI and do not rewrite pushed
history that may have synced to Lovable.

Before merge, require the agreed scope, reviewed diff, relevant green checks,
required rendered UX evidence, any explicitly requested Lovable evidence and no
known blocker. Database deployment and publication remain separate approvals.

After a candidate or merge, use the visually structured chat receipt in
`docs/development-workflow.md` and report the relevant evidence without blending
merge, Lovable, database or publication status. Always include the `Preview:`
field. Before handing off a GUI candidate, read the canonical `Mobile PR handoff`
comment for the current PR head and use its exact verified preview URL; if the
candidate has no rendered surface, state `Preview: Inte relevant` with a short
reason instead of omitting the field.

## Documentation lifecycle

Each durable fact should have one natural owner:

- README — concise human-facing project entry.
- roadmap — product direction, packages and priority.
- Issues — detailed current scope and operational backlog state.
- architecture + specialist architecture docs — durable design/privacy/security
  decisions.
- DEVELOPMENT — environment and commands.
- development-workflow — delivery process and chat receipt.
- visual-review — rendered UX and opt-in Lovable rules.
- CHANGELOG + in-app version history — released user-facing history.

A new document or agent rule should remove uncertainty or contain unique durable
information, not merely repeat another source. Short-lived implementation plans
and delivery status normally belong in an Issue/PR. Once finished, preserve
lasting decisions in their canonical owner and remove or archive the temporary
plan only when it has genuine historical value.
