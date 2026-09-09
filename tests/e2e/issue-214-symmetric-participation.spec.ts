import { expect, test, type Page } from "@playwright/test";

const SUPABASE_AUTH_STORAGE_KEY = "sb-127-auth-token";
const ACTIVE_GROUP_KEY = "matrundan.activeGroup.v1";
const SOURCE_USER_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_ACTOR_ID = "22222222-2222-4222-8222-222222222222";
const TARGET_USER_ID = "99999999-9999-4999-8999-999999999999";
const SECOND_TARGET_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SOURCE_GROUP_ID = "33333333-3333-4333-8333-333333333333";
const TARGET_GROUP_ID = "44444444-4444-4444-8444-444444444444";
const PLACE_ID = "55555555-5555-4555-8555-555555555555";
const VISIT_ID = "66666666-6666-4666-8666-666666666666";
const GUEST_ID = "77777777-7777-4777-8777-777777777777";
const SECOND_GUEST_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPOSAL_ID = "88888888-8888-4888-8888-888888888888";
const SECOND_PROPOSAL_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const VIEWPORTS = [
  { name: "360 px", width: 360, height: 800 },
  { name: "desktop", width: 1280, height: 900 },
] as const;

function place() {
  return {
    id: PLACE_ID,
    name: "Bistro Test",
    category: "restaurang",
    canonicalCategory: "restaurang",
    categoryOverride: null,
    cuisines: ["Svenskt"],
    canonicalCuisines: ["Svenskt"],
    cuisinesOverride: null,
    occasions: [],
    address: "Testgatan 1",
    area: "Södermalm",
    city: "Stockholm",
    lat: 59.31,
    lng: 18.07,
    website: null,
    canonicalWebsite: null,
    websiteOverride: null,
    openingHoursOverride: null,
    practicalInfoSourceUrl: null,
    practicalInfoSourceNote: null,
    practicalInfoUpdatedBy: null,
    practicalInfoUpdatedByName: null,
    practicalInfoUpdatedAt: null,
    sources: [],
    photo: null,
    notes: null,
    addedBy: SOURCE_USER_ID,
    addedAt: "2026-09-01T12:00:00Z",
    origin: "manual",
    collectionStatus: "active",
    archivedAt: null,
    archivedBy: null,
  };
}

function group(id: string, name: string, ownerId: string) {
  return {
    id,
    name,
    emoji: id === SOURCE_GROUP_ID ? "🍜" : "🥘",
    city: "Stockholm",
    createdAt: "2026-01-01T12:00:00Z",
    ownerId,
    lifecycleStatus: "active",
    archivedAt: null,
    archivedBy: null,
    sharedVisitsCountForProgression: true,
    defaultSearchRadiusKm: 1,
    searchAreas: [],
    homeLocation: null,
  };
}

function baseState(currentUserId: string, groupId: string) {
  const source = groupId === SOURCE_GROUP_ID;
  return {
    currentUserId,
    group: group(groupId, source ? "Kompisgänget" : "Jobbgänget", currentUserId),
    members: source
      ? [
          {
            id: SOURCE_USER_ID,
            name: "Emil",
            avatar: "🙂",
            avatarImage: null,
            role: "ägare",
          },
        ]
      : [
          {
            id: TARGET_ACTOR_ID,
            name: "Anna",
            avatar: "🐻",
            avatarImage: null,
            role: "ägare",
          },
          {
            id: TARGET_USER_ID,
            name: "Johan Andersson",
            avatar: "🦊",
            avatarImage: null,
            role: "medlem",
          },
        ],
    places: [place()],
    visits: source
      ? []
      : [
          {
            id: VISIT_ID,
            placeId: PLACE_ID,
            date: "2026-09-01",
            meal: "middag",
            createdBy: SOURCE_USER_ID,
            linkType: "shared",
            linkedBy: TARGET_ACTOR_ID,
            linkedAt: "2026-09-02T09:00:00Z",
            externalParticipantCount: 1,
            countsForProgression: true,
            participantIds: [TARGET_ACTOR_ID],
            currentUserParticipationStatus: "participant",
            participants: [
              {
                id: TARGET_ACTOR_ID,
                name: "Anna",
                avatar: "🐻",
                avatarImage: null,
                status: "active",
              },
            ],
            visibleReviews: [],
            overall: 0,
            photo: null,
          },
        ],
    favorites: [],
    activity: [],
    nextPlaceId: null,
    nextStopDateProposal: null,
  };
}

async function seedSession(page: Page, userId: string, groupId: string) {
  const now = new Date().toISOString();
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  await page.addInitScript(
    ({ storageKey, activeGroupKey, activeGroupId, session }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
      window.localStorage.setItem(activeGroupKey, activeGroupId);
    },
    {
      storageKey: SUPABASE_AUTH_STORAGE_KEY,
      activeGroupKey: ACTIVE_GROUP_KEY,
      activeGroupId: groupId,
      session: {
        access_token: `test.${btoa(
          JSON.stringify({
            sub: userId,
            aud: "authenticated",
            role: "authenticated",
            email: "test@example.com",
            exp: expiresAt,
          }),
        )}.signature`,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: expiresAt,
        refresh_token: "test-refresh-token",
        user: {
          id: userId,
          aud: "authenticated",
          role: "authenticated",
          email: "test@example.com",
          email_confirmed_at: now,
          phone: "",
          confirmed_at: now,
          last_sign_in_at: now,
          app_metadata: { provider: "google", providers: ["google"] },
          user_metadata: { full_name: "Testanvändare" },
          identities: [],
          created_at: now,
          updated_at: now,
          is_anonymous: false,
        },
      },
    },
  );
}

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const widths = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(widths.scrollWidth, `${context} ska sakna horisontell overflow`).toBeLessThanOrEqual(
    widths.clientWidth + 1,
  );
}

async function mockRegistration(page: Page) {
  let createdPayload: Record<string, unknown> | null = null;
  let sharedPayload: Record<string, unknown> | null = null;
  const proposedPayloads: Record<string, unknown>[] = [];

  await page.route("**/rest/v1/rpc/**", async (route) => {
    const rpc = new URL(route.request().url()).pathname.split("/").pop() ?? "";

    if (rpc === "list_user_groups_v4b") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: SOURCE_GROUP_ID,
            name: "Kompisgänget",
            emoji: "🍜",
            role: "owner",
            lifecycleStatus: "active",
          },
          {
            id: TARGET_GROUP_ID,
            name: "Jobbgänget",
            emoji: "🥘",
            role: "member",
            lifecycleStatus: "active",
          },
        ]),
      });
      return;
    }

    if (rpc.startsWith("get_group_app_state_v5")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(baseState(SOURCE_USER_ID, SOURCE_GROUP_ID)),
      });
      return;
    }

    if (rpc === "list_place_share_targets_v4b") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            groupId: TARGET_GROUP_ID,
            name: "Jobbgänget",
            emoji: "🥘",
            placeExistsInGroup: false,
            sharedVisitsCountForProgression: true,
          },
        ]),
      });
      return;
    }

    if (rpc === "find_registration_visit_duplicate_v1") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
      return;
    }

    if (rpc === "create_visit_with_review_v3") {
      createdPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(VISIT_ID),
      });
      return;
    }

    if (rpc === "share_visit_to_group_v2") {
      sharedPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(VISIT_ID),
      });
      return;
    }

    if (rpc === "list_visit_guest_member_targets_v1") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            guestId: GUEST_ID,
            guestName: "Joppe",
            groupId: TARGET_GROUP_ID,
            groupName: "Jobbgänget",
            groupEmoji: "🥘",
            memberId: TARGET_USER_ID,
            memberName: "Johan Andersson",
            memberAvatar: "🦊",
            memberAvatarImage: null,
            proposalStatus: null,
          },
          {
            guestId: SECOND_GUEST_ID,
            guestName: "Sara",
            groupId: TARGET_GROUP_ID,
            groupName: "Jobbgänget",
            groupEmoji: "🥘",
            memberId: SECOND_TARGET_USER_ID,
            memberName: "Maja Lind",
            memberAvatar: "🐰",
            memberAvatarImage: null,
            proposalStatus: null,
          },
        ]),
      });
      return;
    }

    if (rpc === "propose_visit_guest_member_v1") {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      proposedPayloads.push(payload);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          payload._target_user_id === SECOND_TARGET_USER_ID ? SECOND_PROPOSAL_ID : PROPOSAL_ID,
        ),
      });
      return;
    }

    if (rpc === "get_own_visit_guest_proposal_v1") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  return {
    createdPayload: () => createdPayload,
    sharedPayload: () => sharedPayload,
    proposedPayloads: () => proposedPayloads,
  };
}

async function mockRecipient(page: Page) {
  let proposedPayload: Record<string, unknown> | null = null;

  await page.route("**/rest/v1/rpc/**", async (route) => {
    const rpc = new URL(route.request().url()).pathname.split("/").pop() ?? "";

    if (rpc === "list_user_groups_v4b") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: TARGET_GROUP_ID,
            name: "Jobbgänget",
            emoji: "🥘",
            role: "owner",
            lifecycleStatus: "active",
          },
        ]),
      });
      return;
    }

    if (rpc.startsWith("get_group_app_state_v5")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(baseState(TARGET_ACTOR_ID, TARGET_GROUP_ID)),
      });
      return;
    }

    if (rpc === "get_own_visit_guest_proposal_v1") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
      return;
    }

    if (rpc === "list_visit_shared_member_candidates_v1") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            memberId: TARGET_USER_ID,
            memberName: "Johan Andersson",
            memberAvatar: "🦊",
            memberAvatarImage: null,
            proposalStatus: null,
          },
        ]),
      });
      return;
    }

    if (rpc === "propose_shared_visit_member_v1") {
      proposedPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PROPOSAL_ID),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  return { proposedPayload: () => proposedPayload };
}

for (const viewport of VIEWPORTS) {
  test(`registrering + delning kan koppla flera gäster i följd — ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await seedSession(page, SOURCE_USER_ID, SOURCE_GROUP_ID);
    const mock = await mockRegistration(page);

    await page.goto(`/matstallen/${PLACE_ID}`);
    await page.getByRole("button", { name: "Registrera besök", exact: true }).click();
    const registerDialog = page.getByRole("dialog", { name: "Registrera besök" });

    await registerDialog.getByRole("button", { name: "Lägg till gäst" }).click();
    await registerDialog.getByPlaceholder("Gästens namn").fill("Joppe");
    await registerDialog.getByRole("button", { name: "Lägg till", exact: true }).click();
    await registerDialog.getByPlaceholder("Gästens namn").fill("Sara");
    await registerDialog.getByRole("button", { name: "Lägg till", exact: true }).click();
    await expect(registerDialog.getByText("Joppe", { exact: true })).toBeVisible();
    await expect(registerDialog.getByText("Sara", { exact: true })).toBeVisible();
    await expect(registerDialog.getByText("Jobbgänget", { exact: true })).toBeVisible();
    await expect(
      registerDialog.getByText(
        "Efter att besöket sparats kan du direkt koppla en gäst till en medlem i en vald grupp.",
        { exact: false },
      ),
    ).toBeVisible();

    await registerDialog.getByRole("button", { name: "Helhetsbetyg: 4 av 5" }).click();
    await registerDialog.getByRole("button", { name: "Spara besök" }).click();

    await expect.poll(mock.createdPayload).not.toBeNull();
    await expect.poll(mock.sharedPayload).toMatchObject({
      _visit_id: VISIT_ID,
      _target_group_id: TARGET_GROUP_ID,
    });

    const linkDialog = page.getByRole("dialog", { name: "Koppla gäst till medlem" });
    await expect(registerDialog).toBeHidden();
    await expect(linkDialog).toBeVisible();
    await linkDialog.getByRole("button", { name: "Joppe" }).click();
    await expect(linkDialog.getByText("Jobbgänget", { exact: true })).toBeVisible();
    await linkDialog.getByRole("button", { name: "Johan Andersson" }).click();
    await linkDialog.getByRole("button", { name: "Skicka fråga" }).click();

    await expect.poll(() => mock.proposedPayloads().length).toBe(1);
    expect(mock.proposedPayloads()[0]).toMatchObject({
      _source_group_id: SOURCE_GROUP_ID,
      _visit_id: VISIT_ID,
      _guest_id: GUEST_ID,
      _target_group_id: TARGET_GROUP_ID,
      _target_user_id: TARGET_USER_ID,
    });
    await expect(
      linkDialog.getByText("Frågan är skickad till Johan Andersson.", { exact: true }),
    ).toBeVisible();
    await expect(linkDialog.getByRole("button", { name: "Koppla en till" })).toBeVisible();
    await expect(linkDialog.getByRole("button", { name: "Klar" })).toBeVisible();
    await expectNoHorizontalOverflow(page, `första gästkopplingen ${viewport.name}`);

    await linkDialog.getByRole("button", { name: "Koppla en till" }).click();
    await expect(linkDialog.getByText("Sara", { exact: true })).toBeVisible();
    await expect(linkDialog.getByRole("button", { name: "Maja Lind" })).toBeVisible();
    await linkDialog.getByRole("button", { name: "Maja Lind" }).click();
    await linkDialog.getByRole("button", { name: "Skicka fråga" }).click();

    await expect.poll(() => mock.proposedPayloads().length).toBe(2);
    expect(mock.proposedPayloads()[1]).toMatchObject({
      _source_group_id: SOURCE_GROUP_ID,
      _visit_id: VISIT_ID,
      _guest_id: SECOND_GUEST_ID,
      _target_group_id: TARGET_GROUP_ID,
      _target_user_id: SECOND_TARGET_USER_ID,
    });
    await expect(linkDialog).toBeHidden();
    await expect(
      page.getByText("Frågan är skickad till Maja Lind.", { exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, `registrering och gästkoppling ${viewport.name}`);
  });

  test(`mottagargruppen kan föreslå egen medlem utan privat gästdata — ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await seedSession(page, TARGET_ACTOR_ID, TARGET_GROUP_ID);
    const mock = await mockRecipient(page);

    await page.goto(`/besok?visit=${VISIT_ID}`);
    const visitDialog = page.getByRole("dialog").first();
    await expect(visitDialog.getByText("+1 utanför gruppen", { exact: false })).toBeVisible();
    await expect(visitDialog.getByText("Joppe", { exact: true })).toHaveCount(0);
    await expect(visitDialog.getByText("Kompisgänget", { exact: true })).toHaveCount(0);

    await visitDialog.getByRole("button", { name: "Föreslå deltagare från gruppen" }).click();
    const proposalDialog = page.getByRole("dialog", { name: "Föreslå deltagare" });
    await expect(proposalDialog.getByText("Johan Andersson", { exact: true })).toBeVisible();
    await expect(proposalDialog.getByText("Joppe", { exact: true })).toHaveCount(0);
    await expect(proposalDialog.getByText("Kompisgänget", { exact: true })).toHaveCount(0);

    await proposalDialog.getByRole("button", { name: "Johan Andersson" }).click();
    await proposalDialog.getByRole("button", { name: "Skicka fråga" }).click();

    await expect.poll(mock.proposedPayload).toEqual({
      _group_id: TARGET_GROUP_ID,
      _visit_id: VISIT_ID,
      _target_user_id: TARGET_USER_ID,
    });
    await expect(
      page.getByText("Frågan är skickad till Johan Andersson.", { exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, `mottagargruppens deltagarförslag ${viewport.name}`);
  });
}
