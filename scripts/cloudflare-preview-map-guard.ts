import type { Plugin } from "vite";

/** Validate the resolved browser environment in either supported build entry. */
export function cloudflarePreviewMapGuard(): Plugin {
  return {
    name: "matrundan-preview-map-key",
    apply: "build",
    configResolved(config) {
      const workersBuild = process.env.WORKERS_CI === "1" || !!process.env.WORKERS_CI_COMMIT_SHA;
      if (workersBuild && !config.env.VITE_GEOAPIFY_MAPS_KEY?.trim()) {
        throw new Error(
          "PR-preview saknar VITE_GEOAPIFY_MAPS_KEY i Cloudflare Builds build variables. Ange den browser-begränsade Staging-kartnyckeln innan previewen byggs.",
        );
      }
    },
  };
}
