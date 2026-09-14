import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  APP_DEPLOYED_AT,
  APP_DISPLAY_NAME,
  formatDeploymentTime,
  IS_STAGING,
} from "@/lib/app-environment";
import { APP_VERSION } from "@/lib/matrundan/version";
import { RELEASE_SHA } from "@/lib/release-metadata";

function releaseLabel(): string {
  return RELEASE_SHA === "unknown" ? "Okänd" : RELEASE_SHA.slice(0, 7);
}

function environmentSummary(): string {
  const origin = typeof window === "undefined" ? "" : `\nURL: ${window.location.origin}`;
  return (
    [
      APP_DISPLAY_NAME,
      `Version: v${APP_VERSION}`,
      `Release: ${releaseLabel()}`,
      `Driftsatt: ${formatDeploymentTime(APP_DEPLOYED_AT)}`,
      "Databas: Matrundan Staging",
    ].join("\n") + origin
  );
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Some mobile browsers expose Clipboard API without allowing writes.
    }
  }

  const activeElement = document.activeElement;
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();

  const copied = document.execCommand("copy");
  textArea.remove();

  if (activeElement instanceof HTMLElement) activeElement.focus();
  if (!copied) throw new Error("Clipboard write failed");
}

export function EnvironmentBadge() {
  if (!IS_STAGING) return null;

  async function copyEnvironmentInfo() {
    try {
      await copyText(environmentSummary());
      toast.success("Miljöinformationen är kopierad.");
    } catch {
      toast.error("Kunde inte kopiera miljöinformationen.");
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-6 shrink-0 items-center rounded-full border border-amber-500/50 bg-amber-100 px-2 text-[10px] font-bold tracking-[0.08em] text-amber-950 transition-colors hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
          aria-label="Visa information om stagingmiljön"
        >
          STAGING
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        sideOffset={8}
        className="w-[min(18rem,calc(100vw-2rem))] rounded-2xl p-4"
      >
        <div className="space-y-4">
          <div>
            <div className="text-xs font-bold tracking-[0.08em] text-amber-800">STAGING</div>
            <h2 className="mt-1 font-display text-lg font-semibold">Miljöinformation</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Testmiljön är separat från Matrundans publicerade app.
            </p>
          </div>

          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Miljö</dt>
            <dd className="text-right font-medium">Staging</dd>
            <dt className="text-muted-foreground">Appversion</dt>
            <dd className="text-right font-medium">v{APP_VERSION}</dd>
            <dt className="text-muted-foreground">Release</dt>
            <dd className="truncate text-right font-mono text-xs font-medium">{releaseLabel()}</dd>
            <dt className="text-muted-foreground">Driftsatt</dt>
            <dd className="text-right font-medium">{formatDeploymentTime(APP_DEPLOYED_AT)}</dd>
            <dt className="text-muted-foreground">Databas</dt>
            <dd className="text-right font-medium">Matrundan Staging</dd>
          </dl>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 w-full"
            onClick={() => void copyEnvironmentInfo()}
          >
            <Copy className="h-4 w-4" /> Kopiera miljöinfo
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
