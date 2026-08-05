import * as React from "react";
import { ChevronDown, Clock3, Globe2, Loader2, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";

import { CrossGroupPracticalInfoSuggestions } from "./CrossGroupPracticalInfoSuggestions";
import { PlaceExternalLink } from "./PlaceExternalLink";
import { PlaceLocationRefresh } from "./PlaceLocationRefresh";
import { PlacePracticalInfoDialog } from "./PlacePracticalInfoDialog";
import {
  PlacePracticalInfoProvider,
  usePlacePracticalInfo,
} from "./PlacePracticalInfoContext";
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
  openingHoursDaySummary,
  openingHoursForDate,
  type OpeningHoursSchedule,
} from "@/lib/matrundan/opening-hours";
import { normalizeWebsiteUrl } from "@/lib/matrundan/place-links";
import { googleMapsUrl } from "@/lib/matrundan/store";
import { cn } from "@/lib/utils";

export { PlacePracticalInfoProvider };

export function OpeningHoursScheduleList({
  schedule,
  timezone,
}: {
  schedule: OpeningHoursSchedule;
  timezone: string | null;
}) {
  const today = openingHoursForDate(schedule, new Date(), timezone);

  return (
    <>
      <dl className="space-y-1.5 text-sm">
        {schedule.days.map((day) => (
          <div key={day.code} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
            <dt className={day.code === today.code ? "font-medium" : "text-muted-foreground"}>
              {day.label}
            </dt>
            <dd className="max-w-[11rem] text-right [overflow-wrap:anywhere]">
              {openingHoursDaySummary(day)}
            </dd>
          </div>
        ))}
      </dl>
      {schedule.partiallyParsed ? (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Specialdagar eller ovanliga regler kan avvika. Kontrollera gärna ställets egen information
          före besöket.
        </p>
      ) : null}
    </>
  );
}

function AddWebsiteDialog({ compact = false }: { compact?: boolean }) {
  const { place, saveWebsite } = usePlacePracticalInfo();
  const [open, setOpen] = React.useState(false);
  const [website, setWebsite] = React.useState("");
  const [sourceNote, setSourceNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setWebsite("");
    setSourceNote("");
  }, [open]);

  async function submit() {
    if (saving) return;
    setSaving(true);
    try {
      await saveWebsite(website, sourceNote);
      setOpen(false);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Webbplatsen kunde inte sparas.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "min-h-11 justify-start gap-2 text-sm font-medium text-primary",
            compact ? "h-full w-full rounded-none px-3" : "px-2",
          )}
          aria-label="Lägg till webbplats"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className="truncate">Webbplats</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lägg till webbplats</DialogTitle>
          <DialogDescription>
            Webbplatsen visas direkt för gruppen. Länken sparas också som privat underlag för
            granskning, men publiceras aldrig externt automatiskt.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`place-website-${place.id}`}>Webbplats</Label>
            <Input
              id={`place-website-${place.id}`}
              inputMode="url"
              autoFocus
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`place-website-note-${place.id}`}>Kommentar till gruppens admin</Label>
            <Textarea
              id={`place-website-note-${place.id}`}
              rows={3}
              maxLength={1000}
              value={sourceNote}
              onChange={(event) => setSourceNote(event.target.value)}
              placeholder="Valfritt, till exempel var du hittade länken."
            />
          </div>
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="ghost" disabled={saving} onClick={() => setOpen(false)}>
            Avbryt
          </Button>
          <Button type="button" disabled={saving || !website.trim()} onClick={() => void submit()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Lägg till för gruppen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PlaceWebsiteInfo({ compact = false }: { compact?: boolean }) {
  const { place, websiteUrl, canEdit, websitePending } = usePlacePracticalInfo();

  if (websitePending) {
    return (
      <div className="flex min-h-11 items-center gap-2 px-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        <span className="truncate">Hämtar…</span>
      </div>
    );
  }

  if (websiteUrl) {
    return (
      <PlaceExternalLink
        href={websiteUrl}
        target="_blank"
        rel="noreferrer"
        icon={Globe2}
        tail="Webbplats"
        className={compact ? "w-full px-3" : undefined}
        aria-label={`Öppna webbplatsen för ${place.name}`}
      />
    );
  }

  if (canEdit) return <AddWebsiteDialog compact={compact} />;

  return (
    <div className="flex min-h-11 items-center gap-2 px-3 text-sm text-muted-foreground">
      <Globe2 className="h-4 w-4 shrink-0" />
      <span className="truncate">Webbplats saknas</span>
    </div>
  );
}

export function PlaceOpeningHoursInfo({ compact = false }: { compact?: boolean }) {
  const {
    place,
    groupId,
    practicalInfo,
    details,
    openingHours,
    todaySummary,
    hasExternalSource,
    canEdit,
    loading,
    refreshing,
    error,
    practicalInfoError,
    loadPracticalInfo,
    loadExternalDetails,
    setPracticalInfo,
  } = usePlacePracticalInfo();
  const summary = loading ? "Hämtar…" : (todaySummary ?? "Saknas");
  const contentError = practicalInfoError ?? (hasExternalSource && error && !details ? error : null);
  const canExpand = Boolean(openingHours || canEdit || contentError);

  const summaryContent = (
    <>
      <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[11px] font-medium text-muted-foreground">
          Öppettider
        </span>
        <span className="block truncate font-medium">{summary}</span>
      </span>
    </>
  );

  if (!canExpand) {
    return (
      <div
        className={cn(
          "flex min-h-11 items-center gap-2 px-3 text-sm",
          compact ? "col-span-1" : "mt-2 border-t border-border/60",
        )}
        aria-label={`Öppettider: ${summary}`}
      >
        {summaryContent}
      </div>
    );
  }

  return (
    <details
      className={cn(
        "group",
        compact ? "col-span-1 open:col-span-2" : "mt-2 border-t border-border/60 pt-1",
      )}
    >
      <summary
        className={cn(
          "flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm marker:content-none transition-colors hover:bg-background/35",
          compact ? "rounded-none" : "rounded-xl",
        )}
        aria-label={`Öppettider: ${summary}`}
      >
        {summaryContent}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-3 border-t border-border/60 px-3 pb-3 pt-3">
        {canEdit ? (
          <div className="flex min-h-9 items-center justify-end">
            <PlacePracticalInfoDialog
              place={place}
              groupId={groupId}
              practicalInfo={practicalInfo}
              externalWebsite={
                details?.website ?? normalizeWebsiteUrl(place.canonicalWebsite) ?? null
              }
              externalOpeningHours={details?.openingHours ?? null}
              canRefreshExternal={hasExternalSource}
              refreshingExternal={refreshing || loading}
              onRefreshExternal={() => loadExternalDetails(true)}
              onSaved={setPracticalInfo}
            />
          </div>
        ) : null}

        {openingHours ? (
          <div className="rounded-xl bg-background/45 px-3 py-3">
            <OpeningHoursScheduleList schedule={openingHours} timezone={details?.timezone ?? null} />
          </div>
        ) : null}

        <CrossGroupPracticalInfoSuggestions
          groupId={groupId}
          placeId={place.id}
          enabled={canEdit}
          onApplied={loadPracticalInfo}
        />

        {contentError ? (
          <p role="status" className="text-xs leading-relaxed text-muted-foreground">
            {contentError}
          </p>
        ) : null}
      </div>
    </details>
  );
}

export function PlacePracticalInfoPanel() {
  const { effectivePlace, hasExternalSource } = usePlacePracticalInfo();

  return (
    <div
      data-testid="place-practical-info"
      className="relative mt-4 overflow-hidden rounded-2xl border border-border/60 bg-background/35"
    >
      <div
        data-testid="place-address-row"
        className={cn(
          "relative flex min-h-11 items-center px-3",
          hasExternalSource ? "pr-14" : "pr-3",
        )}
      >
        <PlaceExternalLink
          href={googleMapsUrl(effectivePlace)}
          target="_blank"
          rel="noreferrer"
          icon={MapPin}
          prefix={`${effectivePlace.address}, `}
          tail={effectivePlace.city}
          className="min-w-0 flex-1"
          aria-label={`Öppna ${effectivePlace.name} i Google Maps`}
        />
        {hasExternalSource ? (
          <div className="absolute inset-y-0 right-1 flex items-center">
            <PlaceLocationRefresh />
          </div>
        ) : null}
      </div>

      <div
        data-testid="place-practical-links"
        className="grid min-w-0 grid-cols-2 border-t border-border/60"
      >
        <div className="min-w-0 border-r border-border/60">
          <PlaceWebsiteInfo compact />
        </div>
        <PlaceOpeningHoursInfo compact />
      </div>
    </div>
  );
}
