export type GroupShellPath = "/" | "/exempel" | "/matstallen" | "/gruppen" | "/besok";
export type PersonalJourneyPath = "/min-matresa" | "/min-matresa/matstallen" | "/min-matresa/besok";

export interface PersonalJourneyReturnContext {
  href: string;
  groupId: string | null;
}

export interface PersonalJourneyNavigationState {
  returnContext?: PersonalJourneyReturnContext;
  resumeHref?: string;
  sourceGroupId?: string | null;
}

declare module "@tanstack/react-router" {
  interface HistoryState {
    personalJourney?: PersonalJourneyNavigationState;
  }
}

function pathnameFromHref(href: string): string {
  const queryIndex = href.indexOf("?");
  const hashIndex = href.indexOf("#");
  const cutAt = [queryIndex, hashIndex]
    .filter((index) => index >= 0)
    .reduce((lowest, index) => Math.min(lowest, index), href.length);
  return href.slice(0, cutAt) || "/";
}

export function isSafeInternalHref(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
}

export function isPersonalJourneyPath(pathname: string): boolean {
  return pathname === "/min-matresa" || pathname.startsWith("/min-matresa/");
}

export function isPersonalJourneyHref(value: unknown): value is string {
  return isSafeInternalHref(value) && isPersonalJourneyPath(pathnameFromHref(value));
}

export function createPersonalJourneyReturnContext(
  href: string,
  groupId: string | null,
): PersonalJourneyReturnContext | null {
  if (!isSafeInternalHref(href) || isPersonalJourneyHref(href)) return null;
  return {
    href,
    groupId: typeof groupId === "string" && groupId.length > 0 ? groupId : null,
  };
}

export function getPersonalJourneyNavigationState(state: unknown): PersonalJourneyNavigationState {
  if (!state || typeof state !== "object") return {};
  const raw = (state as { personalJourney?: unknown }).personalJourney;
  if (!raw || typeof raw !== "object") return {};

  const value = raw as {
    returnContext?: unknown;
    resumeHref?: unknown;
    sourceGroupId?: unknown;
  };
  let returnContext: PersonalJourneyReturnContext | undefined;

  if (value.returnContext && typeof value.returnContext === "object") {
    const candidate = value.returnContext as { href?: unknown; groupId?: unknown };
    if (
      isSafeInternalHref(candidate.href) &&
      !isPersonalJourneyHref(candidate.href) &&
      (typeof candidate.groupId === "string" || candidate.groupId === null)
    ) {
      returnContext = {
        href: candidate.href,
        groupId: candidate.groupId,
      };
    }
  }

  const resumeHref = isPersonalJourneyHref(value.resumeHref) ? value.resumeHref : undefined;
  const sourceGroupId =
    typeof value.sourceGroupId === "string" || value.sourceGroupId === null
      ? value.sourceGroupId
      : undefined;

  return {
    returnContext,
    resumeHref,
    sourceGroupId,
  };
}

export function personalJourneyDemoSearch(mode: "landing" | "demo" | "live"): {
  demo?: 1;
} {
  return mode === "demo" ? { demo: 1 } : {};
}

export function groupHomePath(exampleMode = false): "/" | "/exempel" {
  return exampleMode ? "/exempel" : "/";
}
