import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Den publika VAPID-nyckeln är avsedd att vara publik och behövs i webbläsaren. */
export const getPushPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env.VAPID_PUBLIC_KEY ?? null };
});

/** Skickar köade notiser direkt efter en händelse, så vanliga notiser kommer på sekunden. */
export const flushNotificationOutbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { dispatchNotificationOutbox } = await import("./push-dispatch.server");
    return dispatchNotificationOutbox();
  });
