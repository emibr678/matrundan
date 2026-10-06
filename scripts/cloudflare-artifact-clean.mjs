import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();

// Nitro's cloudflare-module preset used to generate a Wrangler redirect here.
// With source-controlled Wrangler environments that redirect is invalid, and a
// restored Cloudflare build cache must not be allowed to resurrect it.
await rm(resolve(root, ".wrangler/deploy"), { recursive: true, force: true });
await rm(resolve(root, ".output/server/wrangler.json"), { force: true });
