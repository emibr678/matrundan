import { expect, test } from "@playwright/test";
import { CURRENT_GROUP_STATE_RPC } from "../../src/lib/matrundan/read-model-version";

// Playwrights portabla testmiljö använder http://127.0.0.1:54321 som Supabase-URL.
// Supabase härleder då sin lokala auth-storage key från hostens projektref "127".
const SUPABASE_AUTH_STORAGE_KEY = "sb-127-auth-token";

test("session och gruppbyte behåller kontinuitet medan grupper och bilder laddas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const userId = "11111111-1111-4111-8111-111111111111";
  const groupId = "22222222-2222-4222-8222-222222222222";
  const otherGroupId = "33333333-3333-4333-8333-333333333333";
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
            sub: userId,
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
          id: userId,
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

  let releaseGroups: (() => void) | undefined;
  const groupsCanRespond = new Promise<void>((resolve) => {
    releaseGroups = resolve;
  });

  let groupListCalls = 0;
  await page.route("**/rest/v1/rpc/list_user_groups_v4b", async (route) => {
    groupListCalls += 1;
    await groupsCanRespond;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: groupId,
          name: "Grupp A",
          emoji: "🍽️",
          role: "owner",
          lifecycleStatus: "active",
        },
        {
          id: otherGroupId,
          name: "Grupp B",
          emoji: "🍽️",
          role: "owner",
          lifecycleStatus: "active",
        },
      ]),
    });
  });

  const appState = {
    currentUserId: userId,
    group: {
      id: groupId,
      name: "Grupp A",
      emoji: "🍽️",
      city: "",
      createdAt: now,
      ownerId: userId,
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
        id: userId,
        name: "Testanvändare",
        avatar: "🙂",
        avatarImage: null,
        role: "owner",
      },
    ],
    places: [],
    visits: [
      {
        id: "visit-1",
        placeId: "not-yet-collected",
        date: "2026-10-02",
        meal: "middag",
        createdBy: userId,
        linkType: "original",
        linkedBy: userId,
        linkedAt: now,
        externalParticipantCount: 0,
        countsForProgression: true,
        participantIds: [userId],
        participants: [],
        reviews: [],
        photo: {
          storagePath: "group/visit/photo.jpg",
          uploadedBy: userId,
          mimeType: "image/jpeg",
          byteSize: 100,
          width: 100,
          height: 100,
          updatedAt: now,
        },
      },
    ],
    favorites: [],
    activity: [],
    nextPlaceId: null,
    nextStopDateProposal: null,
  };

  let releasePhotos!: () => void;
  const photosCanRespond = new Promise<void>((resolve) => {
    releasePhotos = resolve;
  });
  await page.route("**/storage/v1/object/sign/visit-photos", async (route) => {
    await photosCanRespond;
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  let releaseB!: () => void;
  let releaseLateA!: () => void;
  const bCanRespond = new Promise<void>((resolve) => {
    releaseB = resolve;
  });
  const lateACanRespond = new Promise<void>((resolve) => {
    releaseLateA = resolve;
  });
  const reads = new Map<string, number>();
  await page.route(`**/rest/v1/rpc/${CURRENT_GROUP_STATE_RPC}`, async (route) => {
    const id = route.request().postDataJSON()._group_id as string;
    const count = (reads.get(id) ?? 0) + 1;
    reads.set(id, count);
    if (id === otherGroupId && count === 1) await bCanRespond;
    if (id === groupId && count === 2) await lateACanRespond;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...appState,
        group: { ...appState.group, id, name: id === groupId ? "Grupp A" : "Grupp B" },
      }),
    });
  });

  await page.goto("/");

  const pendingGroupMenu = page.getByRole("button", { name: /^Profil och grupp:/ });
  // Självhostad CI kan behöva längre än Playwrights standardtimeout för auth-initiering.
  await expect(pendingGroupMenu).toBeVisible({ timeout: 20_000 });
  await expect(pendingGroupMenu).toHaveAccessibleName("Profil och grupp: Grupp");
  await expect(page.getByText("Något gick snett")).toHaveCount(0);

  await expect(page.getByText("Skapa er första grupp")).toHaveCount(0);
  expect(groupListCalls).toBe(1);
  releaseGroups?.();

  await expect(page.getByRole("button", { name: "Profil och grupp: Grupp A" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Börja med ett ställe" })).toBeVisible();
  await expect(page.getByText("Något gick snett")).toHaveCount(0);
  await expect(page.getByText("Hämtar gruppens data…")).toHaveCount(0);
  expect(groupListCalls).toBe(1);
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);

  await page.getByRole("button", { name: "Profil och grupp: Grupp A" }).click();
  await page.getByRole("menuitem", { name: /Grupp B/ }).click();
  await expect(page.getByText("Hämtar gruppens data…")).toBeVisible();
  releaseB();
  await expect(page.getByRole("heading", { name: "Börja med ett ställe" })).toBeVisible();

  await page.getByRole("button", { name: "Profil och grupp: Grupp B" }).click();
  await page.getByRole("menuitem", { name: /Grupp A/ }).click();
  // A:s nya RPC är avsiktligt blockerad: tidigare bekräftat innehåll ska ändå synas.
  await expect.poll(() => reads.get(groupId)).toBe(2);
  await expect(page.getByRole("heading", { name: "Börja med ett ställe" })).toBeVisible();
  await expect(page.getByText("Hämtar gruppens data…")).toHaveCount(0);

  await page.getByRole("button", { name: "Profil och grupp: Grupp A" }).click();
  await page.getByRole("menuitem", { name: /Grupp B/ }).click();
  releaseLateA();
  releasePhotos();
  await expect.poll(() => reads.get(otherGroupId)).toBe(2);
  await expect(page.getByRole("button", { name: "Profil och grupp: Grupp B" })).toBeVisible();
  await expect(page.getByText("Hämtar gruppens data…")).toHaveCount(0);
});
