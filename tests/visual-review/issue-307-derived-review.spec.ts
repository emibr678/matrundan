import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
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

async function expectNoHorizontalOverflow(page: Page, dialog: Locator) {
  const documentWidths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(documentWidths.document).toBeLessThanOrEqual(documentWidths.viewport);

  const dialogWidths = await dialog.evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  expect(dialogWidths.scroll).toBeLessThanOrEqual(dialogWidths.client);
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

function groupState(occasions: string[]) {
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
        occasions,
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
    visits: [],
    favorites: [],
    activity: [],
    nextPlaceId: null,
    nextStopDateProposal: null,
  };
}

async function mockBackend(page: Page, occasions: string[]) {
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
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(groupState(occasions)),
      });
      return;
    }
    if (rpc === "list_place_share_targets_v4b") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

async function openVisitDialog(page: Page, occasions: string[]) {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await seedSession(page);
  await mockBackend(page, occasions);
  await page.goto(`/matstallen/${PLACE_ID}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Registrera besök" }).click();
  const dialog = page.getByRole("dialog", { name: "Registrera besök" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("#307 På plats visar Atmosfär och härlett helhetsbetyg", async ({ page }, testInfo) => {
  const dialog = await openVisitDialog(page, ["avslappnat"]);

  await dialog.getByRole("button", { name: "Smak: 5 av 5" }).click();
  await dialog.getByRole("button", { name: "Service: 4 av 5" }).click();
  await dialog.getByRole("button", { name: "Prisvärdhet: 4 av 5" }).click();
  await dialog.getByRole("button", { name: "Atmosfär: 2 av 5" }).click();

  await expect(dialog.getByText("3,8 / 5", { exact: true })).toBeVisible();
  await dialog.getByText("Helhetsbetyg", { exact: true }).scrollIntoViewIfNeeded();
  await stabilize(page);
  await expectNoHorizontalOverflow(page, dialog);
  await capture(page, testInfo, "issue-307-pa-plats-atmosfar");
});

test("#307 Hämtmat utelämnar Atmosfär och härleder tre dimensioner", async ({
  page,
}, testInfo) => {
  const dialog = await openVisitDialog(page, ["avslappnat"]);
  await dialog.getByRole("switch", { name: "Markera besöket som Hämtmat" }).click();

  await expect(dialog.getByRole("button", { name: /Atmosfär:/ })).toHaveCount(0);
  await expect(dialog.getByText(/Atmosfär ingår inte för Hämtmat/)).toBeVisible();

  await dialog.getByRole("button", { name: "Smak: 5 av 5" }).click();
  await dialog.getByRole("button", { name: "Service: 4 av 5" }).click();
  await dialog.getByRole("button", { name: "Prisvärdhet: 4 av 5" }).click();

  await expect(dialog.getByText("4,3 / 5", { exact: true })).toBeVisible();
  await dialog.getByText("Helhetsbetyg", { exact: true }).scrollIntoViewIfNeeded();
  await stabilize(page);
  await expectNoHorizontalOverflow(page, dialog);
  await capture(page, testInfo, "issue-307-hamtmat-tre-betyg");
});

test("#307 saknat Passar för blockerar inte det verkliga besöket", async ({
  page,
}, testInfo) => {
  const dialog = await openVisitDialog(page, []);

  await expect(dialog.getByText("Spara besöket nu, omdömet kan vänta")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Spara besök utan omdöme" })).toBeEnabled();
  await expect(dialog.getByText("Helhetsbetyg", { exact: true })).toHaveCount(0);

  await dialog.getByText("Spara besöket nu, omdömet kan vänta").scrollIntoViewIfNeeded();
  await stabilize(page);
  await expectNoHorizontalOverflow(page, dialog);
  await capture(page, testInfo, "issue-307-saknat-passar-for");
});
