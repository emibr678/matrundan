import { defineConfig as defineLovableConfig } from "@lovable.dev/vite-tanstack-config";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const envEnabled = (value: string | undefined) =>
  Boolean(value && value !== "0" && value.toLowerCase() !== "false");

const isLovableEnvironment = [
  process.env.MATRUNDAN_LOVABLE_BUILD,
  process.env.LOVABLE,
  process.env.LOVABLE_SANDBOX,
  process.env.LOVABLE_DEV_SERVER,
  process.env.LOVABLE_PREVIEW_HOST,
  process.env.LOVABLE_PROJECT_ID,
].some(envEnabled);

const releaseSha =
  process.env.WORKERS_CI_COMMIT_SHA ??
  process.env.GITHUB_SHA ??
  process.env.MATRUNDAN_RELEASE_SHA ??
  "unknown";

const releaseDefine = {
  "import.meta.env.VITE_MATRUNDAN_RELEASE_SHA": JSON.stringify(releaseSha),
};

const config = isLovableEnvironment
  ? defineLovableConfig({
      vite: {
        define: releaseDefine,
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
    })
  : defineConfig(({ command }) => {
      const isCloudflareBuild = process.env.MATRUNDAN_CLOUDFLARE_BUILD === "1";

      return {
        define: releaseDefine,
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
      };
    });

export default config;
