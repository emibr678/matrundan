import { expect, test } from "@playwright/test";

test("manual diagnostic: no background calls, explicit success gate, exact identities and bounded results", async ({
  page,
}) => {
  const calls: string[] = [];
  await page.route("https://overpass.private.coffee/**", async (route) => {
    calls.push(route.request().postData() ?? "");
    await route.fulfill({
      json:
        calls.length === 1
          ? { version: 0.6, elements: [] }
          : {
              version: 0.6,
              osm3s: { timestamp_osm_base: "2026-10-27T00:00:00Z" },
              elements: [
                {
                  type: "way",
                  id: 123456789,
                  tags: {
                    name: "Testrestaurang med ett mycket långt namn för mobilgranskning",
                    cuisine: "pizza;pasta",
                    amenity: "restaurant",
                  },
                },
                { type: "count", tags: { total: "60" } },
              ],
            },
    });
  });
  await page.goto("/sokverifiering");
  await expect(page.getByRole("heading", { name: "Manuellt Overpass-prov" })).toBeVisible();
  await expect(page.getByText(/Den här branchen har äldre sökkod/)).toBeVisible();
  const search = page.getByRole("button", { name: "Sök Pasta i Stockholm" });
  await expect(search).toBeDisabled();
  expect(calls).toHaveLength(0);
  const control = page.getByRole("link", { name: "Öppna samma minimala fråga i ny flik" });
  expect(new URL((await control.getAttribute("href"))!).searchParams.get("data")).toBe(
    "[out:json][timeout:10][maxsize:16777216];node(1);out ids;",
  );
  await page.getByRole("button", { name: "Kör minimalt anrop" }).click();
  await expect(page.getByText("Anslutning verifierad på sidan.")).toBeVisible();
  await search.click();
  await expect(page.getByText("Visar 1 OSM-objekt av 60 matchande.")).toBeVisible();
  await expect(page.getByText(/Resultattaket är nått/)).toBeVisible();
  await expect(page.getByRole("link", { name: "way/123456789" })).toHaveAttribute(
    "href",
    "https://www.openstreetmap.org/way/123456789",
  );
  expect(calls).toHaveLength(2);
  expect(new URLSearchParams(calls[1]).get("data")).toContain(
    "(^|;)[[:space:]]*pasta[[:space:]]*(;|$)",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "visual-review/overpass-success.png", fullPage: true });
});

test("CORS/network failure leaves status unknown and gives no invented zero matches", async ({
  page,
}) => {
  let calls = 0;
  await page.route("https://overpass.private.coffee/**", async (route) => {
    calls++;
    await route.abort("failed");
  });
  await page.goto("/sokverifiering");
  await page.getByRole("button", { name: "Kör minimalt anrop" }).click();
  await expect(page.getByRole("status")).toContainText("CORS-/nätverksfel");
  await expect(page.getByText("Objektantal ej uppmätt.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sök Pasta i Stockholm" })).toBeDisabled();
  expect(calls).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "visual-review/overpass-network.png", fullPage: true });
});

test("explicit new-tab confirmation is separate from an automatically verified response", async ({
  page,
  context,
}) => {
  await context.route("https://overpass.private.coffee/**", (route) =>
    route.fulfill({ json: { version: 0.6, elements: [] } }),
  );
  await page.goto("/sokverifiering");
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Öppna samma minimala fråga i ny flik" }).click();
  const popup = await popupPromise;
  await expect(page.getByRole("button", { name: "Sök Pasta i Stockholm" })).toBeDisabled();
  await page.getByRole("button", { name: "Jag ser giltig OSM-JSON i den nya fliken" }).click();
  await expect(page.getByText(/Giltig JSON bekräftad av dig/)).toBeVisible();
  await page.getByLabel("Fast område").selectOption("varnamo");
  await page.getByLabel("Exakt cuisine-tagg").selectOption("falafel");
  await expect(page.getByRole("button", { name: "Sök Falafel i Värnamo" })).toBeEnabled();
  const url = new URL(
    (await page
      .getByRole("link", { name: "Öppna samma taggfråga i ny flik" })
      .getAttribute("href"))!,
  );
  expect(url.searchParams.get("data")).toContain("around:5000,57.186,14.041");
  await popup.close();
});

test("quota failure stops subsequent page requests", async ({ page }) => {
  let calls = 0;
  await page.route("https://overpass.private.coffee/**", async (route) => {
    calls++;
    await route.fulfill({ status: 429, body: "Too many requests" });
  });
  await page.goto("/sokverifiering");
  await page.getByRole("button", { name: "Kör minimalt anrop" }).click();
  await expect(page.getByRole("status")).toContainText("HTTP 429");
  await expect(page.getByRole("button", { name: "Kör minimalt anrop" })).toBeDisabled();
  expect(calls).toBe(1);
});

test("manual cancellation and timeout give distinct feedback without retries", async ({ page }) => {
  let calls = 0;
  await page.route("https://overpass.private.coffee/**", () => {
    calls++;
  });
  await page.goto("/sokverifiering");
  await expect(page.getByRole("button", { name: "Kör minimalt anrop" })).toBeEnabled();
  await page.clock.install();
  await page.getByRole("button", { name: "Kör minimalt anrop" }).click();
  await expect(page.getByRole("button", { name: "Kör minimalt anrop" })).toBeDisabled();
  await page.getByRole("button", { name: "Avbryt anrop" }).click();
  await expect(page.getByRole("status")).toContainText("Du avbröt anropet");
  await page.getByRole("button", { name: "Kör minimalt anrop" }).click();
  await page.clock.runFor(45_001);
  await expect(page.getByRole("status")).toContainText("Avbrutet efter 45 sekunder");
  expect(calls).toBe(2);
});
