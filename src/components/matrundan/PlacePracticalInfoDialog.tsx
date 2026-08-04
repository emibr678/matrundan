import * as React from "react";
import { Loader2, Pencil, RefreshCw, RotateCcw } from "lucide-react";
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
  updateGroupPlacePracticalInfo,
  updateLocalGroupPlacePracticalInfo,
  type GroupPlacePracticalInfo,
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

function scheduleInputs(
  schedule: OpeningHoursSchedule | null,
): Record<OpeningHoursDayCode, string> {
  const result = emptyDayInputs();
  for (const day of schedule?.days ?? []) result[day.code] = openingHoursDayInput(day);
  return result;
}

function scheduleEqual(
  left: OpeningHoursSchedule | null,
  right: OpeningHoursSchedule | null,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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
  canRefreshExternal = false,
  refreshingExternal = false,
  onRefreshExternal,
  onSaved,
}: {
  place: Place;
  groupId: string;
  practicalInfo: GroupPlacePracticalInfo;
  externalWebsite: string | null;
  externalOpeningHours: OpeningHoursSchedule | null;
  disabled?: boolean;
  canRefreshExternal?: boolean;
  refreshingExternal?: boolean;
  onRefreshExternal?: () => void | Promise<void>;
  onSaved: (next: GroupPlacePracticalInfo) => void;
}) {
  const { mode, exampleMode } = useSession();
  const { state, demoReadOnly } = useStore();
  const [open, setOpen] = React.useState(false);
  const [website, setWebsite] = React.useState("");
  const [dayInputs, setDayInputs] =
    React.useState<Record<OpeningHoursDayCode, string>>(emptyDayInputs);
  const [sourceUrl, setSourceUrl] = React.useState("");
  const [sourceNote, setSourceNote] = React.useState("");
  const [evidenceOpen, setEvidenceOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const storageKind = exampleMode ? "session" : "local";
  const reporter = state.members.find((member) => member.id === state.currentUserId);

  React.useEffect(() => {
    if (!open) return;
    setWebsite(practicalInfo.websiteOverride ?? "");
    setDayInputs(scheduleInputs(practicalInfo.openingHoursOverride));
    setSourceUrl(practicalInfo.sourceUrl ?? "");
    setSourceNote(practicalInfo.sourceNote ?? "");
    setEvidenceOpen(Boolean(practicalInfo.sourceUrl || practicalInfo.sourceNote));
  }, [open, practicalInfo]);

  function useExternalInformation() {
    setWebsite("");
    setDayInputs(emptyDayInputs());
    setSourceUrl("");
    setSourceNote("");
    setEvidenceOpen(false);
  }

  function suggestSource(candidate: string | null) {
    if (!candidate) return;
    setSourceUrl((current) => (current.trim() ? current : candidate));
  }

  async function createReviewUnderlays(
    websiteNeedsReview: boolean,
    openingHoursNeedsReview: boolean,
    normalizedSourceUrl: string | null,
    normalizedSourceNote: string | null,
  ) {
    if (!reporter) return;
    const reports: Promise<unknown>[] = [];
    if (websiteNeedsReview) {
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
    if (openingHoursNeedsReview) {
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
    let parsedOpeningHours: OpeningHoursSchedule | null;
    try {
      parsedOpeningHours = buildOpeningHoursScheduleFromInputs(dayInputs);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kontrollera öppettiderna.");
      return;
    }

    const normalizedWebsite = normalizeWebsiteUrl(website) ?? null;
    if (website.trim() && !normalizedWebsite) {
      toast.error("Ange en giltig webbplats.");
      return;
    }

    const websiteOverride =
      normalizedWebsite && normalizedWebsite !== externalWebsite ? normalizedWebsite : null;
    const openingHoursOverride =
      parsedOpeningHours && !scheduleEqual(parsedOpeningHours, externalOpeningHours)
        ? parsedOpeningHours
        : null;
    const hasOverride = Boolean(websiteOverride || openingHoursOverride);
    const normalizedSourceUrl = hasOverride ? (normalizeWebsiteUrl(sourceUrl) ?? null) : null;
    if (hasOverride && sourceUrl.trim() && !normalizedSourceUrl) {
      setEvidenceOpen(true);
      toast.error("Ange en giltig länk.");
      return;
    }
    const normalizedSourceNote = hasOverride ? sourceNote.trim() || null : null;
    if (hasOverride && !normalizedSourceUrl && (normalizedSourceNote?.length ?? 0) < 10) {
      setEvidenceOpen(true);
      toast.error("Lägg till en länk eller beskriv kort vad du kontrollerade (minst 10 tecken).");
      return;
    }

    const websiteChanged = websiteOverride !== practicalInfo.websiteOverride;
    const openingHoursChanged = !scheduleEqual(
      openingHoursOverride,
      practicalInfo.openingHoursOverride,
    );
    const sourceUrlChanged = normalizedSourceUrl !== practicalInfo.sourceUrl;
    const sourceNoteChanged = normalizedSourceNote !== practicalInfo.sourceNote;
    if (!websiteChanged && !openingHoursChanged && !sourceUrlChanged && !sourceNoteChanged) {
      toast.info("Inga ändringar att spara.");
      return;
    }

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
        next = updateLocalGroupPlacePracticalInfo(groupId, place.id, input, reporter, storageKind);
      }
      onSaved(next);
      await createReviewUnderlays(
        websiteChanged && Boolean(websiteOverride),
        openingHoursChanged && Boolean(openingHoursOverride),
        normalizedSourceUrl,
        normalizedSourceNote,
      );
      toast.success("Webbplats och öppettider är uppdaterade.", {
        description: hasOverride
          ? "Ändringen syns direkt i gruppen. Administratörerna får ett underlag om den behöver granskas."
          : "Gruppens egna ändringar är borttagna.",
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
        <Button type="button" variant="ghost" size="sm" disabled={cannotEdit} className="h-9 px-2">
          <Pencil className="h-3.5 w-3.5" /> Ändra
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Ändra webbplats och öppettider</DialogTitle>
          <DialogDescription>
            Uppgifterna visas direkt för {state.group.name}. När du anger andra uppgifter sparas ett
            privat underlag som gruppens administratörer kan granska.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {practicalInfo.updatedAt ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Senast ändrad {formatTimestamp(practicalInfo.updatedAt)}
              {practicalInfo.updatedByName ? ` av ${practicalInfo.updatedByName}` : ""}.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="practical-website">Webbplats</Label>
              {externalWebsite || practicalInfo.websiteOverride ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setWebsite("")}>
                  Använd hittad uppgift
                </Button>
              ) : null}
            </div>
            <Input
              id="practical-website"
              inputMode="url"
              value={website}
              onChange={(event) => {
                setWebsite(event.target.value);
                setEvidenceOpen(true);
              }}
              onBlur={() => suggestSource(normalizeWebsiteUrl(website) ?? null)}
              placeholder={externalWebsite ?? "https://…"}
            />
            <p className="text-xs text-muted-foreground">
              {externalWebsite
                ? `Hittad uppgift: ${externalWebsite}`
                : "Lämna tomt om gruppen inte ska använda en egen webbplats."}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Label>Öppettider</Label>
                <p className="text-xs text-muted-foreground">
                  Skriv till exempel 11–22, 11–14, 17–22 eller Stängt.
                </p>
              </div>
              {externalOpeningHours || practicalInfo.openingHoursOverride ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setDayInputs(emptyDayInputs())}
                >
                  Använd hittad uppgift
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
                    onChange={(event) => {
                      setDayInputs((current) => ({ ...current, [code]: event.target.value }));
                      setEvidenceOpen(true);
                      suggestSource(normalizeWebsiteUrl(website) ?? externalWebsite);
                    }}
                    placeholder="11–22"
                  />
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={useExternalInformation}>
              <RotateCcw className="h-3.5 w-3.5" /> Använd hittade uppgifter för allt
            </Button>
          </div>

          <details
            open={evidenceOpen}
            onToggle={(event) => setEvidenceOpen(event.currentTarget.open)}
            className="rounded-xl border border-border/70"
          >
            <summary className="flex min-h-11 cursor-pointer items-center px-3 py-2 text-sm font-medium">
              Hur vet du det?
            </summary>
            <div className="space-y-3 border-t border-border/60 p-3">
              <div className="space-y-1.5">
                <Label htmlFor="practical-source-url">Länk till informationen</Label>
                <Input
                  id="practical-source-url"
                  inputMode="url"
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="Till exempel ställets webbplats"
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
                Lägg till en länk eller beskriv kort vad du kontrollerade. Underlaget stannar i
                gruppen och används bara när ändringen behöver granskas.
              </p>
            </div>
          </details>

          {canRefreshExternal && onRefreshExternal ? (
            <details className="rounded-xl border border-border/70">
              <summary className="flex min-h-11 cursor-pointer items-center px-3 py-2 text-sm font-medium">
                Fler alternativ
              </summary>
              <div className="space-y-2 border-t border-border/60 p-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={refreshingExternal}
                  onClick={() => void onRefreshExternal()}
                >
                  {refreshingExternal ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Sök efter ny information
                </Button>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Matrundan kontrollerar om ny information finns. Gruppens uppgifter ändras inte
                  automatiskt.
                </p>
              </div>
            </details>
          ) : null}
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
