import { appendFileSync } from "node:fs";
const key = process.env.STAGING_GEOAPIFY_API_KEY;
if (!key) throw new Error("Missing staging provider secret");
const scenarios = [
  { label: "Pelikan name only + proximity", name: "Pelikan" },
  { label: "Falloumi name only + proximity", name: "Falloumi" },
  { label: "Pelikan text only + proximity", text: "Pelikan" },
  { label: "Falloumi text only + proximity", text: "Falloumi" },
  { label: "Pelikan text with city + proximity", text: "Pelikan Stockholm" },
  { label: "Falloumi text with city + proximity", text: "Falloumi Stockholm" },
];
const rows = [];
for (const item of scenarios) {
  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  if (item.name) url.searchParams.set("name", item.name);
  if (item.text) url.searchParams.set("text", item.text);
  url.searchParams.set("bias", "proximity:18.0710935,59.3251172");
  url.searchParams.set("type", "amenity");
  url.searchParams.set("lang", "sv");
  url.searchParams.set("format", "geojson");
  url.searchParams.set("limit", "10");
  url.searchParams.set("apiKey", key);
  const start = performance.now();
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  const elapsedMs = Math.round(performance.now() - start);
  if (!response.ok) throw new Error("Geoapify rejected a diagnostic request with HTTP " + response.status);
  const body = await response.json();
  const features = Array.isArray(body.features) ? body.features : [];
  const matches = features.map(f => f.properties ?? {}).filter(p =>
    String(p.name ?? "").toLocaleLowerCase("sv-SE") ===
    (item.label.startsWith("Pelikan") ? "pelikan" : "falloumi")
  ).map(p => [Number(p.lat).toFixed(4), Number(p.lon).toFixed(4)].join(","));
  rows.push({ label:item.label, count:features.length, matches:matches.length, ms:elapsedMs });
  console.log(JSON.stringify(rows.at(-1)));
}
const summary = ["## Geoapify name-hint comparison","",
"| Scenario | Returned | Exact matches | Provider ms |","|---|---:|---:|---:|",
...rows.map(r=>"| "+r.label+" | "+r.count+" | "+r.matches+" | "+r.ms+" |"),
"","6 read-only staging API requests; no raw provider identity or secret logged."].join("\n");
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary+"\n");
