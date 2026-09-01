const SAFE_ERROR_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;
const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPAQUE_SEGMENT = /^[A-Za-z0-9_-]{20,}$/;

export type RuntimeEnvironment = "staging" | "prod" | "local" | "unknown";

export function environmentForRequestUrl(value: string): RuntimeEnvironment {
  let hostname: string;
  try {
    hostname = new URL(value, "http://localhost").hostname.toLowerCase();
  } catch {
    return "unknown";
  }

  if (
    hostname === "staging.matrundan.workers.dev" ||
    hostname.endsWith("-staging.matrundan.workers.dev")
  ) {
    return "staging";
  }
  if (hostname === "app.matrundan.workers.dev" || hostname.endsWith("-app.matrundan.workers.dev")) {
    return "prod";
  }
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") {
    return "local";
  }
  return "unknown";
}

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function sanitizePathSegment(segment: string): string {
  const decoded = decodePathSegment(segment);
  if (UUID_SEGMENT.test(decoded) || /^\d+$/.test(decoded) || OPAQUE_SEGMENT.test(decoded)) {
    return ":id";
  }

  const safe = decoded.replace(/[^\p{L}\p{N}._~-]/gu, "").slice(0, 48);
  return safe || ":segment";
}

export function sanitizeOperation(value: string): string {
  let pathname = value;
  try {
    pathname = new URL(value, "https://matrundan.invalid").pathname;
  } catch {
    pathname = value.split(/[?#]/, 1)[0] || "/";
  }

  if (!pathname.startsWith("/")) return "request";
  if (pathname === "/") return "/";

  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "inbjudan" && segments.length > 1) {
    return "/inbjudan/:token";
  }

  const sanitized = segments.map(sanitizePathSegment);
  return `/${sanitized.join("/")}`.slice(0, 160);
}

function normalizedCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_");
  return SAFE_ERROR_CODE.test(code) ? code : null;
}

export function safeErrorCode(error: unknown, fallback = "UNEXPECTED_ERROR"): string {
  if (error instanceof Response) {
    return `HTTP_${error.status}`;
  }

  if (error instanceof Error) {
    const explicitPrefix = /^([A-Z][A-Z0-9_]{1,63})(?::|\b)/.exec(error.message)?.[1];
    if (explicitPrefix && SAFE_ERROR_CODE.test(explicitPrefix)) return explicitPrefix;

    const named = normalizedCode(error.name === "Error" ? null : `JS_${error.name}`);
    if (named) return named;
  }

  if (error && typeof error === "object" && "code" in error) {
    const providerCode = normalizedCode(
      `DEPENDENCY_${String((error as { code?: unknown }).code ?? "")}`,
    );
    if (providerCode) return providerCode;
  }

  return normalizedCode(fallback) ?? "UNEXPECTED_ERROR";
}

export function isRequestId(value: string | null | undefined): value is string {
  return Boolean(
    value && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
  );
}
