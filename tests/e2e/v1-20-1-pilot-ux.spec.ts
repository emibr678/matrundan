import { expect, test, type Page } from "@playwright/test";

const SUPABASE_AUTH_STORAGE_KEY = "sb-127-auth-token";

type RecordedMutation = {
  rpc: string;
  payload: Record<string, unknown>;
};

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth, `${context}: ingen horisontell overflow`).toBeLessThanOrEqual(
    metrics.clientWidth,
  );
}

async function installOwnerSession(
  page: Page,
  options: { inviteCandidates?: unknown[]; pendingInvites?: unknown[] } = {},
) {
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const memberId = "22222222-2222-4222-8222-222222222222";
  const groupId = "33333333-3333-4333-8333-333333333333";
  const now = new Date().toISOString();
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  let memberRole: "medlem" | "admin" = "medlem";
  const mutations: RecordedMutation[] = [];

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
          phone: "",
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
    const rpc = new URL(route.request().url()).pathname.split("/").pop() ?? "";

    if (rpc === "list_user_groups_v4b") {
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
            name: "Testgruppen",
            emoji: "🍽️",
            description: "Vi testar Stockholms bästa sushi tillsammans.",
            city: "Stockholm",
            createdAt: now,
            ownerId,
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
              id: ownerId,
              name: "Alex",
              avatar: "🦊",
              avatarImage: null,
              role: "ägare",
            },
            {
              id: memberId,
              name: "Robin",
              avatar: "🐝",
              avatarImage: null,
              role: memberRole,
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

    if (rpc === "set_member_role") {
      const payload = route.request().postDataJSON() as { _role?: string };
      memberRole = payload._role === "admin" ? "admin" : "medlem";
      await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
      return;
    }

    if (
      rpc === "update_group_identity_v1" ||
      rpc === "update_group_settings" ||
      rpc === "replace_group_search_settings"
    ) {
      mutations.push({
        rpc,
        payload: route.request().postDataJSON() as Record<string, unknown>,
      });
      await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  return { mutations };
}

test("exempelgruppen använder konsekvent ort och erbjuder båda inloggningssätten", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  await expect(page.getByText(/påhittat kompisgäng i Stockholm/)).toBeVisible();
  await expect(page.getByText(/påhittat kompisgäng i Göteborg/)).toHaveCount(0);

  await page.goto("/exempel");
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();
  await page.goto("/matstallen/p8");
  await page.getByRole("button", { name: "Markera som favorit", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ta bort favorit", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Skapa egen grupp" }).click();
  const choice = page.getByRole("dialog", { name: "Skapa en egen grupp" });
  await expect(choice.getByRole("button", { name: "Fortsätt med Google" })).toBeVisible();
  await expect(choice.getByRole("button", { name: "Fortsätt med e-post" })).toBeVisible();

  for (const name of ["Fortsätt med Google", "Fortsätt med e-post"]) {
    const box = await choice.getByRole("button", { name }).boundingBox();
    expect(box?.height ?? 0, `${name} ska ha minst 44 px tryckyta`).toBeGreaterThanOrEqual(44);
  }

  await choice.getByRole("button", { name: "Stäng" }).click();
  await expect(page.getByRole("button", { name: "Ta bort favorit", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Skapa egen grupp" }).click();
  await page
    .getByRole("dialog", { name: "Skapa en egen grupp" })
    .getByRole("button", { name: "Fortsätt med e-post" })
    .click();
  const emailDialog = page.getByRole("dialog", { name: "Logga in med e-post" });
  await emailDialog.getByRole("button", { name: "Skapa nytt konto" }).click();
  await expect(page.getByRole("dialog", { name: "Skapa konto med e-post" })).toContainText(
    "I vissa fall behöver du först bekräfta e-postadressen",
  );
  await expect(page.getByText(/ingen bekräftelse via mejl behövs/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "kontovalet från exempelgruppen");
});

test("ägaren hanterar medlemsroller med text, bekräftelse och stora tryckytor", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await installOwnerSession(page);
  await page.goto("/gruppen");

  await expect(page.getByRole("heading", { name: "Testgruppen" })).toBeVisible();
  await expect(page.getByText("Vi testar Stockholms bästa sushi tillsammans.")).toBeVisible();
  await page.getByRole("button", { name: "Gruppinställningar" }).click();
  const settings = page.getByRole("dialog", { name: "Gruppinställningar" });
  await settings.getByRole("button", { name: /Medlemmar och inbjudningar/ }).click();

  const members = page.getByRole("dialog", { name: "Medlemmar och inbjudningar" });
  await expect(members.getByRole("button", { name: "Bjud in personer" })).toHaveCount(0);
  await expect(members.getByRole("heading", { name: "Inbjudningshistorik" })).toBeVisible();
  const manage = members.getByRole("button", { name: "Hantera Robin" });
  await expect(manage).toBeVisible();
  const box = await manage.boundingBox();
  expect(box?.height ?? 0, "Hantera ska ha minst 44 px tryckyta").toBeGreaterThanOrEqual(44);
  await expect(page.locator('[title="Gör till admin"]')).toHaveCount(0);

  await manage.click();
  await page.getByRole("menuitem", { name: "Gör till administratör" }).click();
  const confirmation = page.getByRole("alertdialog", {
    name: "Gör Robin till administratör?",
  });
  await expect(confirmation).toContainText("ändra gruppens inställningar");
  await confirmation.getByRole("button", { name: "Gör till administratör" }).click();

  await expect(page.getByText("Robin är nu administratör.", { exact: true })).toBeVisible();
  await expect
    .poll(
      async () =>
        await members.getByRole("button", { name: "Hantera Robin" }).locator("..").innerText(),
    )
    .toMatch(/admin/i);

  await members.getByRole("button", { name: "Hantera Robin" }).click();
  await expect(page.getByRole("menuitem", { name: "Gör till medlem" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Överför ägarskap" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "medlemshanteringen");
});

test("grupp och sökområden sparas separat i nya inställningsmenyn", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const { mutations } = await installOwnerSession(page);
  await page.goto("/gruppen");

  await page.getByRole("button", { name: "Gruppinställningar" }).click();
  const menu = page.getByRole("dialog", { name: "Gruppinställningar" });
  for (const name of [
    /^Gruppen/,
    /^Sökområden/,
    /Medlemmar och inbjudningar/,
    /Matställen/,
    /Besök och progression/,
    /Lämna eller hantera gruppen/,
  ]) {
    await expect(menu.getByRole("button", { name })).toBeVisible();
  }
  await expect(menu.getByRole("button", { name: /Om Matrundan/ })).toHaveCount(0);

  await menu.getByRole("button", { name: /^Gruppen/ }).click();
  const basics = page.getByRole("dialog", { name: "Gruppen" });
  await basics.getByLabel("Namn").fill("Ändrat namn");
  await expect(basics.getByText("Osparade ändringar", { exact: true })).toBeVisible();

  let warning = "";
  page.once("dialog", async (dialog) => {
    warning = dialog.message();
    await dialog.dismiss();
  });
  await basics.getByRole("button", { name: "Till inställningar" }).click();
  expect(warning).toContain("osparade ändringar");
  await expect(basics).toBeVisible();

  await basics.getByRole("button", { name: "Spara ändringar" }).click();
  await expect(page.getByText("Gruppuppgifterna är uppdaterade.", { exact: true })).toBeVisible();
  expect(mutations.map(({ rpc }) => rpc)).toEqual(["update_group_identity_v1"]);
  expect(mutations[0]?.payload._name).toBe("Ändrat namn");
  expect(mutations[0]?.payload._description).toBeUndefined();
  await basics.getByRole("button", { name: "Till inställningar" }).click();

  await menu.getByRole("button", { name: /^Sökområden/ }).click();
  const search = page.getByRole("dialog", { name: "Sökområden" });
  const radius = search.getByLabel("Avstånd runt adresser och platser");
  await radius.click();
  await page.getByRole("option", { name: "Inom 2 km" }).click();
  await expect(search.getByText("Osparade ändringar", { exact: true })).toBeVisible();

  warning = "";
  page.once("dialog", async (dialog) => {
    warning = dialog.message();
    await dialog.dismiss();
  });
  await search.getByRole("button", { name: "Till inställningar" }).click();
  expect(warning).toContain("osparade ändringar");
  await expect(search).toBeVisible();

  await search.getByRole("button", { name: "Spara ändringar" }).click();
  await expect(page.getByText("Sökområdena är uppdaterade.", { exact: true })).toBeVisible();
  expect(mutations.map(({ rpc }) => rpc)).toEqual([
    "update_group_identity_v1",
    "replace_group_search_settings",
  ]);
  expect(mutations[1]?.payload._default_radius_km).toBe(2);
  await expectNoHorizontalOverflow(page, "navigerade gruppinställningar");
});

test("inbjudan är direkt hittbar från Medlemmar på mobil utan e-postfokus", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await installOwnerSession(page);
  await page.goto("/gruppen");

  await expect(page.getByRole("heading", { name: "Medlemmar", exact: true })).toBeVisible();

  const inviteButton = page.getByRole("button", { name: "Bjud in", exact: true });
  await expect(inviteButton).toBeVisible();
  const inviteBox = await inviteButton.boundingBox();
  expect(inviteBox?.height ?? 0, "Bjud in ska ha minst 44 px tryckyta").toBeGreaterThanOrEqual(44);

  await inviteButton.click();
  const dialog = page.getByRole("dialog", { name: /Bjud in till Testgruppen/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Från dina andra grupper", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Bjud in med länk", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("E-post (valfritt)")).not.toBeFocused();
  await expectNoHorizontalOverflow(page, "direkt inbjudan från Medlemmar");
});

test("många inbjudningskandidater kan sökas utan att hela listan tar över dialogen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const inviteCandidates = Array.from({ length: 8 }, (_, index) => ({
    user_id: `candidate-${index + 1}`,
    display_name: index === 7 ? "Zelda Zetterberg" : `Person ${index + 1}`,
    avatar_url: null,
    avatar_emoji: "🍽️",
    shared_group_names: [index === 7 ? "Kvällsgänget" : "Testgrupp"],
    invitation_state: null,
  }));
  await installOwnerSession(page, { inviteCandidates });
  await page.goto("/gruppen");

  await page.getByRole("button", { name: "Bjud in", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /Bjud in till Testgruppen/ });
  const search = dialog.getByLabel("Sök bland personer");
  await expect(search).toBeVisible();
  await expect(search).not.toBeFocused();
  await expect(dialog.getByText("Person 7", { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Visa alla 8" })).toBeVisible();

  await search.fill("Zelda");
  await expect(dialog.getByText("Zelda Zetterberg", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Person 1", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, "sökbar kandidatlista");
});

test("väntande gruppinbjudan syns på Hem och öppnar befintligt svarsflöde", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
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
  await page.goto("/");

  await expect(page.getByText("Du har en gruppinbjudan", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Karin har bjudit in dig till Söndagsgänget.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Visa inbjudan" }).click();

  const dialog = page.getByRole("dialog", { name: "Alla grupper" });
  await expect(dialog.getByText("Söndagsgänget", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Inbjuden av Karin", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Gå med" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Avböj" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "inbjudan på Hem");
});
