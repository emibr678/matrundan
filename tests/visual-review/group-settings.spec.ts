import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const SUPABASE_AUTH_STORAGE_KEY = "sb-127-auth-token";

async function installOwnerSession(
  page: Page,
  options: { inviteCandidates?: unknown[]; pendingInvites?: unknown[] } = {},
) {
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
            description: "Vi upptäcker nya middagsställen tillsammans på fredagar.",
            role: "owner",
            lifecycleStatus: "active",
          },
        ]),
      });
      return;
    }

    if (
      rpc === "get_group_app_state_v5n" ||
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

    if (rpc === "list_my_group_invitations") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(options.pendingInvites ?? []),
      });
      return;
    }

    if (rpc === "list_group_invite_candidates") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(options.inviteCandidates ?? []),
      });
      return;
    }

    if (rpc === "list_own_group_invitations") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
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
  const statusEntry = menu.getByRole("button", { name: /Lämna eller hantera gruppen/ });
  await expect(statusEntry).toBeVisible();
  await capture(page, testInfo, "gruppinstallningar-meny");

  await statusEntry.click();
  const status = page.getByRole("dialog", { name: "Lämna eller hantera gruppen" });
  await expect(status).toBeVisible();
  await capture(page, testInfo, "gruppinstallningar-lamna-eller-hantera");
  await status.getByRole("button", { name: "Till inställningar" }).click();

  await menu.getByRole("button", { name: /^Sökområden/ }).click();
  const search = page.getByRole("dialog", { name: "Sökområden" });
  await expect(search.getByText("Stockholms kommun", { exact: true })).toBeVisible();
  await expect(search.getByTitle("Gamla Enskede, Stockholm")).toBeVisible();
  await capture(page, testInfo, "gruppinstallningar-sokomraden");

  await search.getByRole("button", { name: "Till inställningar" }).click();
  await menu.getByRole("button", { name: /^Gruppen/ }).click();
  const basics = page.getByRole("dialog", { name: "Gruppen" });
  await expect(basics.getByLabel("Namn")).toHaveValue("Fredagsgänget");
  await expect(basics.getByLabel("Kort beskrivning (valfritt)")).toHaveValue(
    "Vi upptäcker nya middagsställen tillsammans på fredagar.",
  );
  await capture(page, testInfo, "gruppinstallningar-gruppen");

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Profil och grupp: Fredagsgänget" }).click();
  await page.getByRole("menuitem", { name: "Skapa ny grupp" }).click();
  const createGroup = page.getByRole("dialog", { name: "Skapa ny grupp" });
  await expect(createGroup.getByLabel("Kort beskrivning (valfritt)")).toBeVisible();
  await expect(createGroup.getByText(/Samma personer kan ha flera grupper/)).toBeVisible();
  await capture(page, testInfo, "skapa-grupp-med-beskrivning");
});


test("fånga skalbar intern gruppinbjudan", async ({ page }, testInfo) => {
  const inviteCandidates = Array.from({ length: 8 }, (_, index) => ({
    user_id: `candidate-${index + 1}`,
    display_name: index === 7 ? "Zelda Zetterberg" : `Person ${index + 1}`,
    avatar_url: null,
    avatar_emoji: index % 2 === 0 ? "🍜" : "🥟",
    shared_group_names: [index === 7 ? "Kvällsgänget" : "Söndagslunch"],
    invitation_state: null,
  }));

  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await installOwnerSession(page, { inviteCandidates });
  await page.goto("/gruppen", { waitUntil: "domcontentloaded" });
  await stabilize(page);

  await page.getByRole("button", { name: "Bjud in", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /Bjud in till Fredagsgänget/ });
  await expect(dialog.getByLabel("Sök bland personer")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Visa alla 8" })).toBeVisible();
  await capture(page, testInfo, "gruppinbjudan-manga-personer");

  await dialog.getByLabel("Sök bland personer").fill("Zelda");
  await expect(dialog.getByText("Zelda Zetterberg", { exact: true })).toBeVisible();
  await capture(page, testInfo, "gruppinbjudan-sok");
});

test("fånga väntande gruppinbjudan på Hem och svarsvyn", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await installOwnerSession(page, {
    pendingInvites: [
      {
        id: "invite-1",
        group_id: "44444444-4444-4444-8444-444444444444",
        group_name: "Söndagsgänget",
        group_emoji: "🥞",
        invited_by_name: "Karin",
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      },
    ],
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await stabilize(page);

  await expect(page.getByText("Du har en gruppinbjudan", { exact: true })).toBeVisible();
  await capture(page, testInfo, "gruppinbjudan-hem");

  await page.getByRole("button", { name: "Visa inbjudan" }).click();
  const dialog = page.getByRole("dialog", { name: "Alla grupper" });
  await expect(dialog.getByText("Söndagsgänget", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Gå med" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Avböj" })).toBeVisible();
  await capture(page, testInfo, "gruppinbjudan-svar");
});
