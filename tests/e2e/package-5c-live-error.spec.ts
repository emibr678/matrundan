import { expect, test, type Page } from "@playwright/test";

const SUPABASE_AUTH_STORAGE_KEY = "sb-127-auth-token";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "22222222-2222-4222-8222-222222222222";

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

function groupState() {
  const now = new Date().toISOString();
  return {
    currentUserId: USER_ID,
    group: {
      id: GROUP_ID,
      name: "Testgruppen",
      emoji: "🍽️",
      city: "",
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
    places: [],
    visits: [],
    favorites: [],
    activity: [],
    nextPlaceId: null,
    nextStopDateProposal: null,
  };
}

test("ett RPC-fel lämnar laddningsläget och kan återförsökas", async ({ page }) => {
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

  let attempts = 0;
  await page.route("**/rest/v1/rpc/get_group_app_state_v5l", async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          code: "XX000",
          message: "Tillfälligt fel vid läsning av gruppens data",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(groupState()),
    });
  });

  await page.goto("/");

  await expect(page.getByText("Kunde inte läsa gruppens data.")).toBeVisible();
  await expect(page.getByText("Hämtar gruppens data…")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Försök igen" })).toBeVisible();

  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);

  await page.getByRole("button", { name: "Försök igen" }).click();

  await expect(page.getByRole("heading", { name: "Vart går rundan härnäst?" })).toBeVisible();
  await expect(page.getByText("Kunde inte läsa gruppens data.")).toHaveCount(0);
  expect(attempts).toBe(2);
});