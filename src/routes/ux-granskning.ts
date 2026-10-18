import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ux-granskning")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleUxReviewRequest } = await import("@/lib/ux-review.server");
        return handleUxReviewRequest(request);
      },
    },
  },
});
