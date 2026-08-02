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
      cacheKey: `matrundan.place-external-info.v1.${PROVIDER_PLACE_ID}`,
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

  await page.route("**/rest/v1/rpc/get_group_app_state_v5f", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
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
  await expect(page.getByText("Öppettider idag", { exact: true })).toBeVisible();
  await expect(page.getByText("Öppet nu", { exact: true })).toHaveCount(0);
  await page.getByText("Öppettider idag", { exact: true }).click();
  await expect(page.getByText("Måndag", { exact: true })).toBeVisible();
  await expect(page.getByText("Söndag", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("saknad webbplats och öppettider får lugna kompletteringsåtgärder", async ({ page }) => {
  const now = new Date().toISOString();
  await page.setViewportSize({ width: 360, height: 800 });
  await seedAuthenticatedSession(page, {
    openingHours: null,
    website: null,
    fetchedAt: now,
    attribution: "Platsdata från Geoapify och © OpenStreetMap-bidragsgivare.",
  });
  await mockLiveGroup(page, null);

  await page.goto(`/matstallen/${PLACE_ID}`);

  await expect(page.getByText("Webbplats saknas", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lägg till", exact: true })).toBeVisible();
  await expect(page.getByText("Öppettider saknas i kartdatan", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Komplettera", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
