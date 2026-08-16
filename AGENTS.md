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

These instructions apply to the entire repository.

Read:

- [`docs/product-roadmap.md`](docs/product-roadmap.md) before planning a backlog
  feature, changing product priority or revisiting an agreed scope;
- [`docs/architecture.md`](docs/architecture.md) before changing the data model,
  authentication, sharing, Geoapify, group privacy, notifications or
  gamification;
- [`docs/platform-migration-plan.md`](docs/platform-migration-plan.md) before
  changing hosting/runtime, auth delivery, storage/media, deployment, backups,
  deep links or another platform boundary covered by #207;
- [`docs/development-workflow.md`](docs/development-workflow.md) before
  implementing, debugging, verifying, merging or reporting Lovable sync;
- [`docs/visual-review.md`](docs/visual-review.md) before a larger visual,
  layout or responsive change;
- [`DEVELOPMENT.md`](DEVELOPMENT.md) before setting up or changing the
  development environment.

## Product guardrails

Matrundan is a private, group-centred app for friends and families who explore
restaurants and cafés together. It is not a public review site, public social
feed, individual food diary, generic map service or global leaderboard.

Preserve these rules:

- The group is the primary product and privacy boundary.
- Group content is private and isolated between groups.
- Never expose the source group's identity, private comments, membership or
  internal identifiers when a visit is shared.
- `places` and `visits` are canonical real-world entities. Sharing links to them
  instead of duplicating them.
- Only actual visit participants receive progression. Registration gives no
  extra credit.
- Repeat visits count.
- Gamification is warm, discreet, private and secondary.
- Saved search areas are prefilled search centres, never geographical limits.
- All saved search areas are selected by default; there is no primary area.
- Product copy is Swedish unless a technical identifier must remain English.
- Keep example, demo and authenticated live mode working side by side.
- Treat 360 px layout as a supported target, not an edge case.

## Platform portability and client independence

These are durable architecture guardrails even while Lovable remains the current
runtime and preview workflow:

- Treat hosting, auth delivery, storage/media, notifications delivery, scheduled
  jobs, map rendering, provider integrations and observability as replaceable
  platform adapters around Matrundan's domain and security model.
- Keep provider-specific code at explicit boundaries. Do not move group,
  membership, place, visit, sharing or progression rules into deployment
  bindings, vendor callbacks or React components just because a provider makes
  that convenient.
- Web/PWA is the current primary client, not the domain or security boundary.
  Backend contracts, auth, deep links, media access and notification intent must
  remain usable by a future native client without redefining Matrundan's core
  model.
- Do not make general domain logic depend on DOM, `window`, TanStack Router or
  other web-only APIs when that dependency is not inherent to the behaviour.
- Preserve canonical HTTPS links for invitations and shareable objects so they
  can later become Universal Links/App Links without changing identity.
- Keep canonical coordinates and external place identities independent of the
  current map renderer.
- Portability does not require speculative wrappers, a monorepo or a native app.
  Introduce an adapter when a boundary is sensitive, stateful, costly to replace
  or has a concrete second implementation.
- #207 defines the current migration target. These principles do not authorize
  implementation, runtime migration, database cutover or publication.

## Product discussion, planning and implementation

For a new feature, large change or explicit planning request:

1. inspect the related GitHub Issue and `docs/product-roadmap.md` when the work
   belongs to the backlog;
2. inspect actual implementation and relevant database objects;
3. discuss the decision against Matrundan's shared food journey;
4. produce a concrete plan with edge cases, security and tests;
5. assess whether the example group or scenario contract must change;
6. do not modify files, migrations, database state, commits or deployments
   until implementation is explicitly approved.

`plan_mode`, “Gör endast en plan” and “ej implementation” are absolute.

For approved implementation, make the smallest coherent change that satisfies
the agreed scope. Do not silently broaden the task.

Implementation approval is not approval for merge, database deployment or
publication. These are separate phases and approvals.

Corrective documentation and small maintenance may be performed within an
explicit review request, but must not introduce new product behaviour.

GitHub Issues and their labels are the operational backlog. Preserve documented
product choices instead of reopening them from chat history alone. New ideas
begin in `status:inbox`; implementation begins after a current plan is approved
and the issue is `status:ready`.

Preserve the backlog-ordering contract:

- `priority:now`, `priority:next` and `priority:later` describe horizon;
  `order:010`, `order:020`, ... describe an explicitly decided relative queue.
- Give an open issue at most one `order:*` label and do not rank inbox or the
  whole later backlog just to make the list look complete. No `order:*` means
  not exactly sequenced.
- Parent/epic issues spanning multiple deliveries should normally remain
  unranked; split and rank the concrete deliverable child issues instead.
- GitHub Project is a human-facing projection of issues and labels, not a
  separate source of truth. Do not rely on Project-only fields for status,
  priority or order that agents need to read.
- When the order of roadmap issues changes, keep issue `order:*` labels and
  `docs/product-roadmap.md` consistent in the same work.
- Update `docs/product-roadmap.md` when package, priority, relative order between
  roadmap issues or a durable product decision changes, not for every commit.
- In human-facing reports and planning, identify work as **Issue #NNN — full
  title** or **PR #NNN — full title** rather than using a bare `#NNN` when the
  two namespaces could be confused. GitHub machine references such as
  `Closes #NNN` remain valid inside PR metadata.

## Implementation and diagnostics

- Reuse a valid checkout. Clone only when the environment is new, missing or
  cannot be verified safely.
- Use one branch and PR per coherent approved task.
- Start non-trivial bugs with reproduction and runtime evidence.
- Form a falsifiable hypothesis before repeated code changes.
- Keep exploratory iterations local and push a coherent candidate.
- Do not create commits solely to trigger CI.
- GitHub Actions verify code. Do not add workflows that patch, commit or push
  product code back to a branch.
- Remove temporary diagnostics when the root cause is resolved.
- Run the full relevant browser matrix before merge when a changed flow needs it.
- Report exact branch, commit, PR, CI, Lovable sync, preview, database and
  publication status.

## Lovable consultation and implementation

Separate consultation from implementation.

### Consultation

When the user explicitly asks to discuss or review UX with Lovable, consult
Lovable in Plan mode before locking the visual solution, when the tool is
available. Do not silently skip the consultation because branch switching cannot
be controlled automatically. Report the limitation when consultation fails.

### Implementation on the PR branch

The normal isolated Lovable workflow is a dedicated GitHub feature branch plus
GitHub branch switching inside Lovable:

1. create the feature branch from verified current `main`;
2. open or prepare a draft PR from that branch;
3. select the exact PR branch in Lovable;
4. verify branch name and current head SHA before Lovable writes code;
5. use Agent mode when the user explicitly requested Lovable UX implementation
   and credits are available;
6. review Lovable's diff and continue through normal PR verification.

Do not use internal or undocumented “variant” terminology as the primary
workflow. If the correct branch cannot be selected or verified, Lovable must not
write code. Pause and ask the user to select the branch in the Lovable editor.
Do not silently replace explicitly requested Lovable implementation with a full
visual implementation by Codex or ChatGPT.

Codex/ChatGPT remains responsible for product scope, architecture, security,
data boundaries, tests and final code review. Lovable is preferred for visual
hierarchy, layout, spacing, responsiveness and interaction polish when the user
requests it.

Collect visual iterations into one coherent candidate. Never experiment directly
on `main`. A branch does not imply an isolated database.

## Preview gate for visual changes

For larger changes to layout, hierarchy, responsiveness or a main flow, merge
requires all of the following:

- exact PR branch and current head SHA are documented;
- the same PR branch is selected in Lovable;
- Lovable sync matches current PR head or a documented later commit on the same
  PR branch;
- a current Lovable preview link is sent to the user in chat;
- the preview is reviewed at minimum at 360 px and desktop;
- demo/example and authenticated live mode are compared when relevant;
- the user explicitly approves merge after preview review.

If branch, sync or preview cannot be verified, keep the PR draft or not ready.
Renew an expired preview link before review.

For backend-only, documentation-only or invisible technical changes, preview is
normally not a merge requirement. State why in the PR.

Preview, GitHub diff, browser checks, screenshot artifacts and CI are separate
evidence. None replaces the others. Preview is not publication.

Use the opt-in **Visual review artifacts** workflow for complementary screenshots.
It is not a pixel-diff gate.

`.lovable/plan.md` is temporary and must not reach a finished PR or `main`
unless explicitly approved as durable documentation.

## Codex Cloud environment

- Setup: `bash scripts/codex-cloud-setup.sh`.
- Maintenance: `bash scripts/codex-cloud-maintenance.sh`.
- Do not install another package manager or create an alternate lockfile.
- Keep agent internet access off unless an approved task requires narrowly
  allowlisted network access.
- Chromium is installed by setup; WebKit remains a ready-CI responsibility.
- Run `bun run doctor` when environment state is uncertain.

## Repository map

- `src/routes/` — routed views such as Hem, Matställen and Gruppen.
- `src/components/matrundan/` — product UI and dialogs.
- `src/components/ui/` — shared shadcn/Radix primitives.
- `src/lib/matrundan/types.ts` — client read-model types.
- `src/lib/matrundan/store.tsx` — local/live state boundary.
- `src/lib/matrundan/live-repository.ts` — secure read-model mapping.
- `src/lib/matrundan/live-mutations.ts` and `live-admin.ts` — approved live
  writes.
- `src/lib/matrundan/rpc-client.ts` — central validated RPC boundary.
- `src/lib/matrundan/geoapify.functions.ts` — server-side Geoapify functions.
- `src/lib/matrundan/search-areas.ts` — search-area domain rules.
- `src/lib/matrundan/gamification.ts` — deterministic progression.
- `src/lib/matrundan/version.ts` — published version and in-app changelog.
- `supabase/migrations/` — schema, RPC, RLS and Storage changes.
- `scripts/` — reproducible setup and verification tooling.
- `docs/product-roadmap.md` — product packages, priorities and backlog workflow.
- `docs/architecture.md` — architecture and security decisions.
- `docs/platform-migration-plan.md` — #207 target architecture, portability and
  migration/rollback plan.
- `docs/development-workflow.md` — delivery workflow.
- `docs/visual-review.md` — Lovable branch, preview and screenshot process.
- `DEVELOPMENT.md` — runtime, setup and verification commands.
- `README.md` — current human-facing project overview.
- `CHANGELOG.md` — released and unreleased user-facing history.

Inspect the current tree before assuming paths or APIs are unchanged.

## Data and security rules

- Sensitive reads remain scoped to one group and require active membership.
- The primary live read boundary is `get_group_app_state_v5i(_group_id)`, with
  fallback to v5h only when the newer RPC explicitly does not exist.
- Do not reintroduce direct client `SELECT` access to canonical visits,
  participants, reviews, sharing links, visibility tables or search-area data.
- Writes use validated `SECURITY DEFINER` RPCs or server functions with locked
  `search_path` and explicit membership/role checks.
- Revoke callable functions from `PUBLIC` and `anon`; grant only intended roles.
- Never trust client-supplied group, user, author, owner or source-group identity
  without server-side validation.
- Keep `source_group_id` and raw provider payloads server-only.
- Preserve historical membership data without granting former members current
  access or leaderboard placement.
- Provider places and search areas deduplicate primarily by active provider and
  provider place ID. Preserve superseded source links instead of rewriting
  historical visits.
- Do not guess coordinates from unverified free text.
- Store secrets only in Lovable Cloud Secrets while Lovable remains the active
  production runtime. Never commit them, expose them through `VITE_`, return
  them to the client or print them in logs. A future runtime secret store must
  preserve the same server-only boundary.
- Migrations preserve existing production rows unless destructive behaviour is
  explicitly approved and documented.

## Search-area invariants

- A group may save at most five verified Geoapify search areas.
- There is no primary area; all saved areas are selected when search opens.
- One shared default radius applies to all selected areas.
- Supported radii are 1, 2, 3, 5, 10, 25 and 50 km.
- Temporary locations are search-session data and are not saved automatically.
- Multi-area results deduplicate by provider identity and use the shortest
  distance to a selected area.
- Previously removed places appear as normal add candidates and reactivate the
  existing `group_places` relationship.
- Active group places belong under **Redan i gruppen**, not among primary add
  candidates.

## Canonical place and visit invariants

- One real place corresponds to one canonical `places` row.
- External place identities and lifecycle belong to `place_sources`.
- Group notes, occasions, website override and lifecycle belong to
  `group_places`.
- Raw provider payloads must not be returned in the group read-model.
- One real visit corresponds to one canonical `visits` row.
- A visit has exactly one original group link and may have shared links.
- Sharing or unlinking must not duplicate or delete canonical place, visit,
  participants or reviews.
- Reviews are canonical per visit/user; visibility is controlled per group.
- External participants are anonymous counts, not group members.
- A canonical visit must never count twice in one group's progression.
- Private visit media belongs only to the original group's visit link and never
  follows a shared visit.

## Gamification rules

- Derive levels, badges, leaderboards and milestones from current read-model.
- Do not store mutable score or badge ownership without an approved design.
- Deduplicate by `Visit.id` before progression calculations.
- Respect group and visit settings for shared progression.
- Active members may appear in current leaderboards; historical members remain
  only in allowed history.
- Do not reward clicks, comments, ratings, registration or administration.

## UI and accessibility

- Follow the existing warm, simple, rounded and restrained visual language.
- Prefer existing components over parallel UI systems.
- Avoid duplicate displays of the same information.
- Keep primary actions clear and destructive actions secondary with confirmation.
- Maintain keyboard behaviour and ARIA semantics for autocomplete, dialogs,
  tabs, sheets and collapsibles.
- Use practical 44 px touch targets.
- Test long Swedish labels, wrapping and software keyboard behaviour.
- No horizontal overflow is acceptable in supported 360 px flows.
- Search-area pills wrap; they do not require horizontal scrolling.

## Validation before completion

During iteration, run the narrowest check that can falsify the current
hypothesis.

Normal candidate:

```bash
bun run verify:changed
```

Changed UI:

```bash
bun run verify:agent
```

Visual review artifact when relevant:

```bash
bun run test:visual-review
```

Release candidate:

```bash
bun run verify:full
```

Use `bun run typecheck` as the canonical TypeScript command. Run focused tests
for changed domain modules and `bun run test:map` for map-specific changes.

For database/RPC changes, inspect definitions and verify:

- membership and role checks;
- `SECURITY DEFINER` and locked `search_path`;
- grants for `PUBLIC`, `anon`, `authenticated` and `service_role`;
- cross-group isolation;
- preservation of existing rows.

Do not claim a test was run unless it was actually run. State explicitly when
an authenticated live browser test was unavailable.

## Releases and documentation

For a published release:

- update `src/lib/matrundan/version.ts` and in-app history;
- move the release from **Unreleased** to a dated entry in `CHANGELOG.md`;
- update `README.md` when current capability or limitation changes;
- update `docs/product-roadmap.md` when package, priority or active scope changes;
- update `docs/architecture.md` when a durable decision changes;
- keep version and deployment status consistent;
- publish only after relevant checks are green and approval is explicit.

README must not duplicate a long release history or act as a parallel backlog.
Completed plans should be removed or archived after durable decisions are
captured in architecture, roadmap and changelog.

Documentation-only commits do not require app publication unless the app reads
the changed file.

## Git discipline

- Never force-push or rewrite pushed history.
- Do not amend or rebase commits already synced to Lovable.
- Keep `main` buildable and coherent after each commit.
- Prefer focused commits with descriptive messages.
- Do not push every exploratory edit.
- Do not create commits only to trigger CI.
- Do not use self-modifying workflows to write or push product code.
- Do not make iterative visual experiments directly on `main`.
- Do not merge larger visual changes without a verified PR-branch preview link
  and the user's review.
- Inspect branch and latest commit before modifying files because Lovable and
  GitHub can both advance the repository.