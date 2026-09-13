import { describe, expect, test } from "bun:test";

type Manifest = {
  name: string;
  short_name: string;
  id: string;
  start_url: string;
  scope: string;
  icons: Array<{ src: string; sizes: string; purpose: string; type: string }>;
};

async function manifest(path: string): Promise<Manifest> {
  return Bun.file(path).json();
}

describe("stagingidentitet", () => {
  test("behåller produktionens namn och explicita befintliga appidentitet", async () => {
    const production = await manifest("public/manifest.webmanifest");
    expect(production.name).toBe("Matrundan");
    expect(production.short_name).toBe("Matrundan");
    expect(production.id).toBe("/");
    expect(production.start_url).toBe("/");
    expect(production.scope).toBe("/");
  });

  test("ger staging ett eget namn och märkta appikoner", async () => {
    const staging = await manifest("public/manifest-staging.webmanifest");
    expect(staging.name).toBe("Matrundan Staging");
    expect(staging.short_name).toBe("Matrundan STG");
    expect(staging.id).toBe("/");
    expect(staging.start_url).toBe("/");
    expect(staging.scope).toBe("/");
    expect(staging.icons).toEqual([
      {
        src: "/icons/matrundan-staging-192.png",
        sizes: "192x192",
        purpose: "any",
        type: "image/png",
      },
      {
        src: "/icons/matrundan-staging-512.png",
        sizes: "512x512",
        purpose: "any",
        type: "image/png",
      },
      {
        src: "/icons/matrundan-staging-maskable-512.png",
        sizes: "512x512",
        purpose: "maskable",
        type: "image/png",
      },
    ]);
  });

  test("stämplar driftsättningstid före det exakt SHA-bundna stagingbygget", async () => {
    const workflow = await Bun.file(".github/workflows/cloudflare-staging-deploy.yml").text();
    const stamp = workflow.indexOf("name: Stamp staging deployment");
    const build = workflow.indexOf("name: Build exact staging candidate");

    expect(stamp).toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(stamp);
    expect(workflow).toContain("MATRUNDAN_DEPLOYED_AT=$(date -u");
    expect(workflow).toContain("MATRUNDAN_ENVIRONMENT: staging");
  });
});
