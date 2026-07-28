# Matrundan architecture

This document describes the architectural source of truth for Matrundan as of
v0.12.0. It focuses on durable decisions and invariants rather than a complete
schema dump. When code, migrations and this document disagree, inspect the
latest production-compatible migration and fix the documentation in the same
change.

## 1. Product boundary

Matrundan is a private application for groups of friends and families who want
to collect places, choose what to try next, register real visits and preserve a
shared food history.

The product is deliberately not:

- a public restaurant catalogue or public review platform;
- a public social network;
- a cross-group recommendation engine;
- a global competition or leaderboard.

The group is the primary privacy and product boundary. Canonical data may be
shared technically across groups, but the visible context remains private to
each group.

## 2. Runtime modes

### Public landing mode

Anonymous users enter a public landing experience without loading a group store
or any group data. The landing page offers three explicit paths:

- authenticate and create a private group;
- open an existing token-based invitation;
- explore the read-only example group.

Direct invitation routes remain available without passing through the landing
page. The landing experience must not masquerade as membership in a group.

### Read-only example mode

`/exempel` opens **Fredagsgänget**, permanently labelled
**Exempelgrupp · Stockholm**. It uses fixed `EXAMPLE_STATE` data:

- displayed places are real Stockholm places;
- members, visits, ratings, comments, favourites and activity are fictional;
- no source group, private user or live membership data is involved.

The example is read-only in both the UI and the central store mutation boundary.
It must not hydrate from or persist to the writable demo `localStorage` state,
call live write APIs or invoke third-party providers unnecessarily. Navigation
inside the example preserves example mode until authentication starts or the
session is explicitly left.

### Internal demo sandbox

The explicit `?demo=1` sandbox remains available for development and regression
tests. It stores Swedish sample data in the browser and mirrors live behaviour
closely enough to exercise write flows. It is not a public onboarding path and
must not be presented as the user's real group.

### Live mode

Live mode uses Google authentication through Lovable Cloud and Supabase. The
active group determines the only group read-model loaded into the application
store.

Transitions between landing, example, demo and live state must be deterministic.
Logging out must clear live group state rather than leaving a previous group's
data in the client store. Starting authentication from the example must clear
the example-session marker before redirecting.

## 3. High-level application layers

### UI and routes

- `src/routes/` contains routed pages.
- `src/components/matrundan/` contains product components and dialogs.
- `src/components/ui/` contains shared shadcn/Radix primitives.

UI components consume the application read-model and should not reconstruct
security decisions themselves.

### Application state and repositories

- `src/lib/matrundan/types.ts` defines the client-side read-model.
- `src/lib/matrundan/store.tsx` provides the demo/live store boundary and
  central read-only enforcement for the example group.
- `src/lib/matrundan/example-data.ts` defines the fixed public example state.
- `src/lib/matrundan/demo-data.ts` defines writable local sandbox data.
- `src/lib/matrundan/live-repository.ts` maps the server read-model into
  application types.
- `src/lib/matrundan/live-mutations.ts` contains approved live mutations.

The UI should use these boundaries instead of issuing ad hoc database queries.
The public landing page is deliberately rendered outside `StoreProvider`.

### Server integrations

Server-only code handles secrets and third-party calls. Geoapify requests are
made server-side, and only a normalised response is returned to the browser.

### Database

Supabase/PostgreSQL stores canonical entities, group relationships,
memberships, invitations, reviews, favourites and activity. Sensitive access
is mediated through RLS, grants and membership-validating RPC functions.

## 4. Identity and memberships

### Profiles

A profile represents an authenticated user. Profile data may be shown inside a
group when the viewer is permitted to see the member or historical participant.

### Groups

A group is the private collaboration boundary. A user can be an active member
of multiple groups and can switch active group in the client.

The example group is not a database group, is never added to the authenticated
user's group list and grants no membership or permissions.

### Membership lifecycle

Memberships have a role and lifecycle state. Active membership grants current
access. Historical membership may remain so that old visits can retain names
and attribution without restoring access.

Important invariants:

- a former member must not regain access through historical data;
- only active members appear in current group leaderboards;
- ownership cannot be silently removed or demoted;
- ownership transfer must be atomic;
- exactly one active owner must exist per group;
- rejoining does not implicitly restore an old owner role.

## 5. Canonical place model

### `places`

`places` represents a real-world place independently of any group. Canonical
identity prevents two groups from creating separate copies of the same provider
place.

Provider-backed places use `(provider, provider_place_id)` as their primary
duplicate identity. Name and address matching may be useful as a fallback for
manual data but is not a substitute for a provider ID.

### `place_sources`

Provider metadata is associated with the canonical place. Raw third-party
payloads should not be sent to the browser or treated as stable application
schema.

### `group_places`

`group_places` represents one group's relationship to a canonical place. This
is where group-specific information belongs, including:

- notes;
- occasions or suitability labels;
- group-specific category and cuisine/speciality overrides;
- who added the place to the group;
- when it was added;
- origin of the group relationship;
- lifecycle state for whether the place is currently in the group's active list.

Known origin semantics are normalised in the client as:

- `manual` — created manually in the group;
- `provider` — added from an external provider search in the group;
- `shared` — introduced through a shared visit.

The database value `shared_visit` maps to client origin `shared`. Unknown origin
values must fail safe as shared/imported rather than manual, because manual
fallback could incorrectly award proposal-based gamification.

### Group-place lifecycle

Removing a place from the group is a soft lifecycle change on `group_places`,
not deletion of the canonical `places` row. The user-facing product language is
"Ta bort från gruppen", not archive/canonical terminology.

A removed group-place relationship must:

- disappear from the active place list and map;
- be ineligible for next stop and random selection;
- not contribute as an active place to planning or progression views;
- keep canonical visits, participants and reviews intact;
- remain readable when reached through historical visits;
- show a neutral status such as "Inte längre i gruppens lista".

There is no ordinary user-facing archive list for removed places. Re-adding is
performed through the normal Add place flow. Provider-backed matches use the
provider identity; manual matches use the approved name/address fallback. A
match must reactivate the existing `group_places` relationship rather than
create a duplicate and must preserve earlier notes, occasions, cuisine tags and
other group metadata unless the user explicitly changes them.

### Default search area

A group's default search area is optional structured Geoapify data:

- display label;
- provider;
- provider place ID;
- latitude;
- longitude.

It is only a default search centre. It does not constrain where the group may
add or visit places.

Legacy free-text areas may remain visible until an owner chooses a verified
Geoapify result. The application must not invent coordinates for legacy text.

## 6. Canonical visit model

### `visits`

`visits` represents a real visit once, independent of how many groups can see
it. It does not contain a group ID in the canonical model.

### `visit_group_links`

A visit is connected to groups through `visit_group_links`:

- exactly one `original` link identifies the group where the visit was
  registered;
- zero or more `shared` links expose the same canonical visit to other groups.

A unique database constraint/index must guarantee no more than one original
link per visit.

### `visit_participants`

Participants represent real authenticated users attached to the canonical
visit. Registration credit and gamification are based on participants, not the
user who created the row.

For a group's read-model:

- visible member participant IDs contain users who are or have been relevant
  members of that group;
- people outside the group are not exposed as identities;
- external people are represented only by `externalParticipantCount`.

### Sharing a visit

A user may share a visit to another active group only when the server-side rules
allow it, including that the user participated and is an active member of the
target group.

Sharing must:

- link the existing canonical visit, never create a duplicate visit;
- connect the canonical place to the target group if needed;
- preserve the original group's privacy;
- expose only target-relevant participant identities;
- represent everyone else anonymously as `+N`;
- initialise review visibility conservatively;
- never return `source_group_id` to the client.

### Removing a shared link

Removing a shared visit from a target group deletes only the target group's
shared relationship and target-specific visibility/activity rows.

It must not delete:

- the canonical visit;
- the canonical place;
- participants;
- reviews;
- the original group's link;
- another group's link.

Only authorised active target-group members may unlink, according to the
approved role/linking rules.

## 7. Reviews and visibility

### `reviews`

A review is canonical per visit and user. Ratings and comments belong to the
real visit, not to a duplicated group-specific copy.

### `review_group_visibility`

Visibility is controlled per review and group. A rating may be visible while a
comment remains hidden.

When sharing:

- relevant ratings can be visible in the target group;
- comments default to hidden unless the author explicitly allows their own
  comment to follow;
- a user can later change visibility only for their own review;
- aggregates must include only reviews whose rating is visible in the active
  group.

Private comments must never leak through averages, activity payloads, error
messages or source-group metadata.

## 8. Secure read model

`get_group_app_state(_group_id)` is the primary live read boundary.

It is a `SECURITY DEFINER` function with a locked `search_path` and must:

- require an authenticated user;
- require active membership in `_group_id`;
- return data for exactly one group;
- expose only fields needed by the application;
- preserve historical display names where allowed;
- anonymise external participants;
- omit source-group identity;
- calculate or provide only group-visible review data.

Sensitive canonical and relationship tables should not be directly readable by
the authenticated client. Read access should not be reopened as a shortcut for
new features.

## 9. Secure writes

Client writes use approved RPC functions or server functions.

A write function should normally:

1. derive the caller from `auth.uid()`;
2. validate active membership and required role;
3. validate all IDs belong to the intended group context;
4. validate enums, lengths, ranges and immutable identities;
5. perform the complete operation atomically;
6. use `SECURITY DEFINER` with a locked `search_path` when appropriate;
7. revoke execution from `PUBLIC` and `anon`;
8. grant only the intended role, normally `authenticated`.

Never accept client-supplied author, owner, member, source-group or group
identity without verifying it server-side.

Client-side read-only modes must also reject mutations centrally. Hiding a
button alone is not an adequate boundary for the public example.

## 10. Geoapify integration

Geoapify supports two live operations:

- location autocomplete;
- food-place search around a selected coordinate.

The API key is stored in Lovable Cloud Secrets as `GEOAPIFY_API_KEY` and read
only by server code. It must never appear in:

- client bundles;
- `VITE_` variables;
- GitHub;
- browser responses;
- application logs.

The browser receives a provider-neutral, normalised suggestion model. Search
uses bounded radii and requires an actual selected location when coordinates are
needed.

Current supported radii are 1, 3, 5, 10, 25 and 50 km, with 1 km as the default.
The UI must show Geoapify/OpenStreetMap attribution in live search results.

A selected provider place is inserted or linked atomically. Concurrent requests
for the same provider ID must not create duplicate canonical places.

Cuisine and speciality data from providers is mapped through the central
`food-tags.ts` taxonomy. Known aliases become stable Swedish labels. Bounded raw
provider metadata may be retained for diagnostics, but arbitrary provider
categories must not become uncontrolled user-facing tags. Unknown historical
labels may remain visible until an authorised user saves a corrected selection.

The fixed example dataset does not call Geoapify at runtime. Real place names,
addresses and coordinates are curated as stable demonstration data and should
avoid volatile details such as opening hours, prices, menus or availability.

## 11. Gamification

Gamification is a pure derived domain layer in
`src/lib/matrundan/gamification.ts`.

### Principles

- No mutable point balance is stored.
- Levels and badges are recalculated from the active group's read-model.
- Only actual participants receive credit.
- Repeat visits count.
- Registration, comments, ratings, clicks and administration do not earn
  progression.
- Shared visits count only when both group and visit settings allow it.
- Canonical visits are defensively deduplicated by `Visit.id` before every
  progression, leaderboard and milestone calculation.

### Levels

| Participated visits | Level |
| ---: | --- |
| 0 | Nyfiken |
| 1 | Provsmakaren |
| 4 | Krogspanaren |
| 10 | Matupptäckaren |
| 20 | Smakjägaren |
| 40 | Matkonnässören |
| 75 | Matrundemästaren |

Progress toward the next level is shown only on the user's own profile.

### Badges

- **Första rundan** — first progression-counted participated visit.
- **Världsvan** — five unique normalised cuisine types.
- **Brett register** — four unique place categories.
- **Stammis** — third progression-counted visit to the same canonical place.
- **Fullträff** — a non-shared place attributed to the member is later visited
  in an original group visit with at least one other group-relevant member.

External participant counts must never satisfy the "other group member" rule.

### Leaderboards

Leaderboards are private to the group and include active members only. Current
categories are participated visits, new places and cuisine breadth, for the
periods current year and all time.

Ties use competition ranking: `1, 1, 3`. Alphabetical order may stabilise visual
ordering but must not break a tie.

### Group milestones

Current milestones include counts of unique visited places, group anniversaries
and the first visit with the whole active group.

Known limitation: exact historical membership periods cannot currently be
reconstructed for the whole-group milestone. It uses the now-active member set
and can therefore change retroactively when membership changes.

## 12. Activity

Activity is a user-facing history of meaningful group events. Mutations that
already create activity should do so atomically on the server.

Gamification does not create stored activity kinds. Derived levels, badges and
leaderboards must not be written into activity merely to make them persistent.

When a shared visit is unlinked, target-specific share activity should be
removed without touching original-group history.

## 13. UI architecture and accessibility

The interface is Swedish, warm and restrained. Gamification is secondary to
planning and visit history.

General rules:

- reuse existing shadcn/Radix primitives;
- avoid duplicate displays of the same information;
- keep advanced and destructive actions secondary;
- use suitable confirmation for destructive actions;
- preserve keyboard and ARIA behaviour in dialogs, sheets, tabs and comboboxes;
- provide practical 44 px interactive targets;
- support long Swedish labels and names;
- prevent horizontal overflow at 360 px.

The public landing page must explain the product before presenting a group. Its
primary paths are create, join and the secondary example CTA. The example banner
must remain visible on every example route, not only on its home view.

The Gruppen page places the member list before the compact group-highlights
section. Member cards show a restrained `{level} · {visits} besök` line.

Long searchable multi-selects use a compact popover on desktop and a bottom
drawer below 768 px. The mobile drawer must react to `visualViewport`/dynamic
viewport changes so an opened software keyboard does not hide the search field
or trap the option list behind the keyboard.

## 14. Versioning and documentation

The release version and changelog exist in several places:

- `src/lib/matrundan/version.ts` for the application and in-app history;
- `README.md` for current capability and limitations;
- `CHANGELOG.md` for external release history;
- this document for durable architectural changes.

A release is incomplete when these disagree.

## 15. Verification expectations

A normal release candidate should run:

```bash
bun run typecheck
bunx eslint <all changed source files>
bun run build
```

Focused tests should be run for changed domain modules. Gamification currently
uses:

```bash
bun test src/lib/matrundan/gamification.test.ts
```

Changed mobile flows require a real browser check at 360 px. Verify both the
page and opened dialogs/sheets, including:

```js
document.documentElement.scrollWidth <=
  document.documentElement.clientWidth
```

For software-keyboard-sensitive UI, also verify the component after the visual
viewport height shrinks and confirm that its bottom edge remains within the
visible viewport.

Runtime-mode changes must verify at minimum:

- anonymous `/` loads no group store and shows the landing actions;
- `/exempel` ignores writable demo state and remains read-only across routes;
- `?demo=1` remains a writable internal sandbox;
- direct invitation routes work before and after authentication;
- live users with and without groups retain their existing routing behaviour.

Database changes require explicit inspection of function definitions, grants,
membership checks and preservation of production rows.

Never describe a test as completed when it was not actually run. If an
authenticated live browser session is unavailable, state that limitation
explicitly.

## 16. Change checklist

Before merging an architecture-affecting change, confirm:

- Does it preserve canonical place and visit identity?
- Is every read and write scoped to the correct group?
- Could it reveal another group's name, member, comment or source identity?
- Are former members denied current access?
- Are external participants still anonymous?
- Are secrets server-only?
- Are RPC grants and `search_path` correct?
- Does the public landing avoid loading or implying group membership?
- Is the example clearly labelled, isolated and centrally read-only?
- Does the internal demo sandbox still work?
- Does the changed flow work at 360 px?
- Are tests and documentation updated?
- Is deployment withheld until verification is green?
