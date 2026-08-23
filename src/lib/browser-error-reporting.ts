import { safeErrorCode, sanitizeOperation } from "./observability";
import { reportBrowserErrorEvent } from "./matrundan/browser-error.functions";

type BrowserErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
};

function browserErrorOptions(context: Record<string, unknown>): BrowserErrorOptions {
  const mechanism = context.mechanism;
  return {
    mechanism:
      mechanism === "manual" ||
      mechanism === "onerror" ||
      mechanism === "unhandledrejection" ||
      mechanism === "react_error_boundary"
        ? mechanism
        : "react_error_boundary",
    handled: typeof context.handled === "boolean" ? context.handled : true,
  };
}

export function reportBrowserError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  const options = browserErrorOptions(context);
  void reportBrowserErrorEvent({
    data: {
      operation: sanitizeOperation(window.location.pathname),
      errorCode: safeErrorCode(error, "BROWSER_UNEXPECTED_ERROR"),
      mechanism: options.mechanism ?? "react_error_boundary",
      handled: options.handled ?? true,
    },
  }).catch(() => {
    // Felrapportering får aldrig skapa ett nytt användarsynligt fel eller en
    // rapporteringsloop. Auth-/nätverksfel fångas i respektive serverlogg.
  });
}
