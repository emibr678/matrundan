import { expect, test, type Page } from "@playwright/test";

const SUPABASE_AUTH_STORAGE_KEY = "sb-127-auth-token";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "22222222-2222-4222-8222-222222222222";
const GROUP_NAME = "Enskede med omnejd och ännu längre gruppnamn";
const PLACE_ID = "33333333-3333-4333-8333-333333333333";
const PROVIDER_PLACE_ID = "geo-testkoket";
const REPORT_ID = "44444444-4444-4444-8444-444444444444";

interface PracticalInfoState {
  websiteOverride: string | null;
  openingHoursOverride: unknown | null;
  sourceUrl: string | null;
  sourceNote: string | null;
  updatedBy: string | null;
  updatedByName: string | null;
  updatedAt: string | null;
}

function weeklySchedule(hours = "11–22") {
  return {
    days: [
      { code: "Mo", label: "Måndag", intervals: [hours], closed: false, known: true },
      { code: "Tu", label: "Tisdag", intervals: [hours], closed: false, known: true },
      { code: "We", label: "Onsdag", intervals: [hours], closed: false, known: true },
      { code: "Th", label: "Torsdag", intervals: [hours], closed: false, known: true },
      { code: "Fr", label: "Fredag", intervals: [hours], closed: false, known: true },
      { code: "Sa", label: "Lördag", intervals: [hours], closed: false, known: true },
      { code: "Su", label: "Söndag", intervals: [hours], closed: false, known: true },
    ],
    partiallyParsed: false,
  };
}

async function seedAuthenticatedSession(page: Page, externalHours = "11–22") {
  const now = new Date().toISOString();
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  await page.addInitScript(
    ({ storageKey, session, cacheKey, cacheValue }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
      window.sessionStorage.setItem(cacheKey, JSON.stringify(cacheValue));
    },
    {
      storageKey: SUPABASE_AUTH_STORAGE_KEY,
      cacheKey: `matrundan.place-external-info.v2.${PROVIDER_PLACE_ID}`,
      cacheValue: {
        cachedAt: now,
        details: {
          openingHours: weeklySchedule(externalHours),
          website: "https://kartdata.example/",
          timezone: "Europe/Stockholm",
          fetchedAt: now,
          attribution: "Platsdata från Geoapify och © OpenStreetMap-bidragsgivare.",
        },
      },
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
          user_metadata: { full_name: "Testanvändare med ett mycket långt fullständigt namn" },
          identities: [],
          created_at: now,
          updated_at: now,
          is_anonymous: false,
        },
      },
    },
  );
}

async function mockLiveGroup(page: Page, practical: PracticalInfoState) {
  const now = new Date().toISOString();
  let reportCount = 0;

  await page.route("**/rest/v1/rpc/list_user_groups_v4b", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: GROUP_ID,
          name: GROUP_NAME,
          emoji: "🍽️",
          role: "owner",
          lifecycleStatus: "active",
        },
      ]),
    });
  });

  const appState = {
    currentUserId: USER_ID,
    group: {
      id: GROUP_ID,
      name: GROUP_NAME,
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
        website: null,
        canonicalWebsite: null,
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
  };

  for (const rpc of [
    "get_group_app_state_v5m",
    "get_group_app_state_v5l",
    "get_group_app_state_v5k",
  ]) {
    await page.route(`**/rest/v1/rpc/${rpc}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(appState),
      });
    });
  }

  await page.route("**/rest/v1/rpc/get_group_place_practical_info_v1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(practical),
    });
  });

  await page.route("**/rest/v1/rpc/update_group_place_practical_info_v1", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    practical.websiteOverride = (body._website_override as string | null) ?? null;
    practical.openingHoursOverride = body._opening_hours_override ?? null;
    practical.sourceUrl = (body._source_url as string | null) ?? null;
    practical.sourceNote = (body._source_note as string | null) ?? null;
    practical.updatedBy = USER_ID;
    practical.updatedByName = "Testanvändare";
    practical.updatedAt = new Date().toISOString();
    await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
  });

  await page.route("**/rest/v1/rpc/create_place_data_report_v1", async (route) => {
    reportCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: REPORT_ID, created: reportCount === 1 }),
    });
  });

  return { practical, reportCount: () => reportCount };
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

async function openPracticalInfo(page: Page) {
  const openingHours = page.getByText("Öppettider", { exact: true });
  await expect(openingHours).toBeVisible();
  await openingHours.click();
}

test("en aktiv medlem uppdaterar gruppens webbplats och öppettider utan tekniskt brus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await seedAuthenticatedSession(page);
  const mocked = await mockLiveGroup(page, {
    websiteOverride: null,
    openingHoursOverride: null,
    sourceUrl: null,
    sourceNote: null,
    updatedBy: null,
    updatedByName: null,
    updatedAt: null,
  });

  await page.goto(`/matstallen/${PLACE_ID}`);
  await expect(page.getByRole("button", { name: `Profil och grupp: ${GROUP_NAME}` })).toBeVisible();
  await expect(page.getByText("Öppettider", { exact: true })).toBeVisible();
  await expect(page.getByText("Praktiskt", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Öppna Testköket i Google Maps" })).toBeVisible();
  await expect(page.getByText("Google Maps", { exact: true })).toHaveCount(0);
  await openPracticalInfo(page);
  await page.getByRole("button", { name: "Ändra", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Ändra webbplats och öppettider" });
  await expect(dialog.getByText("Hur vet du det?", { exact: true })).toBeVisible();
  await dialog.getByText("Fler alternativ", { exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Sök efter ny information" })).toBeVisible();
  await dialog.getByLabel("Webbplats").fill("https://gruppen.example");
  for (const code of ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]) {
    await dialog.locator(`#practical-hours-${code}`).fill("12–23");
  }
  await dialog
    .getByLabel("Vad har du kontrollerat?")
    .fill("Tiderna kontrollerades på restaurangens dörr idag.");
  await expectNoHorizontalOverflow(page);
  await dialog.getByRole("button", { name: "Spara för gruppen" }).click();

  const website = page.getByRole("link", { name: "Öppna webbplatsen för Testköket" });
  await expect(website).toHaveAttribute("href", "https://gruppen.example/");
  await expect(page.getByText("Idag", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Måndag", { exact: true })).toBeVisible();
  await expect(page.getByText("12–23", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Gruppens uppgift", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Gruppens uppgift ändrad/)).toHaveCount(0);
  expect(mocked.reportCount()).toBe(2);
  await expectNoHorizontalOverflow(page);
});

test("nya uppgifter jämförs med verkliga värden innan gruppen väljer", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await seedAuthenticatedSession(page, "11–22");
  const mocked = await mockLiveGroup(page, {
    websiteOverride: "https://gruppen.example/",
    openingHoursOverride: weeklySchedule("12–23"),
    sourceUrl: null,
    sourceNote: "Kontrollerat av gruppen.",
    updatedBy: USER_ID,
    updatedByName: "Testanvändare",
    updatedAt: new Date().toISOString(),
  });

  await page.goto(`/matstallen/${PLACE_ID}`);
  const trigger = page.getByRole("button", {
    name: "Kontrollera uppgifter – nya uppgifter finns",
  });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const comparison = page.getByTestId("place-info-check-sheet");
  await expect(comparison.getByRole("heading", { name: "Kontrollera uppgifter" })).toBeVisible();
  await expect(comparison.getByText("https://gruppen.example/", { exact: true })).toBeVisible();
  await expect(comparison.getByText("https://kartdata.example/", { exact: true })).toBeVisible();
  await expect(comparison.getByText("12–23", { exact: true }).first()).toBeVisible();
  await expect(comparison.getByText("11–22", { exact: true }).first()).toBeVisible();
  await comparison.getByRole("button", { name: "Använd kartdatans webbplats" }).click();
  await comparison.getByRole("button", { name: "Använd kartdatans öppettider" }).click();
  await page.keyboard.press("Escape");
  await expect(comparison).toBeHidden();

  await expect(page.getByTestId("place-info-status-dot")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Öppna webbplatsen för Testköket" })).toHaveAttribute(
    "href",
    "https://kartdata.example/",
  );
  expect(mocked.practical.websiteOverride).toBeNull();
  expect(mocked.practical.openingHoursOverride).toBeNull();
  await expectNoHorizontalOverflow(page);
});

test("återgång till hittade uppgifter skapar inget nytt granskningsunderlag", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await seedAuthenticatedSession(page);
  const mocked = await mockLiveGroup(page, {
    websiteOverride: "https://gruppen.example/",
    openingHoursOverride: weeklySchedule("12–23"),
    sourceUrl: "https://gruppen.example/",
    sourceNote: null,
    updatedBy: USER_ID,
    updatedByName: "Testanvändare",
    updatedAt: new Date().toISOString(),
  });

  await page.goto(`/matstallen/${PLACE_ID}`);
  await openPracticalInfo(page);
  await page.getByRole("button", { name: "Ändra", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Ändra webbplats och öppettider" });
  await dialog.getByRole("button", { name: "Använd hittade uppgifter för allt" }).click();
  await dialog.getByRole("button", { name: "Spara för gruppen" }).click();

  await expect(page.getByRole("link", { name: "Öppna webbplatsen för Testköket" })).toHaveAttribute(
    "href",
    "https://kartdata.example/",
  );
  expect(mocked.practical.websiteOverride).toBeNull();
  expect(mocked.practical.openingHoursOverride).toBeNull();
  expect(mocked.reportCount()).toBe(0);
  await expectNoHorizontalOverflow(page);
});
