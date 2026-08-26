import {
  environmentForRequestUrl,
  isRequestId,
  safeErrorCode,
  sanitizeOperation,
} from "./observability";
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

function operationFor(request: Request, explicitOperation?: string): string {
  if (explicitOperation) return sanitizeOperation(explicitOperation);

  const operation = sanitizeOperation(request.url);
  if (!operation.startsWith("/_serverFn/")) return operation;

  const referer = request.headers.get("referer");
  return referer ? `serverFn ${sanitizeOperation(referer)}` : "/_serverFn/:id";
}

function dependencyForErrorCode(errorCode: string): string | undefined {
  if (errorCode.startsWith("GEOAPIFY_")) return "geoapify";
  if (errorCode.startsWith("SUPABASE_") || errorCode.startsWith("DEPENDENCY_23")) {
    return "supabase";
  }
  if (errorCode.startsWith("PUSH_")) return "push";
  if (errorCode.startsWith("STORAGE_")) return "storage";
  return undefined;
}

export function requestIdFor(request: Request): string {
  const existing = request.headers.get(REQUEST_ID_HEADER);
  return isRequestId(existing) ? existing : crypto.randomUUID();
}

export function responseWithRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  const existing = headers.get(REQUEST_ID_HEADER);
  if (!isRequestId(existing)) {
    headers.set(REQUEST_ID_HEADER, requestId);
  }
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
    environment: environmentForRequestUrl(request.url),
    operation: operationFor(request, event.operation),
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
  const errorCode = safeErrorCode(error);
  return logSafeEvent(request, {
    event: options.event ?? "server_error",
    severity: "error",
    status: options.status ?? 500,
    duration_ms: options.durationMs,
    dependency: options.dependency ?? dependencyForErrorCode(errorCode),
    error_code: errorCode,
    operation: options.operation,
  });
}
