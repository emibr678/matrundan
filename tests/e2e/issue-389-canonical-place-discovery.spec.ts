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
  address: "Skolvägen 3, Stockholm",
  city: "Stockholm",
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
    providerOnly?: boolean;
    internalOnly?: boolean;
    archived?: boolean;
    active?: boolean;
    finalProvider?: "hit" | "none" | "error";
    internalManual?: boolean;
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
            : name === "find_reusable_manual_place_candidates_v2" && options.internalManual
              ? [
                  {
                    ...canonical,
                    name: "Espresso House",
                    address: "Stationsgatan 2",
                    lat: 59.0105,
                    matchKind: "exact",
                    distanceKm: 0.007,
                  },
                ]
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
    const projectedCanonical = {
      ...canonical,
      groupStatus: options.archived
        ? "archived"
        : options.active
          ? "active"
          : canonical.groupStatus,
    };
    if (name.startsWith("searchPlaceDiscovery"))
      reply = {
        results: [
          {
            ...projectedCanonical,
            kind: "canonical",
            canonical: projectedCanonical,
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
        ]
          .filter((row) =>
            options.providerOnly
              ? row.kind === "provider"
              : options.internalOnly
                ? row.kind === "canonical"
                : true,
          )
          .map((row) =>
            options.providerOnly && row.kind === "provider"
              ? {
                  ...row,
                  identity: { ...provider.identity, candidates: [], reviewRequired: false },
                }
              : row,
          ),
        failedAreaLabels: [],
        canonicalIncomplete: false,
        canConfirm: !options.member,
        hasMore: false,
        nextOffset: 20,
        areaOffsets: { "area-1": 20 },
        exhaustedAreaIds: ["area-1"],
        failedAreaIds: [],
        budgetUsage: { requests: 1, reservedCredits: 1, limited: false },
        observation: { requests: 1, failures: 0, providerFeatures: 2, providerMs: 1, elapsedMs: 1 },
      };
    if (name.startsWith("findNearbyPlacesForManualFallback")) {
      if (options.finalProvider === "error") {
        await route.abort("failed");
        return;
      }
      reply =
        options.finalProvider === "hit"
          ? [
              {
                ...provider,
                name: "Espresso House",
                address: "Stationsgatan 2",
                lat: 59.0105,
                identity: undefined,
              },
            ]
          : [];
    }
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

test("entydig träff visas en gång och admin bekräftar via vanligt tillägg", async ({
  page,
}, info) => {
  const mocked = await setup(page);
  await page.goto("/matstallen");
  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Lägg till matställe" });
  await search.getByRole("combobox", { name: "Sök matställen", exact: true }).fill("Astrom");
  const internalOption = search.getByRole("option").filter({ hasText: canonical.name });
  const internalGroup = search.getByRole("group", { name: "Finns i Matrundan", exact: true });
  await expect(internalGroup.getByText("Finns i Matrundan", { exact: true })).toHaveCount(1);
  await expect(internalGroup.locator('[data-matrundan-brand="mark"]')).toBeVisible();
  await expect(internalOption).toContainText("Skolvägen 3, Stockholm");
  await expect(internalOption).not.toContainText("Skolvägen 3, Stockholm · Stockholm");
  await expect(internalOption.getByText("Finns i Matrundan", { exact: true })).toHaveCount(0);
  const suggestionList = search.getByRole("listbox", {
    name: "Förslag på kök, typer och matställen",
    exact: true,
  });
  await expect(
    suggestionList.getByText("Hittar du inte rätt ställe?", { exact: true }),
  ).toHaveCount(0);
  await search.getByRole("combobox", { name: "Sök matställen", exact: true }).press("Escape");
  const row = search.getByRole("button", {
    name: `Visa information om ${canonical.name}`,
    exact: true,
  });
  await expect(row).toHaveCount(1);
  const resultHeading = search.getByRole("heading", { name: "Finns i Matrundan", exact: true });
  await expect(resultHeading).toBeVisible();
  await expect(resultHeading.locator('[data-matrundan-brand="mark"]')).toBeVisible();
  await expect(row.getByText("Finns i Matrundan", { exact: true })).toHaveCount(0);
  await expect(search.getByRole("button", { name: "Granska matchning", exact: true })).toHaveCount(
    0,
  );
  await row.click();
  const add = page.getByRole("dialog", { name: "Lägg till i gruppen", exact: true });
  await expect(search.getByRole("button", { name: "Återställ", exact: true })).toHaveCount(0);
  await expect(add.getByText("Finns i Matrundan", { exact: true })).toBeVisible();
  await expect(add.locator('[data-matrundan-brand="mark"]')).toBeVisible();
  await expect(add.getByText("Skolvägen 3, Stockholm", { exact: true })).toBeVisible();
  await expect(add).not.toContainText("Skolvägen 3, Stockholm · Stockholm");
  await expect(add.getByText(/bekräftas också att kartträffen hör hit/)).toBeVisible();
  await noOverflow(page);
  await expect(add).toHaveCSS("opacity", "1");
  await page.screenshot({ path: `visual-review/issue-389-canonical-${info.project.name}.png` });
  await add.getByRole("button", { name: "Tillbaka", exact: true }).click();
  await expect(search.getByRole("combobox", { name: "Sök matställen", exact: true })).toHaveValue(
    "Astrom",
  );
  await row.click();
  await add.getByRole("button", { name: "Lägg till i gruppen", exact: true }).click();
  await expect(add).toBeHidden();
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
});

test("arkiverad relation i målgruppen visas som återställning", async ({ page }) => {
  await setup(page, { archived: true, internalOnly: true });
  await page.goto("/matstallen");
  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Lägg till matställe" });
  await search.getByRole("combobox", { name: "Sök matställen", exact: true }).fill("Astrom");
  await search.getByRole("combobox", { name: "Sök matställen", exact: true }).press("Escape");
  await search.getByRole("button", { name: "Återställ", exact: true }).click();
  const restore = page.getByRole("dialog", { name: "Återställ i gruppen", exact: true });
  await expect(
    restore.getByRole("button", { name: "Återställ i gruppen", exact: true }),
  ).toBeVisible();
  await expect(restore.getByText("Skolvägen 3, Stockholm", { exact: true })).toBeVisible();
});

test("befintligt ställe visas bara som redan i gruppen", async ({ page }) => {
  await setup(page, { active: true, internalOnly: true });
  await page.goto("/matstallen");
  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Lägg till matställe" });
  const query = search.getByRole("combobox", { name: "Sök matställen", exact: true });
  await query.fill("Astrom");

  // Focused mobile search can show existing places as navigation suggestions,
  // but they must never be offered as a new group addition.
  const suggestions = search.getByRole("listbox", {
    name: "Förslag på kök, typer och matställen",
    exact: true,
  });
  await expect(suggestions).toBeVisible();
  await expect(
    suggestions.getByRole("group", { name: "Finns i Matrundan", exact: true }),
  ).toBeVisible();
  await search.getByRole("button", { name: "Tillbaka till resultaten" }).click();
  await expect(suggestions).toHaveCount(0);
  await expect(
    search.getByRole("button", { name: "Redan i gruppen (1)", exact: true }),
  ).toBeVisible();

  await query.press("Escape");
  await expect(search.getByText("Visar 0 träffar", { exact: true })).toHaveCount(0);
  await expect(search.getByText("Ställen att lägga till", { exact: true })).toHaveCount(0);
  await expect(
    search.getByText("Inga nya ställen i den här sökningen.", { exact: true }),
  ).toHaveCount(0);
  await noOverflow(page);
});

test("medlem återanvänder entydigt ställe i normalflödet utan global koppling", async ({
  page,
}) => {
  const mocked = await setup(page, { member: true });
  await page.goto("/matstallen");
  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Lägg till matställe" });
  await search.getByRole("combobox", { name: "Sök matställen", exact: true }).fill("Astrom");
  await search.getByRole("combobox", { name: "Sök matställen", exact: true }).press("Escape");
  await search
    .getByRole("button", { name: `Visa information om ${canonical.name}`, exact: true })
    .click();
  const add = page.getByRole("dialog", { name: "Lägg till i gruppen", exact: true });
  await expect(add.getByText(/bekräftas också/)).toHaveCount(0);
  await add.getByRole("button", { name: "Lägg till i gruppen", exact: true }).click();
  await expect(add).toBeHidden();
  expect(mocked.confirmations).toEqual([]);
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
    review.getByRole("button", { name: "Ja, använd stället som redan finns", exact: true }),
  ).toBeDisabled();
  await expect(
    review.getByRole("button", {
      name: "Nej, det är ett annat ställe",
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
      .getByRole("button", {
        name: scenario === "stale" ? "Lägg till" : "Granska matchning",
        exact: true,
      })
      .filter({ visible: true })
      .click();
    const review = page.getByRole("dialog", { name: "Är det samma ställe?", exact: true });
    if (scenario === "stale") {
      await page
        .getByRole("dialog", { name: "Lägg till i gruppen", exact: true })
        .getByRole("button", { name: "Lägg till i gruppen", exact: true })
        .click();
      await expect(review.getByText("Åströms annex", { exact: true })).toBeVisible();
    }

    await review.getByRole("radio", { name: `Välj ${canonical.name}`, exact: true }).click();
    if (scenario === "competing") {
      await review
        .getByRole("radio", { name: `Välj ${canonical.name}`, exact: true })
        .press("ArrowDown");
      await expect(
        review.getByRole("radio", { name: "Välj Åströms annex", exact: true }),
      ).toBeChecked();
      await review.getByRole("radio", { name: "Välj Åströms annex", exact: true }).press("ArrowUp");
      await expect(
        review.getByRole("radio", { name: `Välj ${canonical.name}`, exact: true }),
      ).toBeChecked();
    }
    await expect(
      review.getByText("Stället används utan att kartkällan kopplas.", { exact: true }).first(),
    ).toBeVisible();
    await expect(review).toHaveCSS("opacity", "1");
    await noOverflow(page);
    await page.screenshot({ path: `visual-review/issue-389-${scenario}-${info.project.name}.png` });
    await review
      .getByRole("button", { name: "Ja, använd stället som redan finns", exact: true })
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

for (const kind of ["provider", "internal"] as const) {
  test(`${kind}: neutral sökträff utan historiskt besök fungerar ensam`, async ({ page }, info) => {
    await setup(page, { providerOnly: kind === "provider", internalOnly: kind === "internal" });
    await page.goto("/matstallen");
    await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
    const search = page.getByRole("dialog", { name: "Lägg till matställe" });
    await search.getByRole("combobox", { name: "Sök matställen", exact: true }).fill("Astrom");
    if (kind === "internal")
      await expect(
        search.getByRole("group", { name: "Finns i Matrundan", exact: true }),
      ).toBeVisible();
    await search.getByRole("combobox", { name: "Sök matställen", exact: true }).press("Escape");
    await expect(search.getByRole("button", { name: "Lägg till", exact: true })).toHaveCount(1);
    await expect(search).not.toContainText(/SECRET|besök i andra|antal grupper|skapad av/);
    await noOverflow(page);
    await page.screenshot({
      path: `visual-review/issue-389-${kind}-search-${info.project.name}.png`,
    });
  });
}

for (const outcome of ["hit", "none", "error", "internal"] as const) {
  test(`manuell sista kartkontroll: ${outcome} behåller ett säkert alternativ`, async ({
    page,
  }, info) => {
    const mocked = await setup(page, {
      manual: true,
      finalProvider: outcome === "internal" ? "hit" : outcome,
      internalManual: outcome === "internal",
    });
    await page.goto("/matstallen");
    await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
    await page
      .getByRole("button", { name: "Lägg till ett ställe som saknas", exact: true })
      .click();
    const manual = page.getByRole("dialog", { name: "Stället saknas i sökningen", exact: true });
    await page.locator("#manual-name").fill("Espresso House");
    await page.locator("#manual-location").fill("Stationsgatan 2");
    await page
      .getByRole("option")
      .filter({ hasText: "Stationsgatan 2" })
      .getByRole("button")
      .click();
    await manual.getByRole("button", { name: "Lägg till i gruppen", exact: true }).click();
    if (outcome === "hit" || outcome === "internal") {
      await expect(
        manual.getByText("Hittat nära adressen i kartan", { exact: true }),
      ).toBeVisible();
      expect(mocked.manualRequests).toHaveLength(0);
      await noOverflow(page);
      await page.screenshot({
        path: `visual-review/issue-389-manual-provider-${info.project.name}.png`,
      });
      await manual.getByRole("button", { name: "Använd det här stället", exact: true }).click();
      const add = page.getByRole("dialog", { name: "Lägg till i gruppen", exact: true });
      await add.getByRole("button", { name: "Tillbaka", exact: true }).click();
      await expect(page.locator("#manual-name")).toHaveValue("Espresso House");
      await expect(page.locator("#manual-location")).toHaveValue("Stationsgatan 2");
    } else {
      await expect(manual).toBeHidden();
      expect(mocked.manualRequests).toHaveLength(1);
    }
  });
}

test("kartpunkt väljer bottenkort innan explicit tillägg öppnar dialog", async ({ page }, info) => {
  await setup(page, { providerOnly: true });
  await page.goto("/matstallen");
  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Lägg till matställe" });
  await search.getByRole("combobox", { name: "Sök matställen", exact: true }).fill("Astrom");
  await search.getByRole("combobox", { name: "Sök matställen", exact: true }).press("Escape");
  const toggle = search.getByRole("button", { name: "Karta", exact: true });
  if ((page.viewportSize()?.width ?? 360) < 1024) await toggle.click();
  const map = search.getByRole("region", {
    name: "Karta över sökresultat och valda sökområden",
    exact: true,
  });
  await expect(map).toHaveAttribute("data-map-ready", "true");
  await expect(map.getByRole("button", { name: "Lägg till", exact: true })).toHaveCount(0);
  const canvas = map.locator("canvas");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Kartan saknar canvas");
  await canvas.click({ position: { x: bounds.width / 2, y: bounds.height / 2 - 12 } });
  await expect(page.getByRole("dialog", { name: "Lägg till i gruppen", exact: true })).toHaveCount(
    0,
  );
  const action = map.getByRole("button", { name: "Lägg till", exact: true });
  await expect(action).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: `visual-review/issue-389-map-selected-${info.project.name}.png` });
  await action.click();
  await expect(
    page.getByRole("dialog", { name: "Lägg till i gruppen", exact: true }),
  ).toBeVisible();
});

test("demo använder samma lugna söksemantik utan externa skrivningar", async ({ page }, info) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/rest\/v1\/|\/_serverFn\//.test(request.url()))
      writes.push(request.url());
  });
  await page.goto("/matstallen?demo=1");
  await page.getByRole("button", { name: "Lägg till ställe", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Lägg till matställe" });
  await search
    .getByRole("combobox", { name: "Sök matställen", exact: true })
    .fill("Månbackens Matrum");
  await search.getByRole("combobox", { name: "Sök matställen", exact: true }).press("Escape");
  await expect(
    search.getByRole("heading", { name: "Finns i Matrundan", exact: true }),
  ).toBeVisible();
  await expect(
    search.getByRole("button", { name: "Visa information om Månbackens Matrum", exact: true }),
  ).toHaveCount(1);
  await search
    .getByRole("button", { name: "Lägg till", exact: true })
    .filter({ visible: true })
    .click();
  const add = page.getByRole("dialog", { name: "Lägg till i gruppen", exact: true });
  await expect(add.getByText("Månbacken 106 · Göteborg", { exact: true })).toBeVisible();
  await expect(add).toHaveCSS("opacity", "1");
  await noOverflow(page);
  await page.screenshot({ path: `visual-review/issue-389-demo-${info.project.name}.png` });
  await add.getByRole("button", { name: "Lägg till i gruppen", exact: true }).click();
  await expect(add).toBeHidden();
  expect(writes).toEqual([]);
});
