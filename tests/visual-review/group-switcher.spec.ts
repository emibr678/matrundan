import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const SUPABASE_AUTH_STORAGE_KEY = "sb-127-auth-token";
const ACTIVE_GROUP_KEY = "matrundan.activeGroup.v1";
const RECENT_GROUPS_KEY_PREFIX = "matrundan.recentGroups.v1:";

const ownerId = "11111111-1111-4111-8111-111111111111";
const enskedeId = "33333333-3333-4333-8333-333333333331";
const skargardId = "33333333-3333-4333-8333-333333333332";
const forstaId = "33333333-3333-4333-8333-333333333333";
const andraId = "33333333-3333-4333-8333-333333333334";
const stockholmId = "33333333-3333-4333-8333-333333333335";
const lunchId = "33333333-3333-4333-8333-333333333336";
const archivedId = "33333333-3333-4333-8333-333333333337";

const groups = [
  {
    id: enskedeId,
    name: "Enskede runt",
    emoji: "🍽️",
    description: "Utforska matställen nära där vi bor.",
    role: "owner",
    lifecycleStatus: "active",
  },
  {
    id: skargardId,
    name: "Stockholm skärgård",
    emoji: "🍣",
    description: "Ställen vi vill upptäcka och återvända till i skärgården.",
    role: "owner",
    lifecycleStatus: "active",
  },
  {
    id: forstaId,
    name: "Första Testgruppen",
    emoji: "🍔",
    description: null,
    role: "owner",
    lifecycleStatus: "active",
  },
  {
    id: andraId,
    name: "Andra Testgruppen",
    emoji: "🍝",
    description: null,
    role: "admin",
    lifecycleStatus: "active",
  },
  {
    id: stockholmId,
    name: "Storstockholm",
    emoji: "🥐",
    description: "Vår gemensamma samlingsgrupp för ställen runt hela Stockholm.",
    role: "member",
    lifecycleStatus: "active",
  },
  {
    id: lunchId,
    name: "Lunchgänget",
    emoji: "🥗",
    description: "Lunchställen nära jobbet.",
    role: "member",
    lifecycleStatus: "active",
  },
  {
    id: archivedId,
    name: "Sommar 2025",
    emoji: "🌮",
    description: "En äldre sommargrupp vi vill kunna återvända till.",
    role: "owner",
    lifecycleStatus: "archived",
  },
] as const;

async function installSession(page: Page) {
  const now = new Date().toISOString();
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;

  await page.addInitScript(
    ({ storageKey, activeKey, activeGroupId, recentKey, recentGroupIds, session }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
      window.localStorage.setItem(activeKey, activeGroupId);
      window.localStorage.setItem(recentKey, JSON.stringify(recentGroupIds));
    },
    {
      storageKey: SUPABASE_AUTH_STORAGE_KEY,
      activeKey: ACTIVE_GROUP_KEY,
      activeGroupId: enskedeId,
      recentKey: `${RECENT_GROUPS_KEY_PREFIX}${ownerId}`,
      recentGroupIds: [skargardId, forstaId],
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
        body: JSON.stringify(groups),
      });
      return;
    }

    if (
      rpc === "get_group_app_state_v5m" ||
      rpc === "get_group_app_state_v5l" ||
      rpc === "get_group_app_state_v5k" ||
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
            id: enskedeId,
            name: "Enskede runt",
            emoji: "🍽️",
            city: "Stockholm",
            createdAt: now,
            ownerId,
            lifecycleStatus: "active",
            archivedAt: null,
            archivedBy: null,
            sharedVisitsCountForProgression: true,
            defaultSearchRadiusKm: 5,
            searchAreas: [],
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

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const outputDirectory = path.join("visual-review", testInfo.project.name);
  await mkdir(outputDirectory, { recursive: true });
  await page.screenshot({
    path: path.join(outputDirectory, `${name}.png`),
    fullPage: true,
  });
}

test("gruppbytaren skalar med recent-grupper och Alla grupper", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await installSession(page);
  await page.goto("/gruppen", { waitUntil: "domcontentloaded" });

  const trigger = page.getByRole("button", { name: "Profil och grupp: Enskede runt" });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const menu = page.getByRole("menu");
  await expect(menu.getByText("Byt grupp", { exact: true })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /Enskede runt/ })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /Stockholm skärgård/ })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /Första Testgruppen/ })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Alla grupper" })).toBeVisible();
  await expect(menu.getByText("ÄGARE", { exact: true })).toHaveCount(0);
  await expect(menu.getByText("Sommar 2025", { exact: true })).toHaveCount(0);
  await expect(menu.getByText("Storstockholm", { exact: true })).toHaveCount(0);

  await menu.getByRole("menuitem", { name: "Alla grupper" }).click();

  const dialog = page.getByRole("dialog", { name: "Alla grupper" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Aktiva grupper", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Arkiverade grupper", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Utforska matställen nära där vi bor.")).toBeVisible();
  await expect(
    dialog.getByText("Vår gemensamma samlingsgrupp för ställen runt hela Stockholm."),
  ).toBeVisible();
  await expect(dialog.getByText("Sommar 2025", { exact: true })).toBeVisible();
  await capture(page, testInfo, "alla-grupper-mobil");

  await dialog.getByRole("button", { name: /Storstockholm/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Profil och grupp: Storstockholm" })).toBeVisible();
});
