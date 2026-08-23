type BrowserErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type EditorErrorEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: BrowserErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __lovableEvents?: EditorErrorEvents;
    __lovableReportRuntimeError?: (payload: {
      message: string;
      stack?: string;
      filename?: string;
    }) => void;
  }
}

export function reportBrowserError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  // Lovable exposes these optional hooks only inside its editor preview. They are
  // an adapter for local/editor diagnostics, never a production runtime dependency.
  window.__lovableEvents?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route: window.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );

  // Prod React does not rethrow boundary-caught errors to window.onerror. Keep
  // the optional editor adapter useful without exposing query strings or state.
  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${new URL(error.url).pathname}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);
  window.__lovableReportRuntimeError?.({
    message,
    stack: error instanceof Error ? error.stack : undefined,
    filename: window.location.pathname,
  });
}
