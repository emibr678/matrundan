import { isRequestId, safeErrorCode, sanitizeOperation } from "./observability";
import { RELEASE_SHA } from "./release-metadata";

export const REQUEST_ID_HEADER = "x-matrundan-request-id";

type Severity = "error" | "warning" | "info";
type SafeEvent = {
  event: string;
  severity: Severity;
  request_id: string;
  release_sha: string;
  environment: string;
  operation: string;
  status?: number;
  duration_ms?: number;
  dependency?: string;
  error_code?: string;
  mechanism?: string;
  handled?: boolean;
};

function runtimeEnvironment(): string {
  const value = process.env.MATRUNDAN_ENVIRONMENT?.trim().toLowerCase();
  if (value === "staging" || value === "prod" || value === "local" || value === "test") {
    return value;
  }
  return "unknown";
}

export function requestIdFor(request: Request): string {
  const existing = request.headers.get(REQUEST_ID_HEADER);
  return isRequestId(existing) ? existing : crypto.randomUUID();
}

export function requestWithObservabilityHeaders(request: Request, requestId: string): Request {
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  return new Request(request, { headers });
}

export function responseWithRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function logSafeEvent(
  request: Request,
  event: Omit<SafeEvent, "request_id" | "release_sha" | "environment" | "operation"> & {
    operation?: string;
  },
): string {
  const requestId = requestIdFor(request);
  const payload: SafeEvent = {
    ...event,
    request_id: requestId,
    release_sha: RELEASE_SHA,
    environment: runtimeEnvironment(),
    operation: sanitizeOperation(event.operation ?? request.url),
    ...(event.duration_ms == null
      ? {}
      : { duration_ms: Math.max(0, Math.round(event.duration_ms)) }),
  };
  const serialized = JSON.stringify(payload);
  if (event.severity === "error") console.error(serialized);
  else console.log(serialized);
  return requestId;
}

export function logUnexpectedServerError(
  request: Request,
  error: unknown,
  options: {
    operation?: string;
    status?: number;
    durationMs?: number;
    dependency?: string;
    event?: string;
  } = {},
): string {
  return logSafeEvent(request, {
    event: options.event ?? "server_error",
    severity: "error",
    status: options.status ?? 500,
    duration_ms: options.durationMs,
    dependency: options.dependency,
    error_code: safeErrorCode(error),
    operation: options.operation,
  });
}
