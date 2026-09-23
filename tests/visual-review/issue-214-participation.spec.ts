import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const SUPABASE_AUTH_STORAGE_KEY = "sb-127-auth-token";
const ACTIVE_GROUP_KEY = "matrundan.activeGroup.v1";
const SOURCE_USER_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_USER_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_GROUP_ID = "33333333-3333-4333-8333-333333333333";
const TARGET_GROUP_ID = "44444444-4444-4444-8444-444444444444";
const PLACE_ID = "55555555-5555-4555-8555-555555555555";
const VISIT_ID = "66666666-6666-4666-8666-666666666666";
const GUEST_ID = "77777777-7777-4777-8777-777777777777";

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

async function seedSourceSession(page: Page) {
  const now = new Date().toISOString();
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  await page.addInitScript(
    ({ storageKey, activeGroupKey, session }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
      window.localStorage.setItem(activeGroupKey, SOURCE_GROUP_ID);
    },
    {
      storageKey: SUPABASE_AUTH_STORAGE_KEY,
      activeGroupKey: ACTIVE_GROUP_KEY,
      session: {
        access_token: `test.${btoa(
          JSON.stringify({
            sub: SOURCE_USER_ID,
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
          id: SOURCE_USER_ID,
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
    currentUserId: SOURCE_USER_ID,
    group: {
      id: SOURCE_GROUP_ID,
      name: "Kompisgänget",
      emoji: "🍜",
      city: "Stockholm",
      createdAt: "2026-01-01T12:00:00Z",
      ownerId: SOURCE_USER_ID,
      lifecycleStatus: "active",
      archivedAt: null,
      archivedBy: null,
      sharedVisitsCountForProgression: true,
      defaultSearchRadiusKm: 1,
      searchAreas: [],
      homeLocation: null,
    },
    members: [
      { id: SOURCE_USER_ID, name: "Emil", avatar: "🙂", avatarImage: null, role: "ägare" },
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
        occasions: [],
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
        addedBy: SOURCE_USER_ID,
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
        date: "2026-09-01",
        meal: "middag",
        createdBy: SOURCE_USER_ID,
        linkType: "original",
        linkedBy: SOURCE_USER_ID,
        linkedAt: "2026-09-01T20:00:00Z",
        externalParticipantCount: 0,
        countsForProgression: true,
        participantIds: [SOURCE_USER_ID],
        currentUserParticipationStatus: "participant",
        participants: [
          {
            id: SOURCE_USER_ID,
            name: "Emil",
            avatar: "🙂",
            avatarImage: null,
            status: "active",
          },
          {
            id: `guest:${GUEST_ID}`,
            name: "Joppe",
            avatar: "👤",
            avatarImage: null,
            status: "guest",
          },
        ],
        reviews: [],
        photo: null,
      },
    ],
    favorites: [],
    activity: [],
    nextPlaceId: null,
    nextStopDateProposal: null,
  };
}

async function mockSource(page: Page) {
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
            name: "Jobbgänget",
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
    if (rpc === "list_visit_guest_member_targets_v1") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            guestId: GUEST_ID,
            guestName: "Joppe",
            groupId: TARGET_GROUP_ID,
            groupName: "Jobbgänget",
            groupEmoji: "🥘",
            memberId: TARGET_USER_ID,
            memberName: "Johan Andersson",
            memberAvatar: "🦊",
            memberAvatarImage: null,
            proposalStatus: null,
          },
        ]),
      });
      return;
    }
    if (rpc === "get_own_visit_guest_proposal_v1") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

test("fånga originalgruppens gästkoppling", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await seedSourceSession(page);
  await mockSource(page);
  await page.goto(`/besok?visit=${VISIT_ID}`, { waitUntil: "domcontentloaded" });
  const visitDialog = page.getByRole("dialog").first();
  await expect(visitDialog.getByText("Joppe", { exact: true })).toBeVisible();
  await visitDialog.getByRole("button", { name: "Koppla Joppe till gruppmedlem" }).click();
  const linkDialog = page.getByRole("dialog", { name: "Koppla Joppe till gruppmedlem" });
  await expect(linkDialog.getByRole("button", { name: "Johan Andersson" })).toBeVisible();
  await linkDialog.getByRole("button", { name: "Johan Andersson" }).click();
  await stabilize(page);
  await capture(page, testInfo, "issue-214-koppla-gast");
});

test("fånga exempelgruppens mottagna deltagandefråga", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/exempel", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Exempelgrupp · Stockholm", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Återställ" }).click();
  await expect(page.getByText("Exempelgruppen är återställd.", { exact: true })).toBeVisible();

  await page.goto("/matstallen/p9?visit=v9", { waitUntil: "domcontentloaded" });
  const visitDialog = page.getByRole("dialog").first();
  const prompt = visitDialog.getByLabel("Bekräfta deltagande");
  await expect(prompt).toBeVisible();
  await expect(visitDialog.getByRole("button", { name: "Lägg till deltagare" })).toHaveCount(0);
  await stabilize(page);
  await capture(page, testInfo, "issue-214-bekrafta-deltagande");
});
