import { expect, test, type Page } from "@playwright/test";
import { fromJSON } from "seroval";
import {
  CURRENT_GROUP_STATE_RPC,
  PREVIOUS_GROUP_STATE_RPC,
} from "../../src/lib/matrundan/read-model-version";

const actor = "38900000-0000-4000-8000-000000000001";
const group = "38910000-0000-4000-8000-000000000001";
const placeId = "38920000-0000-4000-8000-000000000001";
const canonical = {
  placeId,
  name: "Åströms mycket långa namn på ett litet kvarterscafé",
  category: "café",
  cuisines: ["Svenskt"],
  address: "Testgatan 1",
  city: "Teststad",
  area: null,
  lat: 59,
  lng: 18,
  groupStatus: "not_linked",
  version: "a".repeat(32),
};
const provider = {
  kind: "provider",
  resultKey: "provider:geoapify:389-map",
  externalId: "389-map",
  provider: "geoapify",
  name: "Astroms mycket langa namn pa ett litet kvarterscafe",
  category: "café",
  cuisines: ["Svenskt"],
  address: "Testgatan 1",
  city: "Teststad",
  lat: 59,
  lng: 18,
  identity: {
    providerPlaceId: "389-map",
    providerVersion: "b".repeat(32),
    knownPlace: null,
    candidates: [{ ...canonical, matchKind: "strong", distanceKm: 0.01 }],
    reviewRequired: true,
    identityConflict: false,
  },
};

async function setup(page: Page, options: { member?: boolean; conflict?: boolean } = {}) {
  const now = new Date().toISOString(),
    expires = Math.floor(Date.now() / 1000) + 3600;
  await page.addInitScript(
    ({ actor, now, expires }) => {
      localStorage.setItem(
        "sb-127-auth-token",
        JSON.stringify({
          access_token: `test.${btoa(JSON.stringify({ sub: actor, aud: "authenticated", role: "authenticated", exp: expires }))}.signature`,
          refresh_token: "fixture",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: expires,
          user: {
            id: actor,
            aud: "authenticated",
            role: "authenticated",
            email: "fixture@example.invalid",
            email_confirmed_at: now,
            created_at: now,
            updated_at: now,
            app_metadata: { provider: "google", providers: ["google"] },
            user_metadata: { full_name: "Testaren" },
            identities: [],
            is_anonymous: false,
          },
        }),
      );
    },
    { actor, now, expires },
  );
  let saved = false;
  const confirmations: unknown[] = [];
  const appState = () => ({
    currentUserId: actor,
    group: {
      id: group,
      name: "Testgruppen",
      emoji: "🍽️",
      city: "Teststad",
      createdAt: now,
      ownerId: actor,
      lifecycleStatus: "active",
      sharedVisitsCountForProgression: true,
      defaultSearchRadiusKm: 1,
      searchAreas: [
        {
          id: "area-1",
          label: "Teststad",
          lat: 59,
          lng: 18,
          provider: "geoapify",
          placeId: "area-provider",
          searchMode: "point",
        },
      ],
      homeLocation: null,
    },
    members: [
      { id: actor, name: "Testaren", avatar: "🙂", role: options.member ? "medlem" : "ägare" },
    ],
    places: saved
      ? [
          {
            id: placeId,
            name: canonical.name,
            category: "café",
            cuisines: ["Svenskt"],
            occasions: [],
            address: canonical.address,
            city: canonical.city,
            lat: 59,
            lng: 18,
            addedBy: actor,
            addedAt: now,
            collectionStatus: "active",
            origin: "manual",
            sources: [],
          },
        ]
      : [],
    visits: [],
    favorites: [],
    activity: [],
    nextPlaceId: null,
    nextStopDateProposal: null,
  });
  await page.route("**/rest/v1/user_guidance_state*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route("**/rest/v1/rpc/*", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1);
    const body =
      name === "list_user_groups_v4b"
        ? [
            {
              id: group,
              name: "Testgruppen",
              emoji: "🍽️",
              role: options.member ? "member" : "owner",
              lifecycleStatus: "active",
            },
          ]
        : [CURRENT_GROUP_STATE_RPC, PREVIOUS_GROUP_STATE_RPC].includes(name!)
          ? appState()
          : name === "link_canonical_place_to_group_v1"
            ? ((saved = true), { status: "linked", placeId })
            : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.route("**/_serverFn/*", async (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-1)!;
    let name = "";
    try {
      name = JSON.parse(Buffer.from(id, "base64url").toString()).export;
    } catch {
      await route.continue();
      return;
    }
    let reply: unknown = [];
    if (name.startsWith("searchPlaceDiscovery"))
      reply = {
        results: [
          {
            ...canonical,
            kind: "canonical",
            canonical,
            resultKey: `canonical:${placeId}`,
            externalId: `canonical:${placeId}`,
          },
          { ...provider, identity: { ...provider.identity, identityConflict: !!options.conflict } },
        ],
        failedAreaLabels: [],
        canonicalIncomplete: false,
        canConfirm: !options.member,
        hasMore: false,
        nextOffset: 20,
      };
    if (name.startsWith("resolveProviderPlace")) {
      const payload = fromJSON(JSON.parse(route.request().postData()!)) as { data: unknown };
      confirmations.push(payload.data);
      saved = true;
      reply = { status: "linked", placeId };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result: reply, context: {} }),
    });
  });
  return { confirmations };
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(1);
}

test("kanoniskt ställe och källgranskning använder samma plats med begriplig återgång", async ({
  page,
}, info) => {
  const mocked = await setup(page);
  await page.goto("/matstallen");
  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Lägg till matställe" });
  await search.getByRole("combobox", { name: "Sök matställen", exact: true }).fill("Astrom");
  await expect(
    search
      .getByRole("button", { name: `Visa information om ${canonical.name}`, exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await search.getByRole("combobox", { name: "Sök matställen", exact: true }).press("Escape");
  await search
    .getByRole("button", { name: `Visa information om ${canonical.name}`, exact: true })
    .filter({ visible: true })
    .click();
  const add = page.getByRole("dialog", { name: "Lägg till i gruppen", exact: true });
  await expect(add.getByText("Matrundan-ställe", { exact: true })).toBeVisible();
  await expect(add).toHaveCSS("opacity", "1");
  await noOverflow(page);
  await page.screenshot({ path: `visual-review/issue-389-canonical-${info.project.name}.png` });
  await add.getByRole("button", { name: "Tillbaka", exact: true }).click();
  await expect(search.getByRole("combobox", { name: "Sök matställen", exact: true })).toHaveValue(
    "Astrom",
  );
  await search
    .getByRole("button", { name: "Granska matchning", exact: true })
    .filter({ visible: true })
    .click();
  const review = page.getByRole("dialog", { name: "Är det samma ställe?", exact: true });
  await expect(review.getByText(/Besök och gruppuppgifter ligger kvar/)).toBeVisible();
  await expect(
    review.getByRole("button", { name: "Bekräfta samma ställe", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await expect(review).toHaveCSS("opacity", "1");
  await page.screenshot({ path: `visual-review/issue-389-review-${info.project.name}.png` });
  await review.getByRole("button", { name: "Bekräfta samma ställe", exact: true }).click();
  await expect(review).toBeHidden();
  expect(mocked.confirmations).toEqual([
    expect.objectContaining({
      groupId: group,
      providerPlaceId: "389-map",
      choice: "link",
      placeId,
      providerVersion: "b".repeat(32),
      decisions: [{ placeId, version: "a".repeat(32) }],
    }),
  ]);
  await expect(search.getByText("1 ställe hanterat i den här omgången")).toBeVisible();
  await search.getByRole("button", { name: "Klar", exact: true }).click();
  await expect(page.getByRole("link", { name: new RegExp(canonical.name) })).toHaveAttribute(
    "href",
    `/matstallen/${placeId}`,
  );
});

test("medlem använder det befintliga stället utan att ändra dess kartidentitet", async ({
  page,
}) => {
  const mocked = await setup(page, { member: true });
  await page.goto("/matstallen");
  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Lägg till matställe" });
  await search.getByRole("combobox", { name: "Sök matställen", exact: true }).fill("Astrom");
  await search.getByRole("combobox", { name: "Sök matställen", exact: true }).press("Escape");
  await search
    .getByRole("button", { name: "Granska matchning", exact: true })
    .filter({ visible: true })
    .click();
  const review = page.getByRole("dialog", { name: "Är det samma ställe?", exact: true });
  await expect(
    review.getByRole("button", { name: "Bekräfta samma ställe", exact: true }),
  ).toHaveCount(0);
  await expect(
    review.getByText("Stället används direkt. Gruppens admin kan bekräfta kartkällan senare."),
  ).toBeVisible();
  await review.getByRole("button", { name: "Använd befintligt ställe", exact: true }).click();
  await expect(review).toBeHidden();
  expect(mocked.confirmations).toEqual([]);
  await search.getByRole("button", { name: "Klar", exact: true }).click();
  await expect(page.getByRole("link", { name: new RegExp(canonical.name) })).toHaveAttribute(
    "href",
    `/matstallen/${placeId}`,
  );
});

test("motstridiga kartidentiteter stoppar både koppling och nytt skapande", async ({ page }) => {
  const mocked = await setup(page, { conflict: true });
  await page.goto("/matstallen");
  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Lägg till matställe" });
  await search.getByRole("combobox", { name: "Sök matställen", exact: true }).fill("Astrom");
  await search.getByRole("combobox", { name: "Sök matställen", exact: true }).press("Escape");
  await search
    .getByRole("button", { name: "Granska matchning", exact: true })
    .filter({ visible: true })
    .click();
  const review = page.getByRole("dialog", { name: "Är det samma ställe?", exact: true });
  await expect(review.getByRole("alert")).toHaveText(
    "Kartkällorna pekar på olika ställen. Ingen ändring kan sparas här.",
  );
  await expect(
    review.getByRole("button", { name: "Bekräfta samma ställe", exact: true }),
  ).toBeDisabled();
  await expect(
    review.getByRole("button", {
      name: "Inget av dessa – lägg till ett separat ställe",
      exact: true,
    }),
  ).toBeDisabled();
  await review.getByRole("button", { name: "Tillbaka", exact: true }).click();
  await expect(search.getByRole("combobox", { name: "Sök matställen", exact: true })).toHaveValue(
    "Astrom",
  );
  expect(mocked.confirmations).toEqual([]);
});
