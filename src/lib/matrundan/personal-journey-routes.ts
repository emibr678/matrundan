export type GroupShellPath = "/" | "/matstallen" | "/gruppen" | "/besok";
export type PersonalJourneyPath = "/min-matresa" | "/min-matresa/matstallen" | "/min-matresa/besok";

export function isPersonalJourneyPath(pathname: string): boolean {
  return pathname === "/min-matresa" || pathname.startsWith("/min-matresa/");
}

export function personalJourneyPathFor(pathname: string): PersonalJourneyPath {
  if (pathname.startsWith("/matstallen")) return "/min-matresa/matstallen";
  if (pathname === "/besok" || pathname.startsWith("/gruppen")) {
    return "/min-matresa/besok";
  }
  return "/min-matresa";
}

export function groupPathForPersonalJourney(pathname: string): GroupShellPath {
  if (pathname.startsWith("/min-matresa/matstallen")) return "/matstallen";
  if (pathname.startsWith("/min-matresa/besok")) return "/besok";
  return "/";
}
