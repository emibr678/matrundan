import { safeErrorCode, sanitizeOperation } from "./observability";
import { reportBrowserErrorEvent } from "./matrundan/browser-error.functions";

type BrowserErrorMechanism = "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";

type BrowserErrorOptions = {
  mechanism?: BrowserErrorMechanism;
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

export function installBrowserErrorReporting(): () => void {
  if (typeof window === "undefined") return () => {};

  const onError = (event: ErrorEvent) => {
    reportBrowserError(event.error ?? new Error("BROWSER_WINDOW_ERROR"), {
      mechanism: "onerror",
      handled: false,
    });
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    reportBrowserError(event.reason ?? new Error("BROWSER_UNHANDLED_REJECTION"), {
      mechanism: "unhandledrejection",
      handled: false,
    });
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  };
}
