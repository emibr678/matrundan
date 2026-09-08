import { describe, expect, test } from "bun:test";

const settingsSource = await Bun.file(
  "src/components/matrundan/GroupSearchSettingsSection.tsx",
).text();

describe("sökområden i gruppinställningar", () => {
  test("återanvänder de gemensamma autocomplete- och sökområdesprimitiverna", () => {
    // Här är själva komponentåteranvändningen kontraktet: gruppinställningar och
    // sökflöde ska inte få parallella egna varianter av platsinput eller pills.
    expect(settingsSource).toContain("<GeoapifyLocationInput");
    expect(settingsSource).toContain("<SearchAreaPill");
  });
});
