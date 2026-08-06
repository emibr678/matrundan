import { expect, test, type Page } from "@playwright/test";

const SUPABASE_AUTH_STORAGE_KEY = "sb-bkyzxkfrenbbkgiymofk-auth-token";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "22222222-2222-4222-8222-222222222222";
const PLACE_ID = "33333333-3333-4333-8333-333333333333";

async function seedAuthenticatedSession(page: Page) {
  const now = new Date().toISOString();
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;

  await page.addInitScript(
    ({ storageKey, session }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
    },
    {
      storageKey: SUPABASE_AUTH_STORAGE_KEY,
      session: {
        access_token: `test.${btoa(
          JSON.stringify({
            sub: USER_ID,
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
          id: USER_ID,
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

test("matställets webbplats visas under adressen i en fullbred mobilsektion", async ({ page }) => {
  const now = new Date().toISOString();
  await page.setViewportSize({ width: 360, height: 800 });
  await seedAuthenticatedSession(page);

  await page.route("**/rest/v1/rpc/list_user_groups_v4b", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: GROUP_ID,
          name: "Testgruppen",
          emoji: "🍽️",
          role: "owner",
          lifecycleStatus: "active",
        },
      ]),
    });
  });

  const appState = {
    currentUserId: USER_ID,
    group: {
      id: GROUP_ID,
      name: "Testgruppen",
      emoji: "🍽️",
      city: "Stockholm",
      createdAt: now,
      ownerId: USER_ID,
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
        id: USER_ID,
        name: "Testanvändare",
        avatar: "🙂",
        avatarImage: null,
        role: "owner",
      },
    ],
    places: [
      {
        id: PLACE_ID,
        name: "Testköket",
        category: "restaurang",
        canonicalCategory: "restaurang",
        categoryOverride: null,
        cuisines: ["Svenskt"],
        canonicalCuisines: ["Svenskt"],
        cuisinesOverride: null,
        occasions: [],
        address: "Testgatan 1",
        area: "Enskede",
        city: "Stockholm",
        lat: 59.283,
        lng: 18.07,
        website: "https://www.testkoket.se/meny",
        canonicalWebsite: "https://www.testkoket.se/meny",
        websiteOverride: null,
        openingHoursOverride: null,
        practicalInfoSourceUrl: null,
        practicalInfoSourceNote: null,
        practicalInfoUpdatedBy: null,
        practicalInfoUpdatedByName: null,
        practicalInfoUpdatedAt: null,
        sources: [
          {
            provider: "geoapify",
            providerPlaceId: "geo-testkoket",
            status: "active",
          },
          {
            provider: "openstreetmap",
            providerPlaceId: "node:123456",
            status: "active",
          },
        ],
        photo: null,
        notes: null,
        addedBy: USER_ID,
        addedAt: now,
        origin: "provider",
        collectionStatus: "active",
        archivedAt: null,
        archivedBy: null,
      },
    ],
    visits: [],
    favorites: [],
    activity: [],
    nextPlaceId: null,
    nextStopDateProposal: null,
  };

  for (const rpc of [
    "get_group_app_state_v5h",
    "get_group_app_state_v5g",
    "get_group_app_state_v5f",
  ]) {
    await page.route(`**/rest/v1/rpc/${rpc}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(appState),
      });
    });
  }

  await page.route("**/rest/v1/rpc/get_group_place_practical_info_v1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        websiteOverride: null,
        openingHoursOverride: null,
        sourceUrl: null,
        sourceNote: null,
        updatedBy: null,
        updatedByName: null,
        updatedAt: null,
      }),
    });
  });

  await page.route(
    "**/rest/v1/rpc/get_cross_group_practical_info_suggestions_v1",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          website: { status: "none" },
          openingHours: { status: "none" },
        }),
      });
    },
  );

  await page.goto(`/matstallen/${PLACE_ID}`);

  await expect(page.getByRole("heading", { name: "Testköket" })).toBeVisible();
  const practicalInfo = page.getByTestId("place-practical-info");
  const maps = page.getByRole("link", { name: "Öppna Testköket i Google Maps" });
  const website = page.getByRole("link", { name: "Öppna webbplatsen för Testköket" });
  const openingHours = page.getByLabel(/^Öppettider:/);
  await expect(practicalInfo).toBeVisible();
  await expect(maps).toBeVisible();
  await expect(website).toBeVisible();
  await expect(website).toHaveAttribute("href", "https://www.testkoket.se/meny");
  await expect(openingHours).toBeVisible();

  const [practicalInfoBox, mapsBox, websiteBox, openingHoursBox] = await Promise.all([
    practicalInfo.boundingBox(),
    maps.boundingBox(),
    website.boundingBox(),
    openingHours.boundingBox(),
  ]);
  expect(practicalInfoBox).not.toBeNull();
  expect(mapsBox).not.toBeNull();
  expect(websiteBox).not.toBeNull();
  expect(openingHoursBox).not.toBeNull();
  expect(mapsBox!.height).toBeGreaterThanOrEqual(44);
  expect(websiteBox!.height).toBeGreaterThanOrEqual(44);
  expect(openingHoursBox!.height).toBeGreaterThanOrEqual(44);
  expect(mapsBox!.x).toBeGreaterThanOrEqual(practicalInfoBox!.x);
  expect(mapsBox!.x + mapsBox!.width).toBeLessThanOrEqual(
    practicalInfoBox!.x + practicalInfoBox!.width + 1,
  );
  expect(websiteBox!.x).toBeGreaterThanOrEqual(practicalInfoBox!.x);
  expect(websiteBox!.x + websiteBox!.width).toBeLessThanOrEqual(
    practicalInfoBox!.x + practicalInfoBox!.width + 1,
  );
  expect(websiteBox!.y).toBeGreaterThanOrEqual(mapsBox!.y + mapsBox!.height - 1);
  expect(Math.abs(websiteBox!.y - openingHoursBox!.y)).toBeLessThanOrEqual(1);

  const addressContent = maps.locator("span").first();
  const addressMetrics = await addressContent.evaluate((element) => {
    const style = window.getComputedStyle(element);
    const lineHeight = Number.parseFloat(style.lineHeight);
    return {
      height: element.getBoundingClientRect().height,
      lineHeight,
      lineClamp: style.getPropertyValue("-webkit-line-clamp"),
    };
  });
  expect(addressMetrics.lineClamp).toBe("none");
  expect(addressMetrics.height).toBeLessThanOrEqual(addressMetrics.lineHeight * 3 + 1);

  const widths = await page.evaluate(() => ({
    documentClient: document.documentElement.clientWidth,
    documentScroll: document.documentElement.scrollWidth,
    bodyClient: document.body.clientWidth,
    bodyScroll: document.body.scrollWidth,
  }));
  expect(widths.documentScroll).toBeLessThanOrEqual(widths.documentClient);
  expect(widths.bodyScroll).toBeLessThanOrEqual(widths.bodyClient);
});
