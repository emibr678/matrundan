import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const isCloudflareBuild = process.env.MATRUNDAN_CLOUDFLARE_BUILD === "1";

const releaseSha =
  process.env.WORKERS_CI_COMMIT_SHA ??
  process.env.GITHUB_SHA ??
  process.env.MATRUNDAN_RELEASE_SHA ??
  "unknown";

const appEnvironment = process.env.MATRUNDAN_ENVIRONMENT?.trim().toLowerCase() ?? "local";
const deployedAt = process.env.MATRUNDAN_DEPLOYED_AT?.trim() ?? "";

export default defineConfig(({ command }) => ({
  define: {
    "import.meta.env.VITE_MATRUNDAN_RELEASE_SHA": JSON.stringify(releaseSha),
    "import.meta.env.VITE_MATRUNDAN_ENVIRONMENT": JSON.stringify(appEnvironment),
    "import.meta.env.VITE_MATRUNDAN_DEPLOYED_AT": JSON.stringify(deployedAt),
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      server: {
        entry: "server",
      },
    }),
    ...(command === "build"
      ? [
          nitro({
            ...(isCloudflareBuild ? { preset: "cloudflare-module" as const } : {}),
            cloudflare: {
              // Wrangler environments live in the checked-in source config. Nitro's generated
              // redirected deploy config cannot legally contain environments.
              deployConfig: false,
              nodeCompat: true,
            },
          }),
        ]
      : []),
    viteReact(),
  ],
  resolve: {
    tsconfigPaths: true,
    dedupe: ["react", "react-dom", "@tanstack/react-router"],
  },
}));
