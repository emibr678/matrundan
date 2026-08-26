import { expect, test, type Page } from "@playwright/test";

const SUPABASE_AUTH_STORAGE_KEY = "sb-127-auth-token";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "22222222-2222-4222-8222-222222222222";
const PLACE_ID = "33333333-3333-4333-8333-333333333333";
const PROVIDER_PLACE_ID = "geo-testkoket";
const WEBSITE_FINGERPRINT = "11111111111111111111111111111111";
const HOURS_FINGERPRINT = "22222222222222222222222222222222";

function openingHours() {
  return {
    days: [
      { code: "Mo", label: "Måndag", intervals: ["10–21"], closed: false, known: true },
      { code: "Tu", label: "Tisdag", intervals: ["10–21"], closed: false, known: true },
      { code: "We", label: "Onsdag", intervals: ["10–21"], closed: false, known: true },
      { code: "Th", label: "Torsdag", intervals: ["10–21"], closed: false, known: true },
      { code: "Fr", label: "Fredag", intervals: ["10–22"], closed: false, known: true },
      { code: "Sa", label: "Lördag", intervals: ["11–22"], closed: false, known: true },
      { code: "Su", label: "Söndag", intervals: [], closed: true, known: true },
    ],
    partiallyParsed: false,
  };
}

async function seedSession(page: Page) {
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
      cacheValue: {
        cachedAt: now,
        details: {
          openingHours: null,
          website: null,
          timezone: "Europe/Stockholm",
          fetchedAt: now,
          attribution: "Platsdata från Geoapify och © OpenStreetMap-bidragsgivare.",
        },
      },
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

async function mockGroup(page: Page) {
  const now = new Date().toISOString();
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
        role: "member",
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
        website: null,
        canonicalWebsite: null,
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

  await page.route("**/rest/v1/rpc/list_user_groups_v4b", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: GROUP_ID,
          name: "Testgruppen",
          emoji: "🍽️",
          role: "member",
          lifecycleStatus: "active",
        },
      ]),
    });
  });
  for (const rpc of [
    "get_group_app_state_v5k",
    "get_group_app_state_v5j",
    "get_group_app_state_v5i",
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

async function openPracticalInfo(page: Page) {
  const openingHours = page.getByText("Öppettider", { exact: true });
  await expect(openingHours).toBeVisible();
  await openingHours.click();
}

test("visar och tillämpar fältvisa förslag utan privat ursprungsdata", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await seedSession(page);
  await mockGroup(page);

  let websiteApplied = false;
  await page.route(
    "**/rest/v1/rpc/get_cross_group_practical_info_suggestions_v1",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          website: websiteApplied
            ? { status: "none" }
            : {
                status: "available",
                fingerprint: WEBSITE_FINGERPRINT,
                website: "https://www.nya-testkoket.se/",
                changedAt: "2026-08-02T17:00:00Z",
              },
          openingHours: {
            status: "available",
            fingerprint: HOURS_FINGERPRINT,
            openingHours: openingHours(),
            changedAt: "2026-08-02T17:00:00Z",
          },
        }),
      });
    },
  );

  let applyBody: Record<string, unknown> | null = null;
  await page.route(
    "**/rest/v1/rpc/apply_cross_group_practical_info_suggestion_v1",
    async (route) => {
      applyBody = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
      websiteApplied = true;
      await route.fulfill({ status: 204, body: "" });
    },
  );

  await page.goto(`/matstallen/${PLACE_ID}`);
  await openPracticalInfo(page);

  await expect(page.getByText("Förslag från andra grupper", { exact: true })).toBeVisible();
  await expect(page.getByText("Föreslagen webbplats", { exact: true })).toBeVisible();
  await expect(page.getByText("Föreslagna öppettider", { exact: true })).toBeVisible();
  await expect(page.getByText("nya-testkoket.se", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Grupp, medlem, källa och privata anteckningar visas aldrig/),
  ).toBeVisible();
  await expect(page.getByText("Hemliga gruppen", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Anna Andersson", { exact: true })).toHaveCount(0);
  await expect(page.getByText("https://privat-kalla.example", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Använd för gruppen" }).first().click();
  await expect.poll(() => applyBody).not.toBeNull();
  expect(applyBody).toEqual({
    _group_id: GROUP_ID,
    _place_id: PLACE_ID,
    _field: "website",
    _fingerprint: WEBSITE_FINGERPRINT,
  });
  await expect(page.getByText("Föreslagen webbplats", { exact: true })).toHaveCount(0);
});

test("motstridiga förslag visas utan vinnare eller tillämpningsknapp", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await seedSession(page);
  await mockGroup(page);
  await page.route(
    "**/rest/v1/rpc/get_cross_group_practical_info_suggestions_v1",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          website: { status: "conflicting" },
          openingHours: { status: "conflicting" },
        }),
      });
    },
  );

  await page.goto(`/matstallen/${PLACE_ID}`);
  await openPracticalInfo(page);

  await expect(page.getByText(/Andra grupper har olika webbplatser/)).toBeVisible();
  await expect(page.getByText(/Andra grupper har olika öppettider/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Använd för gruppen" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
