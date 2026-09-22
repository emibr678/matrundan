import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/visit-photo/$deliveryToken")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { handleVisitPhotoDelivery } = await import(
          "@/lib/matrundan/visit-photo-delivery.server"
        );
        return handleVisitPhotoDelivery(request, params.deliveryToken);
      },
    },
  },
});
