import { expect, test } from "@playwright/test";

const SUPABASE_AUTH_STORAGE_KEY = "sb-bkyzxkfrenbbkgiymofk-auth-token";

test("inloggad laddningsvy renderas utan StoreProvider-krasch", async ({ page }) => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const groupId = "22222222-2222-4222-8222-222222222222";
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

  let releaseGroups: (() => void) | undefined;
  const groupsCanRespond = new Promise<void>((resolve) => {
    releaseGroups = resolve;
  });

  await page.route("**/rest/v1/rpc/list_user_groups_v4b", async (route) => {
    await groupsCanRespond;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: groupId,
          name: "Testgruppen",
          emoji: "🍽️",
          role: "owner",
          lifecycleStatus: "active",
        },
      ]),
    });
  });

  await page.route("**/rest/v1/rpc/get_group_app_state_v5d", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        currentUserId: userId,
        group: {
          id: groupId,
          name: "Testgruppen",
          emoji: "🍽️",
          city: "",
          createdAt: now,
          ownerId: userId,
          lifecycleStatus: "active",
          archivedAt: null,
          archivedBy: null,
          sharedVisitsCountForProgression: true,
          homeLocation: null,
        },
        members: [
          {
            id: userId,
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
      }),
    });
  });

  await page.goto("/");

  await expect(page.getByRole("button", { name: "Testanvändare" })).toBeVisible();
  await expect(page.getByText("Något gick snett")).toHaveCount(0);

  releaseGroups?.();

  await expect(page.getByText("Inget nästa stopp valt")).toBeVisible();
  await expect(page.getByText("Något gick snett")).toHaveCount(0);
});
