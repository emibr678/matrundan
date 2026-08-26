import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logSafeEvent } from "@/lib/server-observability";

const browserErrorSchema = z.object({
  operation: z.string().min(1).max(200),
  errorCode: z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/),
  mechanism: z.enum(["manual", "onerror", "unhandledrejection", "react_error_boundary"]),
  handled: z.boolean(),
});

export const reportBrowserErrorEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => browserErrorSchema.parse(input))
  .handler(async ({ data }) => {
    const request = getRequest();
    const errorId = logSafeEvent(request, {
      event: "browser_error",
      severity: "error",
      operation: data.operation,
      dependency: "browser",
      error_code: data.errorCode,
      mechanism: data.mechanism,
      handled: data.handled,
    });
    return { errorId };
  });
