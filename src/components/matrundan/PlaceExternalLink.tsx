import type * as React from "react";
import { ExternalLink, type LucideIcon } from "lucide-react";

import { googleMapsDisplayParts } from "@/lib/matrundan/place-links";
import { cn } from "@/lib/utils";

interface PlaceExternalLinkProps extends Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "children" | "prefix"
> {
  icon: LucideIcon;
  prefix?: React.ReactNode;
  tail: React.ReactNode;
}

function isGoogleMapsLink(href: string | undefined): boolean {
  if (!href) return false;
  try {
    const url = new URL(href);
    return /(^|\.)google\.[a-z.]+$/i.test(url.hostname) && url.pathname.startsWith("/maps");
  } catch {
    return false;
  }
}

export function PlaceExternalLink({
  icon: Icon,
  prefix,
  tail,
  className,
  ...props
}: PlaceExternalLinkProps) {
  const mapsDisplay =
    isGoogleMapsLink(props.href) && typeof prefix === "string" && typeof tail === "string"
      ? googleMapsDisplayParts({
          name: "",
          address: prefix.replace(/,\s*$/, ""),
          city: tail,
        })
      : null;
  const visiblePrefix = mapsDisplay ? mapsDisplay.prefix : prefix;
  const visibleTail = mapsDisplay ? mapsDisplay.tail : tail;

  return (
    <a
      {...props}
      className={cn(
        "inline-flex min-h-11 max-w-full items-start gap-1.5 py-1 text-sm font-medium text-primary transition-colors hover:underline",
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {visiblePrefix}
        <span
          data-slot="external-link-tail"
          className="inline-flex whitespace-nowrap align-baseline"
        >
          <span data-slot="external-link-tail-text">{visibleTail}</span>
          <ExternalLink
            aria-hidden="true"
            data-slot="external-link-icon"
            className="ml-1 h-3.5 w-3.5 shrink-0 self-center"
          />
        </span>
      </span>
    </a>
  );
}
