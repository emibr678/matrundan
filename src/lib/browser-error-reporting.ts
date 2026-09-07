import { safeErrorCode, sanitizeOperation } from "./observability";
import { reportBrowserErrorEvent } from "./matrundan/browser-error.functions";

type BrowserErrorMechanism = "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";

type BrowserErrorOptions = {
  mechanism?: BrowserErrorMechanism;
  handled?: boolean;
};

const LOVABLE_DIAGNOSTIC_ID = "matrundan-lovable-runtime-diagnostic";

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

function lovablePreviewDiagnosticCode(error: unknown): string | null {
  if (typeof window === "undefined" || !window.location.hostname.endsWith(".lovable.app")) {
    return null;
  }

  if (
    error instanceof Error &&
    error.message.startsWith("Missing Supabase environment variable(s):")
  ) {
    return "SUPABASE_ENV_MISSING";
  }

  return safeErrorCode(error, "BROWSER_UNEXPECTED_ERROR");
}

function showLovablePreviewDiagnostic(error: unknown): void {
  const code = lovablePreviewDiagnosticCode(error);
  if (!code || typeof document === "undefined") return;

  const existing = document.getElementById(LOVABLE_DIAGNOSTIC_ID);
  const element = existing ?? document.createElement("div");
  element.id = LOVABLE_DIAGNOSTIC_ID;
  element.textContent = `Diagnos: ${code}`;
  element.setAttribute("role", "status");
  element.style.cssText =
    "position:fixed;left:50%;bottom:16px;z-index:2147483647;transform:translateX(-50%);padding:6px 10px;border-radius:6px;background:#fff;color:#111;font:12px/1.4 monospace;box-shadow:0 1px 4px #0003;white-space:nowrap";
  if (!existing) document.body.appendChild(element);
}

export function reportBrowserError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  showLovablePreviewDiagnostic(error);
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
