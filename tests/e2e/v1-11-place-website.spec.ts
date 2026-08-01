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

test("matställets webbplats visas diskret utan mobil overflow", async ({ page }) => {
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
            website: "https://www.testkoket.se/meny",
            canonicalWebsite: "https://www.testkoket.se/meny",
            websiteOverride: null,
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
      }),
    });
  });

  await page.goto(`/matstallen/${PLACE_ID}`);

  await expect(page.getByRole("heading", { name: "Testköket" })).toBeVisible();
  const website = page.getByRole("link", { name: "Öppna webbplatsen för Testköket" });
  await expect(website).toBeVisible();
  await expect(website).toHaveAttribute("href", "https://www.testkoket.se/meny");
  await expect(page.getByRole("link", { name: "Öppna Testköket i Google Maps" })).toBeVisible();

  const widths = await page.evaluate(() => ({
    documentClient: document.documentElement.clientWidth,
    documentScroll: document.documentElement.scrollWidth,
    bodyClient: document.body.clientWidth,
    bodyScroll: document.body.scrollWidth,
  }));
  expect(widths.documentScroll).toBeLessThanOrEqual(widths.documentClient);
  expect(widths.bodyScroll).toBeLessThanOrEqual(widths.bodyClient);
});
