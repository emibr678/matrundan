import { expect, test, type Page } from "@playwright/test";

const SUPABASE_AUTH_STORAGE_KEY = "sb-127-auth-token";
const ACTIVE_GROUP_KEY = "matrundan.activeGroup.v1";
const SOURCE_USER_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_USER_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_GROUP_ID = "33333333-3333-4333-8333-333333333333";
const TARGET_GROUP_ID = "44444444-4444-4444-8444-444444444444";
const PLACE_ID = "55555555-5555-4555-8555-555555555555";
const VISIT_ID = "66666666-6666-4666-8666-666666666666";
const GUEST_ID = "77777777-7777-4777-8777-777777777777";
const PROPOSAL_ID = "88888888-8888-4888-8888-888888888888";

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

function sourceState() {
  return {
    currentUserId: SOURCE_USER_ID,
    group: {
      id: SOURCE_GROUP_ID,
      name: "Kompisgänget",
      emoji: "🍜",
      city: "Stockholm",
      createdAt: "2026-01-01T12:00:00Z",
      ownerId: SOURCE_USER_ID,
      lifecycleStatus: "active",
      archivedAt: null,
      archivedBy: null,
      sharedVisitsCountForProgression: true,
      defaultSearchRadiusKm: 1,
      searchAreas: [],
      homeLocation: null,
    },
    members: [
      {
        id: SOURCE_USER_ID,
        name: "Emil",
        avatar: "🙂",
        avatarImage: null,
        role: "ägare",
      },
    ],
    places: [place()],
    visits: [
      {
        id: VISIT_ID,
        placeId: PLACE_ID,
        date: "2026-09-01",
        meal: "middag",
        createdBy: SOURCE_USER_ID,
        linkType: "original",
        linkedBy: SOURCE_USER_ID,
        linkedAt: "2026-09-01T20:00:00Z",
        externalParticipantCount: 0,
        countsForProgression: true,
        participantIds: [SOURCE_USER_ID],
        currentUserParticipationStatus: "participant",
        participants: [
          {
            id: SOURCE_USER_ID,
            name: "Emil",
            avatar: "🙂",
            avatarImage: null,
            status: "active",
          },
          {
            id: `guest:${GUEST_ID}`,
            name: "Joppe",
            avatar: "👤",
            avatarImage: null,
            status: "guest",
          },
        ],
        reviews: [],
        photo: null,
      },
    ],
    favorites: [],
    activity: [],
    nextPlaceId: null,
    nextStopDateProposal: null,
  };
}

function targetState(accepted: boolean) {
  return {
    currentUserId: TARGET_USER_ID,
    group: {
      id: TARGET_GROUP_ID,
      name: "Jobbgänget",
      emoji: "🥘",
      city: "Stockholm",
      createdAt: "2026-01-01T12:00:00Z",
      ownerId: TARGET_USER_ID,
      lifecycleStatus: "active",
      archivedAt: null,
      archivedBy: null,
      sharedVisitsCountForProgression: true,
      defaultSearchRadiusKm: 1,
      searchAreas: [],
      homeLocation: null,
    },
    members: [
      {
        id: TARGET_USER_ID,
        name: "Johan Andersson",
        avatar: "🦊",
        avatarImage: null,
        role: "ägare",
      },
    ],
    places: [place()],
    visits: [
      {
        id: VISIT_ID,
        placeId: PLACE_ID,
        date: "2026-09-01",
        meal: "middag",
        createdBy: SOURCE_USER_ID,
        linkType: "shared",
        linkedBy: SOURCE_USER_ID,
        linkedAt: "2026-09-02T09:00:00Z",
        externalParticipantCount: 1,
        countsForProgression: true,
        participantIds: accepted ? [SOURCE_USER_ID, TARGET_USER_ID] : [SOURCE_USER_ID],
        currentUserParticipationStatus: accepted ? "participant" : "none",
        participants: accepted
          ? [
              {
                id: TARGET_USER_ID,
                name: "Johan Andersson",
                avatar: "🦊",
                avatarImage: null,
                status: "active",
              },
            ]
          : [],
        reviews: [],
        photo: null,
      },
    ],
    favorites: [],
    activity: [],
    nextPlaceId: null,
    nextStopDateProposal: null,
  };
}

async function mockSource(page: Page) {
  let proposedPayload: Record<string, unknown> | null = null;
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
        body: JSON.stringify(sourceState()),
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
        ]),
      });
      return;
    }

    if (rpc === "propose_visit_guest_member_v1") {
      proposedPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PROPOSAL_ID),
      });
      return;
    }

    if (rpc === "get_own_visit_guest_proposal_v1") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  return { proposedPayload: () => proposedPayload };
}

async function mockTarget(page: Page) {
  let accepted = false;
  let responsePayload: Record<string, unknown> | null = null;

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
        body: JSON.stringify(targetState(accepted)),
      });
      return;
    }

    if (rpc === "get_own_visit_guest_proposal_v1") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: accepted ? "null" : JSON.stringify({ proposalId: PROPOSAL_ID, status: "pending" }),
      });
      return;
    }

    if (rpc === "respond_visit_guest_proposal_v1") {
      responsePayload = route.request().postDataJSON() as Record<string, unknown>;
      accepted = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  return { responsePayload: () => responsePayload };
}

for (const viewport of VIEWPORTS) {
  test(`originalgruppen kan föreslå en målmedlem utan global personlista — ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await seedSession(page, SOURCE_USER_ID, SOURCE_GROUP_ID);
    const mock = await mockSource(page);

    await page.goto(`/besok?visit=${VISIT_ID}`);
    const visitDialog = page.getByRole("dialog").first();
    await expect(visitDialog.getByRole("heading", { name: "Bistro Test" })).toBeVisible();
    await expect(visitDialog.getByText("Joppe", { exact: true })).toBeVisible();

    await visitDialog.getByRole("button", { name: "Koppla gäst till medlem" }).click();
    const linkDialog = page.getByRole("dialog", { name: "Koppla gäst till medlem" });
    await expect(linkDialog.getByText("Joppe", { exact: true })).toBeVisible();
    await expect(linkDialog.getByText("Jobbgänget", { exact: true })).toBeVisible();
    await expect(linkDialog.getByRole("button", { name: "Johan Andersson" })).toBeVisible();
    await linkDialog.getByRole("button", { name: "Johan Andersson" }).click();
    await linkDialog.getByRole("button", { name: "Skicka fråga" }).click();

    await expect.poll(mock.proposedPayload).toEqual({
      _source_group_id: SOURCE_GROUP_ID,
      _visit_id: VISIT_ID,
      _guest_id: GUEST_ID,
      _target_group_id: TARGET_GROUP_ID,
      _target_user_id: TARGET_USER_ID,
    });
    await expect(linkDialog).toBeHidden();
    await expect(
      page.getByText("Frågan är skickad till Johan Andersson.", { exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, `gästkoppling ${viewport.name}`);
  });

  test(`målmedlemmen bekräftar neutralt och blir faktisk deltagare — ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await seedSession(page, TARGET_USER_ID, TARGET_GROUP_ID);
    const mock = await mockTarget(page);

    await page.goto(`/besok?visit=${VISIT_ID}`);
    const visitDialog = page.getByRole("dialog").first();
    const prompt = visitDialog.getByLabel("Bekräfta deltagande");
    await expect(prompt).toBeVisible();
    await expect(prompt.getByText("Var du med på det här besöket?", { exact: true })).toBeVisible();
    await expect(
      prompt.getByText("Då registreras du som deltagare på besöket.", { exact: false }),
    ).toBeVisible();
    await expect(prompt.getByRole("button", { name: "Ja, jag var med" })).toBeVisible();
    await expect(prompt.getByRole("button", { name: "Jag var inte med" })).toBeVisible();
    await expect(prompt.getByRole("button", { name: "Inte nu" })).toBeVisible();
    await expect(
      visitDialog.getByRole("button", { name: "Föreslå deltagare från gruppen" }),
    ).toHaveCount(0);

    await expect(visitDialog.getByText("Joppe", { exact: true })).toHaveCount(0);
    await expect(visitDialog.getByText("Kompisgänget", { exact: true })).toHaveCount(0);

    await prompt.getByRole("button", { name: "Ja, jag var med" }).click();
    await expect.poll(mock.responsePayload).toEqual({
      _group_id: TARGET_GROUP_ID,
      _proposal_id: PROPOSAL_ID,
      _response: "accept",
    });
    await expect(page.getByText("Ditt deltagande är bekräftat.", { exact: true })).toBeVisible();
    await expect(visitDialog.getByRole("button", { name: "Lägg till ditt omdöme" })).toBeVisible();
    await expectNoHorizontalOverflow(page, `deltagandebekräftelse ${viewport.name}`);
  });
}
