import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const AUTH_STORAGE_KEY = "sb-127-auth-token";
const ACTIVE_GROUP_KEY = "matrundan.activeGroup.v1";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "22222222-2222-4222-8222-222222222222";
const PLACE_ID = "33333333-3333-4333-8333-333333333333";

async function stabilize(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
      }
    `,
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const outputDirectory = path.join("visual-review", testInfo.project.name);
  await mkdir(outputDirectory, { recursive: true });
  await page.screenshot({ path: path.join(outputDirectory, `${name}.png`), fullPage: true });
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
}

async function seedSession(page: Page) {
  const now = new Date().toISOString();
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  await page.addInitScript(
    ({ authKey, groupKey, session }) => {
      window.localStorage.setItem(authKey, JSON.stringify(session));
      window.localStorage.setItem(groupKey, GROUP_ID);
    },
    {
      authKey: AUTH_STORAGE_KEY,
      groupKey: ACTIVE_GROUP_KEY,
      session: {
        access_token: `test.${btoa(
          JSON.stringify({
            sub: USER_ID,
            aud: "authenticated",
            role: "authenticated",
            email: "emil@example.com",
            exp: expiresAt,
          }),
        )}.signature`,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: expiresAt,
        refresh_token: "test-refresh-token",
        user: {
          id: USER_ID,
          aud: "authenticated",
          role: "authenticated",
          email: "emil@example.com",
          email_confirmed_at: now,
          confirmed_at: now,
          last_sign_in_at: now,
          app_metadata: { provider: "google", providers: ["google"] },
          user_metadata: { full_name: "Emil" },
          identities: [],
          created_at: now,
          updated_at: now,
          is_anonymous: false,
        },
      },
    },
  );
}

function groupState() {
  return {
    currentUserId: USER_ID,
    group: {
      id: GROUP_ID,
      name: "Kompisgänget",
      emoji: "🍜",
      city: "Stockholm",
      createdAt: "2026-01-01T12:00:00Z",
      ownerId: USER_ID,
      lifecycleStatus: "active",
      archivedAt: null,
      archivedBy: null,
      sharedVisitsCountForProgression: true,
      defaultSearchRadiusKm: 1,
      searchAreas: [],
      homeLocation: null,
    },
    members: [{ id: USER_ID, name: "Emil", avatar: "🙂", avatarImage: null, role: "ägare" }],
    places: [
      {
        id: PLACE_ID,
        name: "Bistro Test",
        category: "restaurang",
        canonicalCategory: "restaurang",
        categoryOverride: null,
        cuisines: ["Svenskt"],
        canonicalCuisines: ["Svenskt"],
        cuisinesOverride: null,
        occasions: ["avslappnat"],
        address: "Testgatan 1",
        area: "Södermalm",
        city: "Stockholm",
        lat: 59.31,
        lng: 18.07,
        website: null,
        canonicalWebsite: null,
        websiteOverride: null,
        sources: [],
        photo: null,
        notes: null,
        addedBy: USER_ID,
        addedAt: "2026-09-01T12:00:00Z",
        origin: "manual",
        collectionStatus: "active",
        archivedAt: null,
        archivedBy: null,
      },
    ],
    visits: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        placeId: PLACE_ID,
        date: "2026-09-10",
        meal: "middag",
        isTakeaway: true,
        createdBy: USER_ID,
        linkType: "original",
        linkedBy: USER_ID,
        linkedAt: "2026-09-10T18:00:00Z",
        externalParticipantCount: 0,
        countsForProgression: true,
        participantIds: [USER_ID],
        currentUserParticipationStatus: "participant",
        participants: [{ id: USER_ID, name: "Emil", avatar: "🙂", avatarImage: null, status: "active" }],
        reviews: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            userId: USER_ID,
            overall: 4,
            taste: 4,
            value: 4,
            service: 4,
            comment: "Tog med middagen hem.",
            ratingVisible: true,
            commentVisible: true,
          },
        ],
        photo: null,
      },
      {
        id: "66666666-6666-4666-8666-666666666666",
        placeId: PLACE_ID,
        date: "2026-09-08",
        meal: "dryck",
        isTakeaway: false,
        createdBy: USER_ID,
        linkType: "original",
        linkedBy: USER_ID,
        linkedAt: "2026-09-08T18:00:00Z",
        externalParticipantCount: 0,
        countsForProgression: true,
        participantIds: [USER_ID],
        currentUserParticipationStatus: "participant",
        participants: [{ id: USER_ID, name: "Emil", avatar: "🙂", avatarImage: null, status: "active" }],
        reviews: [],
        photo: null,
      },
      {
        id: "77777777-7777-4777-8777-777777777777",
        placeId: PLACE_ID,
        date: "2026-08-20",
        meal: "kväll",
        createdBy: USER_ID,
        linkType: "original",
        linkedBy: USER_ID,
        linkedAt: "2026-08-20T18:00:00Z",
        externalParticipantCount: 0,
        countsForProgression: true,
        participantIds: [USER_ID],
        currentUserParticipationStatus: "participant",
        participants: [{ id: USER_ID, name: "Emil", avatar: "🙂", avatarImage: null, status: "active" }],
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

async function mockBackend(page: Page) {
  await page.route("**/rest/v1/rpc/**", async (route) => {
    const rpc = new URL(route.request().url()).pathname.split("/").pop() ?? "";
    if (rpc === "list_user_groups_v4b") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: GROUP_ID,
            name: "Kompisgänget",
            emoji: "🍜",
            role: "owner",
            lifecycleStatus: "active",
          },
        ]),
      });
      return;
    }
    if (rpc.startsWith("get_group_app_state_v5")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(groupState()) });
      return;
    }
    if (rpc === "list_place_share_targets_v4b") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

test("#197 registrering visar Något att dricka och lågfriktions-Hämtmat", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await seedSession(page);
  await mockBackend(page);
  await page.goto(`/matstallen/${PLACE_ID}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Registrera besök igen" }).click();

  const dialog = page.getByRole("dialog", { name: "Registrera besök" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("combobox").click();
  await expect(page.getByRole("option", { name: "Något att dricka" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Kväll" })).toHaveCount(0);
  await page.getByRole("option", { name: "Något att dricka" }).click();
  await dialog.getByRole("switch", { name: "Markera besöket som Hämtmat" }).click();
  await expect(dialog.getByRole("switch", { name: "Markera besöket som Hämtmat" })).toBeChecked();

  await stabilize(page);
  await expectNoHorizontalOverflow(page);
  await capture(page, testInfo, "issue-197-registrera-dryck-hamtmat");
});

test("#197 historik skiljer Hämtmat, dryck och legacy Kväll utan På plats-brus", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await seedSession(page);
  await mockBackend(page);
  await page.goto("/besok", { waitUntil: "domcontentloaded" });

  await expect(page.getByText(/Middag · Hämtmat/)).toBeVisible();
  await expect(page.getByText(/Något att dricka/)).toBeVisible();
  await expect(page.getByText(/Kväll/)).toBeVisible();
  await expect(page.getByText(/På plats/)).toHaveCount(0);

  await stabilize(page);
  await expectNoHorizontalOverflow(page);
  await capture(page, testInfo, "issue-197-besokshistorik");
});
