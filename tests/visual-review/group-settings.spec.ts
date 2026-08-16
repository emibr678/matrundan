import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const SUPABASE_AUTH_STORAGE_KEY = "sb-bkyzxkfrenbbkgiymofk-auth-token";

async function installOwnerSession(page: Page) {
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const groupId = "33333333-3333-4333-8333-333333333333";
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
            sub: ownerId,
            aud: "authenticated",
            role: "authenticated",
            email: "owner@example.com",
            exp: expiresAt,
          }),
        )}.signature`,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: expiresAt,
        refresh_token: "test-refresh-token",
        user: {
          id: ownerId,
          aud: "authenticated",
          role: "authenticated",
          email: "owner@example.com",
          email_confirmed_at: now,
          confirmed_at: now,
          last_sign_in_at: now,
          app_metadata: { provider: "google", providers: ["google"] },
          user_metadata: { full_name: "Alex" },
          identities: [],
          created_at: now,
          updated_at: now,
          is_anonymous: false,
        },
      },
    },
  );

  await page.route("**/rest/v1/rpc/**", async (route) => {
    const rpc = new URL(route.request().url()).pathname.split("/").pop();

    if (rpc === "list_user_groups_v4b") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: groupId,
            name: "Fredagsgänget",
            emoji: "🍽️",
            role: "owner",
            lifecycleStatus: "active",
          },
        ]),
      });
      return;
    }

    if (
      rpc === "get_group_app_state_v5j" ||
      rpc === "get_group_app_state_v5i" ||
      rpc === "get_group_app_state_v5h" ||
      rpc === "get_group_app_state_v5g" ||
      rpc === "get_group_app_state_v5f"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          currentUserId: ownerId,
          group: {
            id: groupId,
            name: "Fredagsgänget",
            emoji: "🍽️",
            city: "Stockholm",
            createdAt: now,
            ownerId,
            lifecycleStatus: "active",
            archivedAt: null,
            archivedBy: null,
            sharedVisitsCountForProgression: true,
            defaultSearchRadiusKm: 5,
            searchAreas: [
              {
                id: "area-stockholm",
                label: "Stockholms kommun",
                lat: 59.3293,
                lng: 18.0686,
                provider: "geoapify",
                placeId: "stockholm-city",
                searchMode: "boundary",
                resultType: "city",
              },
              {
                id: "area-enskede",
                label: "Gamla Enskede, Stockholm",
                lat: 59.284,
                lng: 18.071,
                provider: "geoapify",
                placeId: "gamla-enskede",
                searchMode: "point",
                resultType: "suburb",
              },
            ],
            homeLocation: null,
          },
          members: [
            {
              id: ownerId,
              name: "Alex",
              avatar: "🦊",
              avatarImage: null,
              role: "ägare",
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
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

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
  await page.screenshot({
    path: path.join(outputDirectory, `${name}.png`),
    fullPage: true,
  });
}

test("fånga gruppinställningarnas nya informationsarkitektur", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await installOwnerSession(page);
  await page.goto("/gruppen", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Fredagsgänget" })).toBeVisible();
  await stabilize(page);

  await page.getByRole("button", { name: "Gruppinställningar" }).click();
  const menu = page.getByRole("dialog", { name: "Gruppinställningar" });
  await expect(menu.getByRole("button", { name: /^Gruppen/ })).toBeVisible();
  await expect(menu.getByRole("button", { name: /^Sökområden/ })).toBeVisible();
  await expect(menu.getByRole("button", { name: /Gruppstatus/ })).toBeVisible();
  await capture(page, testInfo, "gruppinstallningar-meny");

  await menu.getByRole("button", { name: /^Sökområden/ }).click();
  const search = page.getByRole("dialog", { name: "Sökområden" });
  await expect(search.getByText("Stockholms kommun", { exact: true })).toBeVisible();
  await expect(search.getByTitle("Gamla Enskede, Stockholm")).toBeVisible();
  await capture(page, testInfo, "gruppinstallningar-sokomraden");

  await search.getByRole("button", { name: "Till inställningar" }).click();
  await menu.getByRole("button", { name: /^Gruppen/ }).click();
  await expect(page.getByRole("dialog", { name: "Gruppen" }).getByLabel("Namn")).toHaveValue(
    "Fredagsgänget",
  );
  await capture(page, testInfo, "gruppinstallningar-gruppen");
});
