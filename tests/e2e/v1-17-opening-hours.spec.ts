import { expect, test, type Page } from "@playwright/test";

const SUPABASE_AUTH_STORAGE_KEY = "sb-bkyzxkfrenbbkgiymofk-auth-token";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "22222222-2222-4222-8222-222222222222";
const PLACE_ID = "33333333-3333-4333-8333-333333333333";
const PROVIDER_PLACE_ID = "geo-testkoket";

async function seedAuthenticatedSession(page: Page, details: unknown) {
  const now = new Date().toISOString();
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;

  await page.addInitScript(
    ({ storageKey, session, cacheKey, cacheValue }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
      window.sessionStorage.setItem(cacheKey, JSON.stringify(cacheValue));
    },
    {
      storageKey: SUPABASE_AUTH_STORAGE_KEY,
      cacheKey: `matrundan.place-external-info.v2.${PROVIDER_PLACE_ID}`,
      cacheValue: { cachedAt: now, details },
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

async function mockLiveGroup(page: Page, website: string | null) {
  const now = new Date().toISOString();
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
        website,
        canonicalWebsite: website,
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
            providerPlaceId: PROVIDER_PLACE_ID,
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
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    documentClient: document.documentElement.clientWidth,
    documentScroll: document.documentElement.scrollWidth,
    bodyClient: document.body.clientWidth,
    bodyScroll: document.body.scrollWidth,
  }));
  expect(widths.documentScroll).toBeLessThanOrEqual(widths.documentClient);
  expect(widths.bodyScroll).toBeLessThanOrEqual(widths.bodyClient);
}

function weeklyDetails(now: string) {
  return {
    openingHours: {
      days: [
        { code: "Mo", label: "Måndag", intervals: ["11–22"], closed: false, known: true },
        { code: "Tu", label: "Tisdag", intervals: ["11–22"], closed: false, known: true },
        { code: "We", label: "Onsdag", intervals: ["11–22"], closed: false, known: true },
        { code: "Th", label: "Torsdag", intervals: ["11–22"], closed: false, known: true },
        { code: "Fr", label: "Fredag", intervals: ["11–22"], closed: false, known: true },
        { code: "Sa", label: "Lördag", intervals: ["12–23"], closed: false, known: true },
        { code: "Su", label: "Söndag", intervals: [], closed: true, known: true },
      ],
      partiallyParsed: false,
    },
    website: "https://www.testkoket.se/",
    timezone: "Europe/Stockholm",
    fetchedAt: now,
    attribution: "Platsdata från Geoapify och © OpenStreetMap-bidragsgivare.",
  };
}

test("detaljsidan visar ett kompakt veckoschema utan Öppet nu-status", async ({ page }) => {
  const now = new Date().toISOString();
  await page.setViewportSize({ width: 360, height: 800 });
  await seedAuthenticatedSession(page, weeklyDetails(now));
  await mockLiveGroup(page, "https://www.testkoket.se/");

  await page.goto(`/matstallen/${PLACE_ID}`);

  await expect(page.getByRole("heading", { name: "Testköket" })).toBeVisible();
  const practicalInfo = page.getByText("Webbplats och öppettider", { exact: true });
  await expect(practicalInfo).toBeVisible();
  await expect(page.getByText("Öppettider idag", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Öppet nu", { exact: true })).toHaveCount(0);
  await practicalInfo.click();
  await expect(page.getByText("Öppettider idag", { exact: true })).toBeVisible();
  await expect(page.getByText("Måndag", { exact: true })).toBeVisible();
  await expect(page.getByText("Söndag", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("saknad praktisk information tar en rad efter gruppens viktigaste handlingar", async ({
  page,
}) => {
  const now = new Date().toISOString();
  await page.setViewportSize({ width: 360, height: 800 });
  await seedAuthenticatedSession(page, {
    openingHours: null,
    website: null,
    timezone: "Europe/Stockholm",
    fetchedAt: now,
    attribution: "Platsdata från Geoapify och © OpenStreetMap-bidragsgivare.",
  });
  await mockLiveGroup(page, null);

  await page.goto(`/matstallen/${PLACE_ID}`);

  await expect(page.getByText("Ingen i gruppen har varit här än", { exact: true })).toBeVisible();
  const register = page.getByRole("button", { name: "Registrera besök", exact: true });
  const propose = page.getByRole("button", { name: "Föreslå som nästa stopp", exact: true });
  const favorite = page.getByRole("button", { name: "Markera som favorit", exact: true });
  const practicalInfo = page.getByText("Webbplats och öppettider", { exact: true });
  await expect(register).toBeVisible();
  await expect(propose).toBeVisible();
  await expect(favorite).toBeVisible();
  await expect(practicalInfo).toBeVisible();
  await expect(page.getByText("Saknas", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ändra", exact: true })).toHaveCount(0);

  const [registerBox, proposeBox, favoriteBox, practicalBox] = await Promise.all([
    register.boundingBox(),
    propose.boundingBox(),
    favorite.boundingBox(),
    practicalInfo.boundingBox(),
  ]);
  expect(registerBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(proposeBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(favoriteBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(registerBox?.y ?? 0).toBeLessThan(proposeBox?.y ?? 0);
  expect(proposeBox?.y ?? 0).toBeLessThan(favoriteBox?.y ?? 0);
  expect(favoriteBox?.y ?? 0).toBeLessThan(practicalBox?.y ?? 0);

  await practicalInfo.click();
  await expect(page.getByRole("button", { name: "Ändra", exact: true })).toBeVisible();
  await expect(page.getByText("Webbplats och öppettider saknas.", { exact: true })).toBeVisible();
  await expect(page.getByText("Webbplats", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Öppettider idag", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Öppna Testköket i Google Maps" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
