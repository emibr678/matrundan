import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();

// Nitro's cloudflare-module preset used to generate a Wrangler redirect here.
// With source-controlled Wrangler environments that redirect is invalid, and a
// restored Cloudflare build cache must not be allowed to resurrect it.
await rm(resolve(root, ".wrangler/deploy"), { recursive: true, force: true });
await rm(resolve(root, ".output/server/wrangler.json"), { force: true });

// Cloudflare Builds handles PR branches separately from GitHub's Stage deploy.
// Runtime bindings cannot supply values already compiled into the browser bundle.
if (process.env.WORKERS_CI === "1" && !process.env.VITE_GEOAPIFY_MAPS_KEY?.trim()) {
  throw new Error(
    "PR-preview saknar VITE_GEOAPIFY_MAPS_KEY i Cloudflare Builds build variables. Ange den browser-begränsade Staging-kartnyckeln innan previewen byggs.",
  );
}
