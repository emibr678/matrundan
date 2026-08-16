import * as React from "react";
import { ExternalLink, EyeOff, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PlaceSuggestionReportDialog } from "@/components/matrundan/PlaceSuggestionReportDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listDemoHiddenPlaceSuggestions,
  listGroupHiddenPlaceSuggestions,
  restoreDemoPlaceSuggestion,
  restoreGroupPlaceSuggestion,
  type HiddenPlaceSuggestion,
} from "@/lib/matrundan/hidden-place-suggestions";
import type { ReportablePlaceSuggestion } from "@/lib/matrundan/place-data-reports";
import { googleMapsSearchUrl, normalizeWebsiteUrl } from "@/lib/matrundan/place-links";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
import { CATEGORY_LABEL } from "@/lib/matrundan/types";

function formatHiddenDate(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function reportableHiddenSuggestion(item: HiddenPlaceSuggestion): ReportablePlaceSuggestion {
  return {
    provider: item.provider,
    providerPlaceId: item.providerPlaceId,
    name: item.name,
    category: item.category ?? null,
    address: item.address,
    area: item.area ?? null,
    city: item.city,
    lat: item.lat ?? null,
    lng: item.lng ?? null,
    website: normalizeWebsiteUrl(item.website) ?? null,
  };
}

export function HiddenPlaceSuggestionsSection() {
  const { state } = useStore();
  const { mode, activeGroupId } = useSession();
  const [items, setItems] = React.useState<HiddenPlaceSuggestion[]>([]);
  const [selected, setSelected] = React.useState<HiddenPlaceSuggestion | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const groupId = mode === "live" ? activeGroupId : state.group.id;
  const groupArchived = state.group.lifecycleStatus === "archived";

  const load = React.useCallback(async () => {
    if (!groupId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setItems(
        mode === "live"
          ? await listGroupHiddenPlaceSuggestions(groupId)
          : listDemoHiddenPlaceSuggestions(groupId),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte läsa dolda sökträffar.");
    } finally {
      setLoading(false);
    }
  }, [groupId, mode]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (!groupId) return null;

  async function restore(item: HiddenPlaceSuggestion) {
    if (!groupId) return;
    const key = `${item.provider}:${item.providerPlaceId}`;
    setBusyKey(key);
    try {
      if (mode === "live") await restoreGroupPlaceSuggestion(groupId, item);
      else restoreDemoPlaceSuggestion(groupId, item);
      setItems((current) => current.filter((candidate) => candidate !== item));
      if (selected === item) setSelected(null);
      window.dispatchEvent(new Event("matrundan:hidden-place-suggestions-changed"));
      toast.success(`${item.name} visas i sökningen igen.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte återställa sökträffen.");
    } finally {
      setBusyKey(null);
    }
  }

  const selectedKey = selected ? `${selected.provider}:${selected.providerPlaceId}` : null;
  const selectedWebsite = normalizeWebsiteUrl(selected?.website);
  const selectedHiddenDate = formatHiddenDate(selected?.hiddenAt);

  return (
    <>
      <section>
        <h3 className="mb-2 text-sm font-medium">Dolda sökträffar</h3>
        <Card className="rounded-2xl border-border/70 p-4">
          <div className="flex items-start gap-3">
            <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Dolda träffar visas inte i den här gruppens söklista eller på kartan. Öppna en träff
              för att kontrollera underlaget, rapportera felaktig information eller återställa den.
            </p>
          </div>

          {loading ? (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Laddar…
            </div>
          ) : items.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">Inga dolda sökträffar.</p>
          ) : (
            <div className="mt-3 divide-y divide-border/60 rounded-xl border border-border/70">
              {items.map((item) => {
                const key = `${item.provider}:${item.providerPlaceId}`;
                return (
                  <div key={key} className="flex min-w-0 items-center gap-2 p-2">
                    <button
                      type="button"
                      className="min-h-11 min-w-0 flex-1 rounded-lg px-2 py-1 text-left hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring"
                      onClick={() => setSelected(item)}
                      aria-label={`Öppna den dolda sökträffen ${item.name}`}
                    >
                      <span className="block break-words text-sm font-medium">{item.name}</span>
                      <span className="block break-words text-[11px] text-muted-foreground">
                        {[item.address, item.city].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-11 shrink-0"
                      disabled={groupArchived || busyKey === key}
                      onClick={() => void restore(item)}
                    >
                      {busyKey === key ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                      Återställ
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {groupArchived ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Återaktivera gruppen för att rapportera eller återställa dolda sökträffar.
            </p>
          ) : null}
        </Card>
      </section>

      <Dialog open={selected != null} onOpenChange={(open) => !open && setSelected(null)}>
        {selected ? (
          <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{selected.name}</DialogTitle>
              <DialogDescription>
                Dold för den här gruppen{selectedHiddenDate ? ` sedan ${selectedHiddenDate}` : ""}.
                Andra grupper påverkas inte.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                {selected.category ? (
                  <div className="text-xs font-medium text-muted-foreground">
                    {CATEGORY_LABEL[selected.category]}
                  </div>
                ) : null}
                <div className="mt-1 break-words text-sm">
                  {[selected.address, selected.area, selected.city].filter(Boolean).join(" · ")}
                </div>
              </div>

              <div className={selectedWebsite ? "grid grid-cols-2 gap-2" : "grid grid-cols-1"}>
                {selectedWebsite ? (
                  <Button asChild variant="outline" className="min-h-11 min-w-0 px-2">
                    <a
                      href={selectedWebsite}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Öppna webbplatsen för ${selected.name}`}
                    >
                      <ExternalLink className="h-4 w-4 shrink-0" /> Webbplats
                    </a>
                  </Button>
                ) : null}
                <Button asChild variant="outline" className="min-h-11 min-w-0 px-2">
                  <a
                    href={googleMapsSearchUrl(selected)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Öppna ${selected.name} i Google Maps`}
                  >
                    <ExternalLink className="h-4 w-4 shrink-0" /> Google Maps
                  </a>
                </Button>
              </div>

              {!groupArchived ? (
                <PlaceSuggestionReportDialog
                  suggestion={reportableHiddenSuggestion(selected)}
                  alreadyHidden
                  triggerLabel="Rapportera felaktig uppgift"
                />
              ) : null}

              <p className="text-xs leading-relaxed text-muted-foreground">
                En rapport granskas privat av gruppens admin. Döljningen är en separat, reversibel
                inställning för den här gruppen.
              </p>
            </div>

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
              <Button variant="ghost" onClick={() => setSelected(null)}>
                Stäng
              </Button>
              <Button
                variant="outline"
                disabled={groupArchived || busyKey === selectedKey}
                onClick={() => void restore(selected)}
              >
                {busyKey === selectedKey ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Återställ i sökningen
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
