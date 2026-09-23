import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const SUPABASE_AUTH_STORAGE_KEY = "sb-127-auth-token";
const ACTIVE_GROUP_KEY = "matrundan.activeGroup.v1";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_GROUP_ID = "33333333-3333-4333-8333-333333333333";
const TARGET_GROUP_ID = "44444444-4444-4444-8444-444444444444";
const PLACE_ID = "55555555-5555-4555-8555-555555555555";
const VISIT_ID = "66666666-6666-4666-8666-666666666666";

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

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
}

async function seedSession(page: Page) {
  const now = new Date().toISOString();
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  await page.addInitScript(
    ({ storageKey, activeGroupKey, sourceGroupId, session }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
      window.localStorage.setItem(activeGroupKey, sourceGroupId);
    },
    {
      storageKey: SUPABASE_AUTH_STORAGE_KEY,
      activeGroupKey: ACTIVE_GROUP_KEY,
      sourceGroupId: SOURCE_GROUP_ID,
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

function sourceState() {
  return {
    currentUserId: USER_ID,
    group: {
      id: SOURCE_GROUP_ID,
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
        occasions: ["Avslappnat"],
        address: "Testgatan 1",
        area: "Södermalm",
        city: "Stockholm",
        lat: 59.31,
        lng: 18.07,
        website: null,
        canonicalWebsite: null,
        websiteOverride: null,
        openingHoursOverride: null,
        practicalInfoSourceUrl: null,
        practicalInfoSourceNote: null,
        practicalInfoUpdatedBy: null,
        practicalInfoUpdatedByName: null,
        practicalInfoUpdatedAt: null,
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
    visits: [
      {
        id: VISIT_ID,
        placeId: PLACE_ID,
        date: "2026-09-20",
        meal: "middag",
        isTakeaway: false,
        createdBy: USER_ID,
        linkType: "original",
        linkedBy: USER_ID,
        linkedAt: "2026-09-20T20:00:00Z",
        externalParticipantCount: 0,
        countsForProgression: true,
        participantIds: [USER_ID],
        currentUserParticipationStatus: "participant",
        participants: [
          {
            id: USER_ID,
            name: "Emil",
            avatar: "🙂",
            avatarImage: null,
            status: "active",
          },
        ],
        reviews: [],
        photos: [],
        photo: null,
      },
    ],
    favorites: [],
    activity: [],
    nextPlaceId: null,
    nextStopDateProposal: null,
  };
}

async function mockLive(page: Page, ownHasPhoto: boolean) {
  await page.route("**/rest/v1/rpc/**", async (route) => {
    const rpc = new URL(route.request().url()).pathname.split("/").pop() ?? "";

    if (rpc === "list_user_groups_v4b") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: SOURCE_GROUP_ID,
            name: "Kompisgänget",
            emoji: "🍜",
            role: "owner",
            lifecycleStatus: "active",
          },
          {
            id: TARGET_GROUP_ID,
            name: "Jobbgänget med ett lite längre namn",
            emoji: "🥘",
            role: "member",
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
        body: JSON.stringify(sourceState()),
      });
      return;
    }

    if (rpc === "list_visit_share_targets_v5") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            groupId: TARGET_GROUP_ID,
            name: "Jobbgänget med ett lite längre namn",
            emoji: "🥘",
            alreadyLinked: false,
            placeExistsInGroup: false,
            externalParticipantCount: 2,
            visibleParticipants: [
              {
                id: USER_ID,
                name: "Emil",
                avatar: "🙂",
                avatarImage: null,
                status: "active",
              },
            ],
            relevantReviewCount: 1,
            ownHasComment: true,
            ownHasPhoto,
            ownPhotoShared: false,
            sharedVisitsCountForProgression: false,
          },
        ]),
      });
      return;
    }

    if (rpc === "get_visit_review_reactions_v1") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

async function openShareDialog(page: Page, ownHasPhoto: boolean) {
  await seedSession(page);
  await mockLive(page, ownHasPhoto);
  await page.goto(`/besok?visit=${VISIT_ID}`, { waitUntil: "domcontentloaded" });

  const visitDialog = page.getByRole("dialog").first();
  await expect(visitDialog.getByRole("heading", { name: "Bistro Test" })).toBeVisible();
  await visitDialog.getByRole("button", { name: "Besöksalternativ" }).click();

  await expect(page.getByRole("menuitem", { name: "Redigera besök" })).toBeVisible();
  const shareMenuItem = page.getByRole("menuitem", { name: "Lägg till i annan grupp" });
  await expect(shareMenuItem).toBeVisible();
  await shareMenuItem.click();

  const shareDialog = page.getByRole("dialog", {
    name: "Lägg till besöket i en annan grupp",
  });
  await expect(shareDialog).toBeVisible();
  await shareDialog.getByRole("button", { name: /Jobbgänget med ett lite längre namn/ }).click();
  return shareDialog;
}

test("fånga uttrycklig bilddelning när egen bild finns", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  const shareDialog = await openShareDialog(page, true);

  const photoSwitch = shareDialog.getByRole("switch", { name: "Dela även min bild" });
  await expect(photoSwitch).toBeVisible();
  await expect(photoSwitch).not.toBeChecked();
  await expect(shareDialog.getByText("Gruppen räknar inte delade besök mot progression.")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await stabilize(page);
  await capture(page, testInfo, "issue-179-dela-besok-med-egen-bild");
});

test("dölj bildvalet när användaren saknar egen bild", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  const shareDialog = await openShareDialog(page, false);

  await expect(shareDialog.getByRole("switch", { name: "Dela även min bild" })).toHaveCount(0);
  await expect(shareDialog.getByRole("switch", { name: "Dela min kommentar" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await stabilize(page);
  await capture(page, testInfo, "issue-179-dela-besok-utan-egen-bild");
});

test("fånga delat besök med bild i exempelgruppen", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/exempel", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Återställ" }).click();
  await expect(page.getByText("Exempelgruppen är återställd.", { exact: true })).toBeVisible();

  await page.goto("/matstallen/p9?visit=v9", { waitUntil: "domcontentloaded" });
  const visitDialog = page.getByRole("dialog").first();
  await expect(visitDialog.getByText("Delat besök", { exact: true })).toBeVisible();
  await expect(visitDialog.getByRole("heading", { name: /Bild från besöket|Bilder från besöket/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await stabilize(page);
  await capture(page, testInfo, "issue-179-delat-besok-med-bild");
});
