import { expect, test, type Page } from "@playwright/test";

const SUPABASE_AUTH_STORAGE_KEY = "sb-127-auth-token";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "22222222-2222-4222-8222-222222222222";
const PLACE_ID = "33333333-3333-4333-8333-333333333333";
const PROVIDER_PLACE_ID = "geo-testkoket";

async function seedAuthenticatedSession(page: Page, details: unknown) {
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
      cacheValue: { cachedAt: now, details },
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

async function mockLiveGroup(
  page: Page,
  website: string | null,
  address = "Testgatan 1",
  placeName = "Testköket",
) {
  const now = new Date().toISOString();
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

  const appState = {
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
        name: placeName,
        category: "restaurang",
        canonicalCategory: "restaurang",
        categoryOverride: null,
        cuisines: ["Svenskt"],
        canonicalCuisines: ["Svenskt"],
        cuisinesOverride: null,
        occasions: [],
        address,
        area: "Enskede",
        city: "Stockholm",
        lat: 59.283,
        lng: 18.07,
        website,
        canonicalWebsite: website,
        websiteOverride: null,
        openingHoursOverride: null,
        practicalInfoSourceUrl: null,
        practicalInfoSourceNote: null,
        practicalInfoUpdatedBy: null,
        practicalInfoUpdatedByName: null,
        practicalInfoUpdatedAt: null,
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
    "get_group_app_state_v5j",
    "get_group_app_state_v5i",
    "get_group_app_state_v5h",
    "get_group_app_state_v5g",
    "get_group_app_state_v5f",
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
      body: JSON.stringify({
        websiteOverride: null,
        openingHoursOverride: null,
        sourceUrl: null,
        sourceNote: null,
        updatedBy: null,
        updatedByName: null,
        updatedAt: null,
      }),
    });
  });

  await page.route(
    "**/rest/v1/rpc/get_cross_group_practical_info_suggestions_v1",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          website: { status: "none" },
          openingHours: { status: "none" },
        }),
      });
    },
  );
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

function weeklyDetails(now: string) {
  return {
    openingHours: {
      days: [
        { code: "Mo", label: "Måndag", intervals: ["11–22"], closed: false, known: true },
        { code: "Tu", label: "Tisdag", intervals: ["11–22"], closed: false, known: true },
        { code: "We", label: "Onsdag", intervals: ["11–22"], closed: false, known: true },
        { code: "Th", label: "Torsdag", intervals: ["11–22"], closed: false, known: true },
        { code: "Fr", label: "Fredag", intervals: ["11–22"], closed: false, known: true },
        { code: "Sa", label: "Lördag", intervals: ["12–23"], closed: false, known: true },
        { code: "Su", label: "Söndag", intervals: [], closed: true, known: true },
      ],
      partiallyParsed: false,
    },
    website: "https://www.testkoket.se/",
    timezone: "Europe/Stockholm",
    location: {
      address: "Testgatan 1",
      area: "Enskede",
      city: "Stockholm",
      lat: 59.283,
      lng: 18.07,
      osmType: "node",
      osmId: "123",
    },
    fetchedAt: now,
    attribution: "Platsdata från Geoapify och © OpenStreetMap-bidragsgivare.",
  };
}

test("platskortet visar adress över en kompakt delad rad på mobil och desktop", async ({
  page,
}) => {
  const now = new Date().toISOString();
  await page.setViewportSize({ width: 360, height: 800 });
  await seedAuthenticatedSession(page, weeklyDetails(now));
  await mockLiveGroup(page, "https://www.testkoket.se/");

  await page.goto(`/matstallen/${PLACE_ID}`);

  const heading = page.getByRole("heading", { name: "Testköket" });
  const identity = page.getByTestId("place-identity-grid");
  const practicalInfo = page.getByTestId("place-practical-info");
  const addressRow = page.getByTestId("place-address-row");
  const compactRow = page.getByTestId("place-practical-links");
  const mapsLink = page.getByRole("link", { name: "Öppna Testköket i Google Maps" });
  const checkInfo = page.getByRole("button", { name: "Kontrollera uppgifter" });
  const websiteLink = page.getByRole("link", { name: "Öppna webbplatsen för Testköket" });
  const openingHours = page.getByLabel(/^Öppettider:/);

  await expect(heading).toBeVisible();
  await expect(identity).toBeVisible();
  await expect(practicalInfo).toBeVisible();
  await expect(addressRow).toBeVisible();
  await expect(compactRow).toBeVisible();
  await expect(mapsLink).toBeVisible();
  await expect(checkInfo).toBeVisible();
  await expect(websiteLink).toBeVisible();
  await expect(openingHours).toBeVisible();
  await expect(page.getByTestId("place-info-status-dot")).toHaveCount(0);

  const [addressBox, mapsBox, compactBox, websiteBox, openingBox, checkBox] = await Promise.all([
    addressRow.boundingBox(),
    mapsLink.boundingBox(),
    compactRow.boundingBox(),
    websiteLink.boundingBox(),
    openingHours.boundingBox(),
    checkInfo.boundingBox(),
  ]);
  expect(addressBox).not.toBeNull();
  expect(mapsBox).not.toBeNull();
  expect(compactBox).not.toBeNull();
  expect(websiteBox).not.toBeNull();
  expect(openingBox).not.toBeNull();
  expect(checkBox).not.toBeNull();
  expect(addressBox!.height).toBeGreaterThanOrEqual(44);
  expect(mapsBox!.height).toBeGreaterThanOrEqual(44);
  expect(websiteBox!.height).toBeGreaterThanOrEqual(44);
  expect(openingBox!.height).toBeGreaterThanOrEqual(44);
  expect(checkBox!.width).toBeGreaterThanOrEqual(44);
  expect(checkBox!.height).toBeGreaterThanOrEqual(44);
  expect(Math.abs(websiteBox!.y - openingBox!.y)).toBeLessThanOrEqual(1);
  expect(compactBox!.y).toBeGreaterThanOrEqual(addressBox!.y + addressBox!.height - 1);
  expect(
    Math.abs(mapsBox!.y + mapsBox!.height / 2 - (addressBox!.y + addressBox!.height / 2)),
  ).toBeLessThanOrEqual(2);
  await expectNoHorizontalOverflow(page);

  await openingHours.click();
  await expect(page.getByText("Måndag", { exact: true })).toBeVisible();
  await expect(page.getByText("Söndag", { exact: true })).toBeVisible();
  const openedHours = openingHours.locator("xpath=ancestor::details");
  const [openedBox, practicalBox] = await Promise.all([
    openedHours.boundingBox(),
    practicalInfo.boundingBox(),
  ]);
  expect(openedBox).not.toBeNull();
  expect(practicalBox).not.toBeNull();
  expect(openedBox!.width).toBeGreaterThanOrEqual(practicalBox!.width - 2);
  await expectNoHorizontalOverflow(page);

  await checkInfo.click();
  const sheet = page.getByTestId("place-info-check-sheet");
  await expect(sheet.getByRole("heading", { name: "Kontrollera uppgifter" })).toBeVisible();
  await expect(sheet.getByText("Adress och kartposition", { exact: true })).toBeVisible();
  await expect(sheet.getByText("Webbplats", { exact: true })).toBeVisible();
  await expect(sheet.getByText("Öppettider", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1024, height: 900 });
  const [desktopPractical, desktopIdentity] = await Promise.all([
    practicalInfo.boundingBox(),
    identity.boundingBox(),
  ]);
  expect(desktopPractical).not.toBeNull();
  expect(desktopIdentity).not.toBeNull();
  expect(desktopPractical!.width).toBeGreaterThanOrEqual(desktopIdentity!.width - 1);
  await expectNoHorizontalOverflow(page);
});

test("saknad webbplats och öppettider behåller två kompakta celler", async ({ page }) => {
  const now = new Date().toISOString();
  await page.setViewportSize({ width: 360, height: 800 });
  await seedAuthenticatedSession(page, {
    openingHours: null,
    website: null,
    timezone: "Europe/Stockholm",
    location: {
      address: "Testgatan 1",
      area: "Enskede",
      city: "Stockholm",
      lat: 59.283,
      lng: 18.07,
      osmType: null,
      osmId: null,
    },
    fetchedAt: now,
    attribution: "Platsdata från Geoapify och © OpenStreetMap-bidragsgivare.",
  });
  await mockLiveGroup(page, null);

  await page.goto(`/matstallen/${PLACE_ID}`);

  const mapsLink = page.getByRole("link", { name: "Öppna Testköket i Google Maps" });
  const addWebsite = page.getByRole("button", { name: "Lägg till webbplats" });
  const openingHours = page.getByLabel("Öppettider: Saknas");
  const register = page.getByRole("button", { name: "Registrera besök", exact: true });
  const propose = page.getByRole("button", { name: "Föreslå som nästa stopp", exact: true });

  await expect(mapsLink).toBeVisible();
  await expect(addWebsite).toBeVisible();
  await expect(openingHours).toBeVisible();
  await expect(register).toBeVisible();
  await expect(propose).toBeVisible();

  const [websiteBox, openingBox, registerBox, proposeBox] = await Promise.all([
    addWebsite.boundingBox(),
    openingHours.boundingBox(),
    register.boundingBox(),
    propose.boundingBox(),
  ]);
  expect(websiteBox).not.toBeNull();
  expect(openingBox).not.toBeNull();
  expect(registerBox).not.toBeNull();
  expect(proposeBox).not.toBeNull();
  expect(websiteBox!.height).toBeGreaterThanOrEqual(44);
  expect(openingBox!.height).toBeGreaterThanOrEqual(44);
  expect(Math.abs(websiteBox!.y - openingBox!.y)).toBeLessThanOrEqual(1);
  expect(openingBox!.y).toBeLessThan(registerBox!.y);
  expect(registerBox!.y).toBeLessThan(proposeBox!.y);

  await addWebsite.click();
  const addWebsiteDialog = page.getByRole("dialog", { name: "Lägg till webbplats" });
  await expect(addWebsiteDialog.getByLabel("Webbplats")).toBeVisible();
  await expect(addWebsiteDialog.getByText(/publiceras aldrig externt automatiskt/)).toBeVisible();
  await addWebsiteDialog.getByRole("button", { name: "Avbryt" }).click();

  await openingHours.click();
  await expect(page.getByRole("button", { name: "Ändra", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
