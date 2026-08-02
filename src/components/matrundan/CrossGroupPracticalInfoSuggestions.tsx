import * as React from "react";
import { AlertTriangle, Clock3, Globe2, Loader2, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { openingHoursDaySummary } from "@/lib/matrundan/opening-hours";
import {
  applyCrossGroupPracticalInfoSuggestion,
  emptyCrossGroupPracticalInfoSuggestions,
  getCrossGroupPracticalInfoSuggestions,
  type CrossGroupPracticalInfoField,
  type CrossGroupPracticalInfoSuggestions,
} from "@/lib/matrundan/practical-info";
import { useSession } from "@/lib/matrundan/session";

function websiteLabel(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function SuggestionActions({
  field,
  fingerprint,
  applyingField,
  onApply,
  onHide,
}: {
  field: CrossGroupPracticalInfoField;
  fingerprint: string;
  applyingField: CrossGroupPracticalInfoField | null;
  onApply: (field: CrossGroupPracticalInfoField, fingerprint: string) => void;
  onHide: (field: CrossGroupPracticalInfoField) => void;
}) {
  const applying = applyingField === field;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        className="min-h-10"
        disabled={applyingField != null}
        onClick={() => onApply(field, fingerprint)}
      >
        {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Använd för gruppen
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-10"
        disabled={applyingField != null}
        onClick={() => onHide(field)}
      >
        Inte nu
      </Button>
    </div>
  );
}

export function CrossGroupPracticalInfoSuggestions({
  groupId,
  placeId,
  enabled,
  onApplied,
}: {
  groupId: string;
  placeId: string;
  enabled: boolean;
  onApplied: () => Promise<void> | void;
}) {
  const { mode, exampleMode } = useSession();
  const [suggestions, setSuggestions] = React.useState<CrossGroupPracticalInfoSuggestions>(
    emptyCrossGroupPracticalInfoSuggestions,
  );
  const [loading, setLoading] = React.useState(false);
  const [applyingField, setApplyingField] = React.useState<CrossGroupPracticalInfoField | null>(
    null,
  );
  const [hiddenFields, setHiddenFields] = React.useState<Set<CrossGroupPracticalInfoField>>(
    () => new Set(),
  );

  const load = React.useCallback(async () => {
    if (mode !== "live" || exampleMode || !enabled) {
      setSuggestions(emptyCrossGroupPracticalInfoSuggestions());
      return;
    }
    setLoading(true);
    try {
      setSuggestions(await getCrossGroupPracticalInfoSuggestions(groupId, placeId));
    } catch {
      // Migrationen kan saknas i en äldre miljö. Förslag är ett sekundärt stöd
      // och får inte blockera matställets huvudsakliga detaljflöde.
      setSuggestions(emptyCrossGroupPracticalInfoSuggestions());
    } finally {
      setLoading(false);
    }
  }, [enabled, exampleMode, groupId, mode, placeId]);

  React.useEffect(() => {
    setHiddenFields(new Set());
    void load();
  }, [load]);

  function hide(field: CrossGroupPracticalInfoField) {
    setHiddenFields((current) => new Set(current).add(field));
  }

  async function apply(field: CrossGroupPracticalInfoField, fingerprint: string) {
    setApplyingField(field);
    try {
      await applyCrossGroupPracticalInfoSuggestion(groupId, placeId, field, fingerprint);
      hide(field);
      await onApplied();
      window.dispatchEvent(new Event("matrundan:reload"));
      window.dispatchEvent(new Event("matrundan:practical-info-changed"));
      toast.success(
        field === "website"
          ? "Webbplatsen används nu i gruppen."
          : "Öppettiderna används nu i gruppen.",
      );
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Förslaget kunde inte användas.");
      await load();
    } finally {
      setApplyingField(null);
    }
  }

  const website = hiddenFields.has("website")
    ? { ...suggestions.website, status: "none" as const }
    : suggestions.website;
  const openingHours = hiddenFields.has("opening_hours")
    ? { ...suggestions.openingHours, status: "none" as const }
    : suggestions.openingHours;
  const visible = website.status !== "none" || openingHours.status !== "none";

  if (!enabled || mode !== "live" || exampleMode || (!loading && !visible)) return null;

  return (
    <section className="mt-3 rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="flex items-start gap-2">
        <UsersRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="text-sm font-medium">Förslag från andra grupper</div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Förslagen gäller samma matställe. Grupp, medlem, källa och privata anteckningar visas
            aldrig.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-3 flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Kontrollerar förslag…
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {website.status === "available" && website.website && website.fingerprint ? (
            <div className="rounded-xl border border-border/60 bg-background/70 p-3">
              <div className="flex items-start gap-2 text-sm">
                <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="font-medium">Föreslagen webbplats</div>
                  <div className="mt-0.5 break-all text-muted-foreground">
                    {websiteLabel(website.website)}
                  </div>
                </div>
              </div>
              <SuggestionActions
                field="website"
                fingerprint={website.fingerprint}
                applyingField={applyingField}
                onApply={(field, fingerprint) => void apply(field, fingerprint)}
                onHide={hide}
              />
            </div>
          ) : null}

          {website.status === "conflicting" ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50/70 p-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Andra grupper har olika webbplatser. Kontrollera kartdatan eller verksamhetens egen
                information innan gruppen ändrar något.
              </span>
            </div>
          ) : null}

          {openingHours.status === "available" &&
          openingHours.openingHours &&
          openingHours.fingerprint ? (
            <div className="rounded-xl border border-border/60 bg-background/70 p-3">
              <div className="flex items-start gap-2 text-sm">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">Föreslagna öppettider</div>
                  <details className="mt-1">
                    <summary className="min-h-9 cursor-pointer py-2 text-primary">
                      Visa veckotider
                    </summary>
                    <dl className="space-y-1.5 pb-1 text-sm">
                      {openingHours.openingHours.days.map((day) => (
                        <div
                          key={day.code}
                          className="grid grid-cols-[minmax(0,1fr)_auto] gap-3"
                        >
                          <dt className="text-muted-foreground">{day.label}</dt>
                          <dd className="max-w-[11rem] text-right [overflow-wrap:anywhere]">
                            {openingHoursDaySummary(day)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                </div>
              </div>
              <SuggestionActions
                field="opening_hours"
                fingerprint={openingHours.fingerprint}
                applyingField={applyingField}
                onApply={(field, fingerprint) => void apply(field, fingerprint)}
                onHide={hide}
              />
            </div>
          ) : null}

          {openingHours.status === "conflicting" ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50/70 p-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Andra grupper har olika öppettider. Kontrollera kartdatan eller verksamhetens egen
                information innan gruppen ändrar något.
              </span>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
