import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command }) => ({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      server: {
        entry: "server",
      },
    }),
    ...(command === "build"
      ? [
          nitro({
            preset: "cloudflare-module",
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
    dedupe: ["react", "react-dom", "@tanstack/react-router"],
  },
}));
