import { expect, test, type Page, type TestInfo } from "@playwright/test";

const PLACE_ID = "visual-review-place";
const GROUP_ID = "visual-review-group";
const USER_ID = "visual-review-user";

async function stabilize(page: Page) {
  await page.evaluate(async () => {
    if ("fonts" in document) {
      await (document as Document & { fonts: FontFaceSet }).fonts.ready;
    }
  });
  await page.waitForTimeout(120);
}

async function expectNoHorizontalOverflow(page: Page, locator = page.locator("body")) {
  const overflow = await locator.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const dir = `visual-review/${testInfo.project.name}`;
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

async function mockBackend(page: Page, occasions: string[]) {
  const appState = {
    readModelVersion: "get_group_app_state_v5m",
    group: {
      id: GROUP_ID,
      name: "Visual review",
      emoji: "🍽️",
      createdAt: "2026-09-01T12:00:00.000Z",
      lifecycleStatus: "active",
      defaultSearchRadiusKm: 2,
      sharedVisitsCountForProgression: false,
      searchAreas: [],
    },
    currentUserId: USER_ID,
    members: [
      { id: USER_ID, name: "Emil", avatar: "🙂", role: "ägare" },
      { id: "member-2", name: "Sam", avatar: "🐻", role: "medlem" },
    ],
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
        city: "Stockholm",
        lat: 59.33,
        lng: 18.06,
        addedBy: USER_ID,
        addedAt: "2026-09-01T12:00:00.000Z",
        collectionStatus: "active",
        origin: "provider",
      },
    ],
    visits: [],
    favorites: [],
    activity: [],
    achievements: [],
    nextPlaceId: null,
    nextPlaceCandidates: [],
    nextStopDateProposal: null,
    currentUserActivityVisitedCount: 0,
  };

  await page.route("**/rest/v1/rpc/get_group_app_state_v5m", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(appState) });
  });
  await page.route("**/rest/v1/rpc/get_group_app_state_v5l", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(appState) });
  });
  await page.route("**/rest/v1/rpc/update_group_place_metadata", async (route) => {
    const request = route.request().postDataJSON() as { p_occasions?: string[] };
    appState.places[0].occasions = request.p_occasions ?? [];
    await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
  });
  await page.route("**/rest/v1/rpc/list_place_share_targets", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/rest/v1/rpc/find_registration_visit_duplicate", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/rest/v1/rpc/**", async (route) => {
    const url = route.request().url();
    if (
      url.includes("get_group_app_state_v5m") ||
      url.includes("get_group_app_state_v5l") ||
      url.includes("update_group_place_metadata") ||
      url.includes("list_place_share_targets") ||
      url.includes("find_registration_visit_duplicate")
    ) {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
  });

  await page.route("**/auth/v1/user", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: USER_ID, email: "visual@example.com" }),
    });
  });
  await page.route("**/auth/v1/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "visual-token",
        refresh_token: "visual-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user: { id: USER_ID, email: "visual@example.com" },
      }),
    });
  });

  await page.addInitScript(
    ({ groupId, userId }) => {
      localStorage.setItem("matrundan:selected-group-id", groupId);
      localStorage.setItem(
        "sb-localhost-auth-token",
        JSON.stringify({
          access_token: "visual-token",
          refresh_token: "visual-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user: { id: userId, email: "visual@example.com" },
        }),
      );
    },
    { groupId: GROUP_ID, userId: USER_ID },
  );
}

async function startVisitRegistration(page: Page, occasions: string[]) {
  await mockBackend(page, occasions);
  await page.goto(`/matstallen/${PLACE_ID}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Registrera besök" }).click();
}

async function openVisitDialog(page: Page, occasions: string[]) {
  await startVisitRegistration(page, occasions);
  const dialog = page.getByRole("dialog", { name: "Registrera besök" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("#307 På plats visar Atmosfär och härlett helhetsbetyg", async ({ page }, testInfo) => {
  const dialog = await openVisitDialog(page, ["avslappnat"]);

  await expect(dialog.getByText("Välj alla som var med.", { exact: true })).toBeVisible();
  const registrar = dialog.getByRole("button", { name: "Emil, du, deltagare" });
  await expect(registrar).toBeDisabled();
  await expect(registrar.getByText("Du", { exact: true })).toBeVisible();
  await expect(dialog.getByText("— / 5", { exact: true })).toBeVisible();

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

test("#307 Snabbt och enkelt förklarar varför Atmosfär inte räknas", async ({
  page,
}, testInfo) => {
  const dialog = await openVisitDialog(page, ["snabbt"]);

  await expect(dialog.getByText("Atmosfär ingår inte för Snabbt och enkelt.")).toBeVisible();
  await dialog
    .getByRole("button", { name: "Varför ingår inte Atmosfär för Snabbt och enkelt?" })
    .click();
  await expect(page.getByText("Varför räknas inte Atmosfär?", { exact: true })).toBeVisible();
  await expect(page.getByText(/mindre avgörande för helhetsupplevelsen/)).toBeVisible();
  await expect(page.getByText(/en enklare atmosfär är mer förväntad/)).toBeVisible();
  await expect(page.getByText(/Avslappnat eller Något extra/)).toBeVisible();

  await stabilize(page);
  await expectNoHorizontalOverflow(page, dialog);
  await capture(page, testInfo, "issue-307-snabbt-varfor-atmosfar");
});

test("#307 gästflödet är progressivt och går att stänga", async ({ page }, testInfo) => {
  const dialog = await openVisitDialog(page, ["avslappnat"]);

  await expect(dialog.getByLabel("Gästens namn")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Lägg till gäst" }).click();

  const guestInput = dialog.getByLabel("Gästens namn");
  await expect(guestInput).toBeVisible();
  await expect(
    dialog.getByText("Gäster hör bara till besöket och visas anonymt vid delning."),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Avbryt lägg till gäst" })).toBeVisible();
  await stabilize(page);
  await expectNoHorizontalOverflow(page, dialog);
  await capture(page, testInfo, "issue-307-gast-inline");

  await dialog.getByRole("button", { name: "Avbryt lägg till gäst" }).click();
  await expect(guestInput).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Lägg till gäst" })).toBeVisible();

  await dialog.getByRole("button", { name: "Lägg till gäst" }).click();
  await dialog.getByLabel("Gästens namn").fill("Maja");
  await dialog.getByRole("button", { name: "Lägg till", exact: true }).click();
  await expect(dialog.getByLabel("Gästens namn")).toHaveCount(0);
  await expect(dialog.getByText("Maja", { exact: true })).toBeVisible();
});

test("#307 Hämtmat utelämnar Atmosfär och härleder tre dimensioner", async ({
  page,
}, testInfo) => {
  const dialog = await openVisitDialog(page, ["avslappnat"]);
  await dialog.getByRole("switch", { name: "Markera besöket som Hämtmat" }).click();

  await expect(dialog.getByRole("button", { name: /Atmosfär:/ })).toHaveCount(0);
  await expect(dialog.getByText("Atmosfär ingår inte vid Hämtmat.", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Varför ingår inte Atmosfär vid Hämtmat?" }).click();
  await expect(page.getByText("Varför räknas inte Atmosfär?", { exact: true })).toBeVisible();
  await expect(page.getByText(/inte en del av just den besöksupplevelsen/)).toBeVisible();
  await expect(page.getByText(/räknas inte in i helhetsbetyget/)).toBeVisible();

  await dialog.getByRole("button", { name: "Smak: 5 av 5" }).click();
  await dialog.getByRole("button", { name: "Service: 4 av 5" }).click();
  await dialog.getByRole("button", { name: "Prisvärdhet: 4 av 5" }).click();

  await expect(dialog.getByText("4,3 / 5", { exact: true })).toBeVisible();
  await dialog.getByText("Helhetsbetyg", { exact: true }).scrollIntoViewIfNeeded();
  await stabilize(page);
  await expectNoHorizontalOverflow(page, dialog);
  await capture(page, testInfo, "issue-307-hamtmat-tre-betyg");
});

test("#307 saknat Passar för löses före själva besöksregistreringen", async ({
  page,
}, testInfo) => {
  await startVisitRegistration(page, []);

  const gate = page.getByRole("dialog", { name: "När passar stället bäst?" });
  await expect(gate).toBeVisible();
  await expect(gate.getByText(/när ni skulle välja stället/)).toBeVisible();
  await expect(gate.getByText(/Valet sparas för gruppen/)).toBeVisible();
  await expect(gate.getByText(/saknar Passar för/)).toHaveCount(0);
  await expect(gate.getByText("Atmosfär", { exact: true })).toHaveCount(0);

  const quick = gate.getByRole("button", { name: "Passar för: Snabbt och enkelt" });
  const relaxed = gate.getByRole("button", { name: "Passar för: Avslappnat" });
  const extra = gate.getByRole("button", { name: "Passar för: Något extra" });
  await expect(quick.getByText("Snabbt & enkelt", { exact: true })).toBeVisible();
  const boxes = await Promise.all([quick, relaxed, extra].map((button) => button.boundingBox()));
  expect(boxes.every((box) => box != null)).toBe(true);
  const yPositions = boxes.map((box) => box?.y ?? 0);
  expect(Math.max(...yPositions) - Math.min(...yPositions)).toBeLessThan(2);

  await relaxed.click();
  await gate.getByRole("button", { name: "Vad betyder alternativen?" }).click();
  await expect(gate.getByText(/inte hur bra stället är/)).toBeVisible();
  await stabilize(page);
  await expectNoHorizontalOverflow(page, gate);
  await capture(page, testInfo, "issue-307-passar-for-forst");

  await gate.getByRole("button", { name: "Spara och fortsätt" }).click();
  await expect(gate).toBeHidden();

  const dialog = page.getByRole("dialog", { name: "Registrera besök" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Atmosfär", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Spara besöket nu, omdömet kan vänta")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Spara besök utan omdöme" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, dialog);
});
