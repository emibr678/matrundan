import { expect, test, type Page } from "@playwright/test";

const SUPABASE_AUTH_STORAGE_KEY = "sb-bkyzxkfrenbbkgiymofk-auth-token";
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
    fetchedAt: now,
    attribution: "Platsdata från Geoapify och © OpenStreetMap-bidragsgivare.",
  };
}

test("platskortet ger lång identitet en stabil tvåkolumnslayout på mobil och desktop", async ({
  page,
}) => {
  const now = new Date().toISOString();
  await page.setViewportSize({ width: 360, height: 800 });
  await seedAuthenticatedSession(page, weeklyDetails(now));
  await mockLiveGroup(
    page,
    "https://www.testkoket.se/",
    "Planens restaurang",
    "Planens restaurang",
  );

  await page.goto(`/matstallen/${PLACE_ID}`);

  const heading = page.getByRole("heading", { name: "Planens restaurang" });
  const back = page.getByRole("button", { name: "Gå tillbaka till matställen" });
  const favorite = page.getByRole("button", { name: "Markera som favorit" });
  const thumb = page.locator('[data-slot="place-thumb"]').first();
  const mapsLink = page.getByRole("link", {
    name: "Öppna Planens restaurang i Google Maps",
  });
  const websiteLink = page.getByRole("link", {
    name: "Öppna webbplatsen för Planens restaurang",
  });
  await expect(heading).toBeVisible();
  await expect(back).toBeVisible();
  await expect(favorite).toBeVisible();
  await expect(mapsLink).toBeVisible();
  await expect(websiteLink).toBeVisible();

  const addressContent = mapsLink.locator("span").first();
  const addressTailText = mapsLink.locator('[data-slot="external-link-tail-text"]');
  const addressExternalIcon = mapsLink.locator('[data-slot="external-link-icon"]');
  const websiteTailText = websiteLink.locator('[data-slot="external-link-tail-text"]');
  const websiteExternalIcon = websiteLink.locator('[data-slot="external-link-icon"]');
  await expect(addressTailText).toHaveText("Stockholm");
  await expect(websiteTailText).toHaveText("Webbplats");

  const [
    headingBox,
    backBox,
    favoriteBox,
    thumbBox,
    mapsBox,
    websiteBox,
    addressTailTextBox,
    addressExternalIconBox,
    websiteTailTextBox,
    websiteExternalIconBox,
  ] = await Promise.all([
    heading.boundingBox(),
    back.boundingBox(),
    favorite.boundingBox(),
    thumb.boundingBox(),
    mapsLink.boundingBox(),
    websiteLink.boundingBox(),
    addressTailText.boundingBox(),
    addressExternalIcon.boundingBox(),
    websiteTailText.boundingBox(),
    websiteExternalIcon.boundingBox(),
  ]);
  expect(headingBox).not.toBeNull();
  expect(backBox).not.toBeNull();
  expect(favoriteBox).not.toBeNull();
  expect(thumbBox).not.toBeNull();
  expect(mapsBox).not.toBeNull();
  expect(websiteBox).not.toBeNull();
  expect(addressTailTextBox).not.toBeNull();
  expect(addressExternalIconBox).not.toBeNull();
  expect(websiteTailTextBox).not.toBeNull();
  expect(websiteExternalIconBox).not.toBeNull();

  expect(Math.abs(favoriteBox!.y - backBox!.y)).toBeLessThanOrEqual(2);
  expect(favoriteBox!.x).toBeGreaterThan(backBox!.x + backBox!.width);
  expect(favoriteBox!.y + favoriteBox!.height).toBeLessThan(headingBox!.y);
  expect(thumbBox!.width).toBeGreaterThanOrEqual(95);
  expect(thumbBox!.width).toBeLessThanOrEqual(97);
  expect(thumbBox!.height).toBeGreaterThanOrEqual(112);
  expect(thumbBox!.height).toBeLessThanOrEqual(128);
  expect(headingBox!.width).toBeGreaterThanOrEqual(184);
  expect(Math.abs(mapsBox!.x - headingBox!.x)).toBeLessThanOrEqual(2);
  expect(mapsBox!.y).toBeGreaterThanOrEqual(headingBox!.y + headingBox!.height - 1);
  expect(Math.abs(websiteBox!.x - mapsBox!.x)).toBeLessThanOrEqual(2);
  expect(websiteBox!.y).toBeGreaterThanOrEqual(mapsBox!.y + mapsBox!.height - 1);
  expect(
    Math.abs(
      thumbBox!.y + thumbBox!.height -
        (websiteExternalIconBox!.y + websiteExternalIconBox!.height),
    ),
  ).toBeLessThanOrEqual(24);

  const addressMetrics = await addressContent.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      height: element.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(style.lineHeight),
      lineClamp: style.getPropertyValue("-webkit-line-clamp"),
    };
  });
  expect(addressMetrics.lineClamp).toBe("2");
  expect(addressMetrics.height).toBeLessThanOrEqual(addressMetrics.lineHeight * 2 + 1);

  const addressIconGap =
    addressExternalIconBox!.x - (addressTailTextBox!.x + addressTailTextBox!.width);
  const websiteIconGap =
    websiteExternalIconBox!.x - (websiteTailTextBox!.x + websiteTailTextBox!.width);
  expect(addressIconGap).toBeGreaterThanOrEqual(2);
  expect(addressIconGap).toBeLessThanOrEqual(8);
  expect(websiteIconGap).toBeGreaterThanOrEqual(2);
  expect(websiteIconGap).toBeLessThanOrEqual(8);
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 1024, height: 900 });
  const [
    desktopHeadingBox,
    desktopThumbBox,
    desktopMapsBox,
    desktopAddressIconBox,
    desktopWebsiteBox,
    desktopWebsiteIconBox,
  ] = await Promise.all([
    heading.boundingBox(),
    thumb.boundingBox(),
    mapsLink.boundingBox(),
    addressExternalIcon.boundingBox(),
    websiteLink.boundingBox(),
    websiteExternalIcon.boundingBox(),
  ]);
  expect(desktopHeadingBox).not.toBeNull();
  expect(desktopThumbBox).not.toBeNull();
  expect(desktopMapsBox).not.toBeNull();
  expect(desktopAddressIconBox).not.toBeNull();
  expect(desktopWebsiteBox).not.toBeNull();
  expect(desktopWebsiteIconBox).not.toBeNull();
  expect(desktopThumbBox!.width).toBeGreaterThanOrEqual(111);
  expect(desktopThumbBox!.width).toBeLessThanOrEqual(113);
  expect(desktopThumbBox!.height).toBeGreaterThanOrEqual(128);
  expect(desktopThumbBox!.height).toBeLessThanOrEqual(144);
  expect(Math.abs(desktopMapsBox!.x - desktopHeadingBox!.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(desktopWebsiteBox!.x - desktopMapsBox!.x)).toBeLessThanOrEqual(2);
  expect(desktopWebsiteBox!.y).toBeGreaterThanOrEqual(
    desktopMapsBox!.y + desktopMapsBox!.height - 1,
  );
  expect(
    desktopMapsBox!.x +
      desktopMapsBox!.width -
      (desktopAddressIconBox!.x + desktopAddressIconBox!.width),
  ).toBeLessThanOrEqual(2);
  expect(
    desktopWebsiteBox!.x +
      desktopWebsiteBox!.width -
      (desktopWebsiteIconBox!.x + desktopWebsiteIconBox!.width),
  ).toBeLessThanOrEqual(2);
  await expectNoHorizontalOverflow(page);

  const openingHours = page.getByText("Öppettider", { exact: true });
  const openingHoursIcon = openingHours.locator("..").locator("svg").first();
  const registerVisit = page.getByRole("button", { name: "Registrera besök", exact: true });
  await expect(openingHours).toBeVisible();
  await expect(openingHoursIcon).toBeVisible();
  await expect(registerVisit).toBeVisible();
  const [openingHoursIconBox, registerVisitBox] = await Promise.all([
    openingHoursIcon.boundingBox(),
    registerVisit.boundingBox(),
  ]);
  expect(openingHoursIconBox).not.toBeNull();
  expect(registerVisitBox).not.toBeNull();
  expect(Math.abs(openingHoursIconBox!.x - registerVisitBox!.x)).toBeLessThanOrEqual(2);
  await expect(page.getByText("Måndag", { exact: true })).toBeHidden();
  await expect(page.getByText("Öppet nu", { exact: true })).toHaveCount(0);
  await openingHours.click();
  await expect(page.getByText("Måndag", { exact: true })).toBeVisible();
  await expect(page.getByText("Söndag", { exact: true })).toBeVisible();
  await expect(page.getByText("Idag", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Gruppens webbplats och öppettider", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("saknad webbplats blir en diskret handling under adressen och öppettider tar en rad", async ({
  page,
}) => {
  const now = new Date().toISOString();
  await page.setViewportSize({ width: 360, height: 800 });
  await seedAuthenticatedSession(page, {
    openingHours: null,
    website: null,
    timezone: "Europe/Stockholm",
    fetchedAt: now,
    attribution: "Platsdata från Geoapify och © OpenStreetMap-bidragsgivare.",
  });
  await mockLiveGroup(page, null);

  await page.goto(`/matstallen/${PLACE_ID}`);

  await expect(page.getByText("Ingen i gruppen har varit här än", { exact: true })).toHaveCount(0);
  const emptyVisitMessage = page.getByText("Ingen har varit här än.", { exact: true });
  await expect(emptyVisitMessage).toBeVisible();
  const emptyVisitCardBox = await emptyVisitMessage.locator("..").boundingBox();
  expect(emptyVisitCardBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(52);
  const mapsLink = page.getByRole("link", { name: "Öppna Testköket i Google Maps" });
  const mapsIcon = mapsLink.locator("svg").first();
  const addWebsite = page.getByRole("button", { name: "Lägg till webbplats", exact: true });
  const addWebsiteIcon = addWebsite.locator("svg").first();
  const register = page.getByRole("button", { name: "Registrera besök", exact: true });
  const propose = page.getByRole("button", { name: "Föreslå som nästa stopp", exact: true });
  const favorite = page.getByRole("button", { name: "Markera som favorit", exact: true });
  const openingHours = page.getByText("Öppettider", { exact: true });
  await expect(mapsLink).toBeVisible();
  await expect(addWebsite).toBeVisible();
  await expect(register).toBeVisible();
  await expect(propose).toBeVisible();
  await expect(favorite).toBeVisible();
  await expect(openingHours).toBeVisible();
  await expect(page.getByText("Saknas", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ändra", exact: true })).toHaveCount(0);

  const [
    mapsLinkBox,
    mapsIconBox,
    addWebsiteBox,
    addWebsiteIconBox,
    registerBox,
    proposeBox,
    favoriteBox,
    openingHoursBox,
  ] = await Promise.all([
    mapsLink.boundingBox(),
    mapsIcon.boundingBox(),
    addWebsite.boundingBox(),
    addWebsiteIcon.boundingBox(),
    register.boundingBox(),
    propose.boundingBox(),
    favorite.boundingBox(),
    openingHours.boundingBox(),
  ]);
  expect(mapsLinkBox).not.toBeNull();
  expect(mapsIconBox).not.toBeNull();
  expect(addWebsiteBox).not.toBeNull();
  expect(addWebsiteIconBox).not.toBeNull();
  expect(registerBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(proposeBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(favoriteBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(addWebsiteBox!.y).toBeGreaterThanOrEqual(mapsLinkBox!.y + mapsLinkBox!.height - 1);
  expect(Math.abs(addWebsiteIconBox!.x - mapsIconBox!.x)).toBeLessThanOrEqual(2);
  expect(favoriteBox?.y ?? 0).toBeLessThan(mapsLinkBox?.y ?? 0);
  expect(addWebsiteBox?.y ?? 0).toBeLessThan(openingHoursBox?.y ?? 0);
  expect(openingHoursBox?.y ?? 0).toBeLessThan(registerBox?.y ?? 0);
  expect(registerBox?.y ?? 0).toBeLessThan(proposeBox?.y ?? 0);

  await addWebsite.click();
  const addWebsiteDialog = page.getByRole("dialog", { name: "Lägg till webbplats" });
  await expect(addWebsiteDialog.getByLabel("Webbplats")).toBeVisible();
  await expect(addWebsiteDialog.getByText(/publiceras aldrig externt automatiskt/)).toBeVisible();
  await addWebsiteDialog.getByRole("button", { name: "Avbryt" }).click();

  await openingHours.click();
  await expect(page.getByRole("button", { name: "Ändra", exact: true })).toBeVisible();
  await expect(page.getByText("Öppettider saknas.", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Gruppens webbplats och öppettider", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Idag", { exact: true })).toHaveCount(0);
  await expect(mapsLink).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
