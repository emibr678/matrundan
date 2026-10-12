import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { cloudflarePreviewMapGuard } from "./scripts/cloudflare-preview-map-guard.ts";

const releaseSha =
  process.env.WORKERS_CI_COMMIT_SHA ??
  process.env.GITHUB_SHA ??
  process.env.MATRUNDAN_RELEASE_SHA ??
  "unknown";

const appEnvironment =
  process.env.MATRUNDAN_ENVIRONMENT?.trim().toLowerCase() ??
  (process.env.WORKERS_CI === "1" ? "staging" : "local");
const deployedAt = process.env.MATRUNDAN_DEPLOYED_AT?.trim() ?? "";

export default defineConfig({
  vite: {
    plugins: [cloudflarePreviewMapGuard()],
    define: {
      "import.meta.env.VITE_MATRUNDAN_RELEASE_SHA": JSON.stringify(releaseSha),
      "import.meta.env.VITE_MATRUNDAN_ENVIRONMENT": JSON.stringify(appEnvironment),
      "import.meta.env.VITE_MATRUNDAN_DEPLOYED_AT": JSON.stringify(deployedAt),
    },
  },
  nitro: {
    preset: "cloudflare-module",
    cloudflare: {
      // Wrangler environments live in the checked-in source config. Nitro's generated
      // redirected deploy config cannot legally contain environments.
      deployConfig: false,
      nodeCompat: true,
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
});
