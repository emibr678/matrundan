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
    candidates: [{ ...canonical, matchKind: "strong", distanceKm: 0.01, canConfirmSource: true }],
    reviewRequired: true,
    identityConflict: false,
  },
};

async function setup(
  page: Page,
  options: {
    member?: boolean;
    conflict?: boolean;
    competitor?: boolean;
    unconfirmed?: boolean;
    stale?: boolean;
    manual?: boolean;
  } = {},
) {
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
  const manualRequests: unknown[] = [];
  const ambiguousCandidates = [
    { ...provider.identity.candidates[0], canConfirmSource: false },
    {
      ...provider.identity.candidates[0],
      placeId: "38920000-0000-4000-8000-000000000002",
      name: "Åströms annex",
      address: "",
      matchKind: "possible",
      distanceKm: 0.08,
      canConfirmSource: false,
    },
  ];
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
    places: [
      ...(options.manual
        ? [
            {
              id: "38920000-0000-4000-8000-000000000010",
              name: "Espresso House",
              category: "café",
              cuisines: [],
              occasions: [],
              address: "Stationsgatan 1",
              city: "Teststad",
              lat: 59.01,
              lng: 18,
              addedBy: actor,
              addedAt: now,
              collectionStatus: "active",
              origin: "provider",
              sources: [{ provider: "geoapify", providerPlaceId: "known-chain", status: "active" }],
            },
          ]
        : []),
      ...(saved
        ? [
            {
              id: placeId,
              name: options.manual ? "Espresso House" : canonical.name,
              category: "café",
              cuisines: ["Svenskt"],
              occasions: [],
              address: options.manual ? "Stationsgatan 2" : canonical.address,
              city: canonical.city,
              lat: options.manual ? 59.0105 : 59,
              lng: 18,
              addedBy: actor,
              addedAt: now,
              collectionStatus: "active",
              origin: "manual",
              sources: [],
            },
          ]
        : []),
    ],
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
            : name === "create_manual_place_fallback_v2"
              ? (manualRequests.push(JSON.parse(route.request().postData()!)),
                (saved = true),
                { placeId, improvementCandidate: true })
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
          {
            ...provider,
            identity: {
              ...provider.identity,
              identityConflict: !!options.conflict,
              candidates: options.competitor
                ? ambiguousCandidates
                : options.unconfirmed
                  ? [ambiguousCandidates[0]]
                  : provider.identity.candidates,
            },
          },
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
      saved = !options.stale;
      reply = options.stale
        ? {
            status: "review_required",
            candidates: ambiguousCandidates,
            providerVersion: "c".repeat(32),
            provider,
          }
        : { status: "linked", placeId };
    }
    if (name.startsWith("geoapifyAutocompleteLocation"))
      reply = [
        {
          label: "Stationsgatan 2",
          primaryLabel: "Stationsgatan 2",
          secondaryLabel: "Teststad",
          placeId: "verified-address-2",
          lat: 59.0105,
          lng: 18,
          city: "Teststad",
          resultType: "building",
        },
      ];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result: reply, context: {} }),
    });
  });
  return { confirmations, manualRequests };
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

for (const scenario of ["competing", "hidden", "stale"] as const) {
  test(`${scenario}: admin återanvänder utan att koppla en osäker kartkälla`, async ({
    page,
  }, info) => {
    const mocked = await setup(page, {
      competitor: scenario === "competing",
      unconfirmed: scenario === "hidden",
      stale: scenario === "stale",
    });
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
    if (scenario === "stale") {
      await review.getByRole("button", { name: "Bekräfta samma ställe", exact: true }).click();
      await expect(review.getByText("Åströms annex", { exact: true })).toBeVisible();
    }
    await expect(
      review.getByRole("button", { name: "Bekräfta samma ställe", exact: true }),
    ).toHaveCount(0);
    await expect(
      review.getByText("Stället används utan att kartkällan kopplas.", { exact: true }).first(),
    ).toBeVisible();
    await expect(review).toHaveCSS("opacity", "1");
    await noOverflow(page);
    await page.screenshot({ path: `visual-review/issue-389-${scenario}-${info.project.name}.png` });
    await review
      .getByRole("button", { name: "Använd befintligt ställe", exact: true })
      .first()
      .click();
    await expect(review).toBeHidden();
    expect(mocked.confirmations).toHaveLength(scenario === "stale" ? 1 : 0);
    await search.getByRole("button", { name: "Klar", exact: true }).click();
    await expect(page.getByRole("link", { name: new RegExp(canonical.name) })).toHaveAttribute(
      "href",
      `/matstallen/${placeId}`,
    );
  });
}

test("manuell kedjefilial behåller annan adress nära ett kartställe", async ({ page }) => {
  const mocked = await setup(page, { manual: true });
  await page.goto("/matstallen");
  await expect(
    page.locator('a[href="/matstallen/38920000-0000-4000-8000-000000000010"]'),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Lägg till matställe" });
  await search
    .getByRole("button", { name: "Lägg till ett ställe som saknas", exact: true })
    .click();
  await page.locator("#manual-name").fill("Espresso House");
  await page.locator("#manual-location").fill("Stationsgatan 2");
  await page.getByRole("option").filter({ hasText: "Stationsgatan 2" }).getByRole("button").click();
  await page.getByRole("button", { name: "Lägg till i gruppen", exact: true }).click();
  await expect(search).toBeHidden();
  expect(mocked.manualRequests).toEqual([
    expect.objectContaining({
      _data: expect.objectContaining({
        name: "Espresso House",
        address: "Stationsgatan 2",
        city: "Teststad",
        lat: 59.0105,
        lng: 18,
      }),
    }),
  ]);
  await expect(page.locator(`a[href="/matstallen/${placeId}"]`)).toHaveAttribute(
    "aria-label",
    "Espresso House",
  );
  await expect(
    page.locator('a[href="/matstallen/38920000-0000-4000-8000-000000000010"]'),
  ).toBeVisible();
});
