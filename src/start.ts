import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import {
  logUnexpectedServerError,
  responseWithRequestId,
} from "./lib/server-observability";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const csrfMiddleware = createCsrfMiddleware({
  filter: (context) => context.handlerType === "serverFn",
});

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  const startedAt = performance.now();
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    const errorId = logUnexpectedServerError(request, error, {
      status: 500,
      durationMs: performance.now() - startedAt,
      event: "request_error",
    });
    return responseWithRequestId(
      new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
      errorId,
    );
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [csrfMiddleware, errorMiddleware],
}));
