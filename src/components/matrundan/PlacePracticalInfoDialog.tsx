import * as React from "react";
import { ExternalLink, History, Loader2, Pencil, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildOpeningHoursScheduleFromInputs,
  OPENING_HOURS_DAY_CODES,
  OPENING_HOURS_DAY_LABEL,
  openingHoursDayInput,
  type OpeningHoursDayCode,
  type OpeningHoursSchedule,
} from "@/lib/matrundan/opening-hours";
import {
  createGroupPlaceDataReport,
  createLocalPlaceDataReport,
} from "@/lib/matrundan/place-data-reports";
import { normalizeWebsiteUrl } from "@/lib/matrundan/place-links";
import {
  listGroupPlacePracticalInfoHistory,
  listLocalGroupPlacePracticalInfoHistory,
  updateGroupPlacePracticalInfo,
  updateLocalGroupPlacePracticalInfo,
  type GroupPlacePracticalInfo,
  type GroupPlacePracticalInfoHistoryEntry,
} from "@/lib/matrundan/practical-info";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
import type { Place } from "@/lib/matrundan/types";

function emptyDayInputs(): Record<OpeningHoursDayCode, string> {
  return OPENING_HOURS_DAY_CODES.reduce<Record<OpeningHoursDayCode, string>>(
    (result, code) => {
      result[code] = "";
      return result;
    },
    {} as Record<OpeningHoursDayCode, string>,
  );
}

function scheduleInputs(schedule: OpeningHoursSchedule | null): Record<OpeningHoursDayCode, string> {
  const result = emptyDayInputs();
  for (const day of schedule?.days ?? []) result[day.code] = openingHoursDayInput(day);
  return result;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short" }).format(
    date,
  );
}

function reportDescription(
  label: string,
  sourceUrl: string | null,
  sourceNote: string | null,
): string {
  return [
    `${label} har uppdaterats i gruppen och bör kontrolleras mot kartdatan.`,
    sourceNote ? `Observation: ${sourceNote}` : null,
    sourceUrl ? `Källa: ${sourceUrl}` : null,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1000);
}

export function PlacePracticalInfoDialog({
  place,
  groupId,
  practicalInfo,
  externalWebsite,
  externalOpeningHours,
  disabled = false,
  onSaved,
}: {
  place: Place;
  groupId: string;
  practicalInfo: GroupPlacePracticalInfo;
  externalWebsite: string | null;
  externalOpeningHours: OpeningHoursSchedule | null;
  disabled?: boolean;
  onSaved: (next: GroupPlacePracticalInfo) => void;
}) {
  const { mode, exampleMode } = useSession();
  const { state, demoReadOnly } = useStore();
  const [open, setOpen] = React.useState(false);
  const [website, setWebsite] = React.useState("");
  const [dayInputs, setDayInputs] = React.useState<Record<OpeningHoursDayCode, string>>(
    emptyDayInputs,
  );
  const [sourceUrl, setSourceUrl] = React.useState("");
  const [sourceNote, setSourceNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [history, setHistory] = React.useState<GroupPlacePracticalInfoHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const storageKind = exampleMode ? "session" : "local";
  const reporter = state.members.find((member) => member.id === state.currentUserId);

  React.useEffect(() => {
    if (!open) return;
    setWebsite(practicalInfo.websiteOverride ?? "");
    setDayInputs(scheduleInputs(practicalInfo.openingHoursOverride));
    setSourceUrl(practicalInfo.sourceUrl ?? "");
    setSourceNote(practicalInfo.sourceNote ?? "");
    setHistoryLoading(true);
    void Promise.resolve(
      mode === "live"
        ? listGroupPlacePracticalInfoHistory(groupId, place.id)
        : listLocalGroupPlacePracticalInfoHistory(groupId, place.id, storageKind),
    )
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [groupId, mode, open, place.id, practicalInfo, storageKind]);

  function useMapData() {
    setWebsite("");
    setDayInputs(emptyDayInputs());
    setSourceUrl("");
    setSourceNote("");
  }

  function copyExternalHours() {
    if (!externalOpeningHours) return;
    setDayInputs(scheduleInputs(externalOpeningHours));
  }

  async function createReviewUnderlays(
    websiteChanged: boolean,
    openingHoursChanged: boolean,
    normalizedSourceUrl: string | null,
    normalizedSourceNote: string | null,
  ) {
    if (!reporter) return;
    const reports: Promise<unknown>[] = [];
    if (websiteChanged && normalizeWebsiteUrl(website)) {
      const description = reportDescription(
        "Webbplatsen",
        normalizedSourceUrl,
        normalizedSourceNote,
      );
      reports.push(
        mode === "live"
          ? createGroupPlaceDataReport(groupId, place.id, {
              category: "wrong_website",
              description,
            })
          : Promise.resolve(
              createLocalPlaceDataReport(
                groupId,
                place,
                reporter,
                { category: "wrong_website", description },
                storageKind,
              ),
            ),
      );
    }
    if (openingHoursChanged) {
      const description = reportDescription(
        "Öppettiderna",
        normalizedSourceUrl,
        normalizedSourceNote,
      );
      reports.push(
        mode === "live"
          ? createGroupPlaceDataReport(groupId, place.id, {
              category: "wrong_opening_hours",
              description,
            })
          : Promise.resolve(
              createLocalPlaceDataReport(
                groupId,
                place,
                reporter,
                { category: "wrong_opening_hours", description },
                storageKind,
              ),
            ),
      );
    }
    if (reports.length === 0) return;
    const results = await Promise.allSettled(reports);
    if (results.some((result) => result.status === "rejected")) {
      toast.warning("Uppgifterna sparades, men granskningsunderlaget kunde inte skapas.");
    } else {
      window.dispatchEvent(new Event("matrundan:place-data-reports-changed"));
    }
  }

  async function save() {
    if (saving) return;
    let openingHoursOverride: OpeningHoursSchedule | null;
    try {
      openingHoursOverride = buildOpeningHoursScheduleFromInputs(dayInputs);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kontrollera öppettiderna.");
      return;
    }

    const websiteOverride = normalizeWebsiteUrl(website) ?? null;
    if (website.trim() && !websiteOverride) {
      toast.error("Ange en giltig webbplats.");
      return;
    }
    const normalizedSourceUrl = normalizeWebsiteUrl(sourceUrl) ?? null;
    if (sourceUrl.trim() && !normalizedSourceUrl) {
      toast.error("Ange en giltig källänk.");
      return;
    }
    const normalizedSourceNote = sourceNote.trim() || null;
    if (
      (websiteOverride || openingHoursOverride) &&
      !normalizedSourceUrl &&
      (normalizedSourceNote?.length ?? 0) < 10
    ) {
      toast.error("Ange en källänk eller en kort observation med minst 10 tecken.");
      return;
    }

    const websiteChanged = websiteOverride !== practicalInfo.websiteOverride;
    const openingHoursChanged =
      JSON.stringify(openingHoursOverride) !== JSON.stringify(practicalInfo.openingHoursOverride);
    setSaving(true);
    try {
      const input = {
        websiteOverride,
        openingHoursOverride,
        sourceUrl: normalizedSourceUrl,
        sourceNote: normalizedSourceNote,
      };
      let next: GroupPlacePracticalInfo;
      if (mode === "live") {
        await updateGroupPlacePracticalInfo(groupId, place.id, input);
        next = {
          ...input,
          updatedBy: state.currentUserId,
          updatedByName: reporter?.name ?? null,
          updatedAt: new Date().toISOString(),
        };
        window.dispatchEvent(new Event("matrundan:reload"));
      } else {
        if (!reporter) throw new Error("Medlemmen kunde inte identifieras.");
        next = updateLocalGroupPlacePracticalInfo(
          groupId,
          place.id,
          input,
          reporter,
          storageKind,
        );
      }
      onSaved(next);
      await createReviewUnderlays(
        websiteChanged,
        openingHoursChanged,
        normalizedSourceUrl,
        normalizedSourceNote,
      );
      toast.success("Gruppens praktiska information är uppdaterad.", {
        description:
          websiteOverride || openingHoursOverride
            ? "Ändringen syns direkt i gruppen. Admin kan granska om kartdatan också bör uppdateras."
            : "Gruppen använder nu kartdatan igen.",
      });
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Uppgifterna kunde inte sparas.");
    } finally {
      setSaving(false);
    }
  }

  const cannotEdit = disabled || demoReadOnly;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={cannotEdit}
          className="h-9 px-2"
        >
          <Pencil className="h-3.5 w-3.5" /> Redigera
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Redigera praktisk information</DialogTitle>
          <DialogDescription>
            Ändringarna visas direkt för {state.group.name}. Gruppens admin kan sedan granska om
            uppgifterna även bör föras vidare till kartdatan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="practical-website">Gruppens webbplats</Label>
            <Input
              id="practical-website"
              inputMode="url"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder={externalWebsite ?? "https://…"}
            />
            <p className="text-xs text-muted-foreground">
              Lämna tomt för att använda webbplatsen från kartdatan.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Label>Gruppens öppettider</Label>
                <p className="text-xs text-muted-foreground">
                  Skriv till exempel 11–22, 11–14, 17–22 eller Stängt.
                </p>
              </div>
              {externalOpeningHours ? (
                <Button type="button" variant="outline" size="sm" onClick={copyExternalHours}>
                  Utgå från kartdatan
                </Button>
              ) : null}
            </div>
            <div className="grid gap-2 rounded-xl border border-border/70 p-3">
              {OPENING_HOURS_DAY_CODES.map((code) => (
                <div
                  key={code}
                  className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2"
                >
                  <Label htmlFor={`practical-hours-${code}`} className="text-sm font-normal">
                    {OPENING_HOURS_DAY_LABEL[code]}
                  </Label>
                  <Input
                    id={`practical-hours-${code}`}
                    value={dayInputs[code]}
                    onChange={(event) =>
                      setDayInputs((current) => ({ ...current, [code]: event.target.value }))
                    }
                    placeholder="11–22"
                  />
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={useMapData}>
              <RotateCcw className="h-3.5 w-3.5" /> Rensa gruppens uppgifter och använd kartdatan
            </Button>
          </div>

          <div className="space-y-3 rounded-xl bg-muted/35 p-3">
            <div className="text-sm font-medium">Källa eller observation</div>
            <div className="space-y-1.5">
              <Label htmlFor="practical-source-url">Länk (valfri)</Label>
              <Input
                id="practical-source-url"
                inputMode="url"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="Verksamhetens officiella webbplats"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="practical-source-note">Vad har du kontrollerat?</Label>
              <Textarea
                id="practical-source-note"
                rows={3}
                maxLength={1000}
                value={sourceNote}
                onChange={(event) => setSourceNote(event.target.value)}
                placeholder="Exempel: Tiderna står på dörren och kontrollerades idag."
              />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Källan stannar i gruppen. Bara en separat granskad text kan senare publiceras till
              OpenStreetMap.
            </p>
          </div>

          <details className="rounded-xl border border-border/70">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium">
              <History className="h-4 w-4" /> Tidigare ändringar
            </summary>
            <div className="space-y-3 border-t border-border/60 p-3">
              {historyLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Laddar…
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Inga tidigare ändringar.</p>
              ) : (
                history.map((entry) => (
                  <div key={entry.id} className="text-xs leading-relaxed">
                    <div className="font-medium">
                      {entry.changedByName} · {formatDate(entry.changedAt)}
                    </div>
                    {entry.sourceNote ? (
                      <p className="mt-1 text-muted-foreground">{entry.sourceNote}</p>
                    ) : null}
                    {entry.sourceUrl ? (
                      <a
                        href={entry.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Visa källa <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </details>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="ghost" disabled={saving} onClick={() => setOpen(false)}>
            Avbryt
          </Button>
          <Button type="button" disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Spara för gruppen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
