import * as React from "react";
import { EyeOff, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PlaceDataReportsSection } from "@/components/matrundan/PlaceDataReportsSection";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  listDemoHiddenPlaceSuggestions,
  listGroupHiddenPlaceSuggestions,
  restoreDemoPlaceSuggestion,
  restoreGroupPlaceSuggestion,
  type HiddenPlaceSuggestion,
} from "@/lib/matrundan/hidden-place-suggestions";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";

export function HiddenPlaceSuggestionsSection() {
  const { state } = useStore();
  const { mode, activeGroupId } = useSession();
  const [items, setItems] = React.useState<HiddenPlaceSuggestion[]>([]);
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
      window.dispatchEvent(new Event("matrundan:hidden-place-suggestions-changed"));
      toast.success(`${item.name} visas i sökningen igen.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte återställa sökträffen.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <>
      <section>
        <h3 className="mb-2 text-sm font-medium">Dolda sökträffar</h3>
        <Card className="rounded-2xl border-border/70 p-4">
          <div className="flex items-start gap-3">
            <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Ställen som gruppen har dolt visas inte i söklistan eller på kartan. De kan
              återställas här utan att andra grupper påverkas.
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
                  <div key={key} className="flex min-w-0 items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-sm font-medium">{item.name}</div>
                      <div className="break-words text-[11px] text-muted-foreground">
                        {[item.address, item.city].filter(Boolean).join(" · ")}
                      </div>
                    </div>
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
              Återaktivera gruppen för att ändra dolda sökträffar.
            </p>
          ) : null}
        </Card>
      </section>

      <PlaceDataReportsSection />
    </>
  );
}
