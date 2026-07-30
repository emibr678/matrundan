import { createFileRoute } from "@tanstack/react-router";

/**
 * Reservkanal för notiser: körs av ett schemalagt jobb varje minut och
 * plockar upp köade notiser som inte hann skickas direkt vid händelsen.
 */
export const Route = createFileRoute("/api/public/hooks/push-dispatch")({
  server: {
    handlers: {
      POST: async () => {
        const { dispatchNotificationOutbox } = await import(
          "@/lib/matrundan/push-dispatch.server"
        );
        const summary = await dispatchNotificationOutbox();
        return Response.json({ ok: true, ...summary });
      },
    },
  },
});
