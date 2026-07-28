import * as React from "react";
import { CalendarDays, Check, ChevronDown, CircleHelp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  canManageNextStopDateProposal,
  countNextStopDateResponses,
  defaultNextStopDateValue,
  formatNextStopDate,
  isPastDateValue,
  NEXT_STOP_DATE_RESPONSE_LABEL,
  normalizeNextStopTime,
} from "@/lib/matrundan/next-stop-date";
import {
  liveProposeNextStopDate,
  liveRespondNextStopDate,
  liveSetNextStopDateStatus,
} from "@/lib/matrundan/live-mutations";
import { useStore } from "@/lib/matrundan/store";
import type { NextStopDateProposal, NextStopDateResponseValue, Role } from "@/lib/matrundan/types";

const RESPONSE_OPTIONS: {
  value: NextStopDateResponseValue;
  icon: typeof Check;
  className: string;
}[] = [
  {
    value: "fits",
    icon: Check,
    className: "data-[active=true]:border-primary data-[active=true]:bg-primary/10",
  },
  {
    value: "not_fits",
    icon: X,
    className: "data-[active=true]:border-destructive/60 data-[active=true]:bg-destructive/10",
  },
  {
    value: "unsure",
    icon: CircleHelp,
    className: "data-[active=true]:border-mustard data-[active=true]:bg-mustard/20",
  },
];

function demoStorageFor(groupId: string): Storage | null {
  if (typeof window === "undefined") return null;
  return groupId === "example-stockholm" ? window.sessionStorage : window.localStorage;
}

function storageKey(groupId: string) {
  return `matrundan.nextStopDate.v1.${groupId}`;
}

function readDemoProposal(groupId: string, fallback: NextStopDateProposal | null) {
  try {
    const raw = demoStorageFor(groupId)?.getItem(storageKey(groupId));
    return raw ? (JSON.parse(raw) as NextStopDateProposal) : fallback;
  } catch {
    return fallback;
  }
}

function memberRole(state: ReturnType<typeof useStore>["state"]): Role | undefined {
  return state.members.find((member) => member.id === state.currentUserId)?.role;
}

export function NextStopDateCard({ placeId, canWrite }: { placeId: string; canWrite: boolean }) {
  const { state, mode } = useStore();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [date, setDate] = React.useState(defaultNextStopDateValue);
  const [time, setTime] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [demoProposal, setDemoProposal] = React.useState<NextStopDateProposal | null>(() =>
    mode === "demo" ? readDemoProposal(state.group.id, state.nextStopDateProposal ?? null) : null,
  );

  const proposal = mode === "live" ? (state.nextStopDateProposal ?? null) : demoProposal;
  const role = memberRole(state);
  const canManage = proposal
    ? canManageNextStopDateProposal(proposal, state.currentUserId, role)
    : false;

  React.useEffect(() => {
    if (mode !== "demo") return;
    try {
      const storage = demoStorageFor(state.group.id);
      if (demoProposal) {
        storage?.setItem(storageKey(state.group.id), JSON.stringify(demoProposal));
      } else {
        storage?.removeItem(storageKey(state.group.id));
      }
    } catch {
      /* Lagringen är ett tillfälligt stöd och får aldrig blockera flödet. */
    }
  }, [demoProposal, mode, state.group.id]);

  React.useEffect(() => {
    if (mode !== "demo") return;
    if (
      state.group.lifecycleStatus === "archived" ||
      !state.nextPlaceId ||
      demoProposal?.placeId !== state.nextPlaceId
    ) {
      if (demoProposal) setDemoProposal(null);
    }
  }, [demoProposal, mode, state.group.lifecycleStatus, state.nextPlaceId]);

  React.useEffect(() => {
    if (mode !== "demo" || typeof window === "undefined") return;
    const reset = () => {
      try {
        demoStorageFor(state.group.id)?.removeItem(storageKey(state.group.id));
      } catch {
        /* ignore */
      }
      setDemoProposal(state.nextStopDateProposal ?? null);
    };
    window.addEventListener("matrundan:demo-reset", reset);
    return () => window.removeEventListener("matrundan:demo-reset", reset);
  }, [mode, state.group.id, state.nextStopDateProposal]);

  async function runLive(operation: () => Promise<void>) {
    setBusy(true);
    try {
      await operation();
      window.dispatchEvent(new Event("matrundan:reload"));
    } finally {
      setBusy(false);
    }
  }

  async function propose() {
    if (busy) return;
    if (!date) {
      toast.error("Välj ett datum.");
      return;
    }
    if (isPastDateValue(date)) {
      toast.error("Datumet kan inte ligga i det förflutna.");
      return;
    }

    try {
      const normalizedTime = normalizeNextStopTime(time);
      if (mode === "live") {
        await runLive(async () => {
          await liveProposeNextStopDate(state.group.id, date, normalizedTime);
        });
      } else {
        const now = new Date().toISOString();
        setDemoProposal({
          id: `demo-date-${Date.now()}`,
          placeId,
          date,
          time: normalizedTime,
          createdBy: state.currentUserId,
          status: "active",
          createdAt: now,
          updatedAt: now,
          confirmedAt: null,
          confirmedBy: null,
          cancelledAt: null,
          cancelledBy: null,
          responses: [],
        });
      }
      setDialogOpen(false);
      toast.success("Datumet är föreslaget.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte föreslå datumet.");
    }
  }

  async function respond(response: NextStopDateResponseValue) {
    if (!proposal || busy || proposal.status !== "active") return;
    try {
      if (mode === "live") {
        await runLive(() => liveRespondNextStopDate(state.group.id, proposal.id, response));
      } else {
        const updatedAt = new Date().toISOString();
        setDemoProposal((current) =>
          current
            ? {
                ...current,
                updatedAt,
                responses: [
                  ...current.responses.filter((item) => item.memberId !== state.currentUserId),
                  { memberId: state.currentUserId, response, updatedAt },
                ],
              }
            : null,
        );
      }
      toast.success(`Ditt svar är ${NEXT_STOP_DATE_RESPONSE_LABEL[response].toLowerCase()}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara svaret.");
    }
  }

  async function setStatus(status: "confirmed" | "cancelled") {
    if (!proposal || busy || !canManage) return;
    try {
      if (mode === "live") {
        await runLive(() => liveSetNextStopDateStatus(state.group.id, proposal.id, status));
      } else if (status === "confirmed") {
        const now = new Date().toISOString();
        setDemoProposal((current) =>
          current
            ? {
                ...current,
                status: "confirmed",
                confirmedAt: now,
                confirmedBy: state.currentUserId,
                updatedAt: now,
              }
            : null,
        );
      } else {
        setDemoProposal(null);
      }
      toast.success(
        status === "confirmed" ? "Datumet är bekräftat." : "Datumförslaget är borttaget.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte ändra datumförslaget.");
    }
  }

  if (!proposal || proposal.placeId !== placeId) {
    return canWrite ? (
      <div className="border-t border-border/60 p-4">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full rounded-xl"
          onClick={() => setDialogOpen(true)}
        >
          <CalendarDays className="h-4 w-4" /> Föreslå datum
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Föreslå datum</DialogTitle>
              <DialogDescription>
                Välj en dag och, om ni vill, en tid för gruppens nästa stopp.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="next-stop-date">Datum</Label>
                <Input
                  id="next-stop-date"
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="next-stop-time">Tid (valfritt)</Label>
                <Input
                  id="next-stop-time"
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Avbryt
              </Button>
              <Button type="button" disabled={busy} onClick={() => void propose()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Föreslå
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    ) : null;
  }

  const counts = countNextStopDateResponses(proposal);
  const currentResponse = proposal.responses.find(
    (response) => response.memberId === state.currentUserId,
  )?.response;
  const proposer = state.members.find((member) => member.id === proposal.createdBy);

  return (
    <div className="border-t border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h2 className="font-medium">
              {proposal.status === "confirmed" ? "Planerat till" : "Datumförslag"}
            </h2>
            {proposal.status === "confirmed" ? <Badge>Bekräftat</Badge> : null}
          </div>
          <p className="mt-1 font-display text-lg font-semibold capitalize">
            {formatNextStopDate(proposal.date, proposal.time)}
          </p>
          {proposer ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Föreslaget av {proposer.avatar} {proposer.name}
            </p>
          ) : null}
        </div>
        {busy ? <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" /> : null}
      </div>

      {proposal.status === "active" && canWrite ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {RESPONSE_OPTIONS.map(({ value, icon: Icon, className }) => (
            <button
              key={value}
              type="button"
              data-active={currentResponse === value}
              aria-pressed={currentResponse === value}
              disabled={busy}
              onClick={() => void respond(value)}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border border-border/70 px-1.5 py-2 text-center text-[11px] font-medium transition-colors disabled:opacity-60 ${className}`}
            >
              <Icon className="h-4 w-4" />
              <span>{NEXT_STOP_DATE_RESPONSE_LABEL[value]}</span>
              <span className="text-[10px] text-muted-foreground">{counts[value]}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{counts.fits} passar</span>
          <span>·</span>
          <span>{counts.not_fits} passar inte</span>
          <span>·</span>
          <span>{counts.unsure} osäkra</span>
        </div>
      )}

      {proposal.responses.length > 0 ? (
        <Collapsible className="mt-3">
          <CollapsibleTrigger className="flex min-h-10 w-full items-center justify-between rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted/50">
            Se gruppens svar
            <ChevronDown className="h-4 w-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 px-2 pt-2">
            {RESPONSE_OPTIONS.map(({ value }) => {
              const names = proposal.responses
                .filter((response) => response.response === value)
                .map((response) => state.members.find((member) => member.id === response.memberId))
                .filter((member): member is NonNullable<typeof member> => !!member)
                .map((member) => `${member.avatar ?? ""} ${member.name}`.trim());
              if (!names.length) return null;
              return (
                <div key={value} className="text-xs leading-relaxed">
                  <span className="font-medium">{NEXT_STOP_DATE_RESPONSE_LABEL[value]}:</span>{" "}
                  <span className="text-muted-foreground">{names.join(", ")}</span>
                </div>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {canManage && canWrite ? (
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            className="min-h-10"
            disabled={busy}
            onClick={() => void setStatus("cancelled")}
          >
            Ta bort förslaget
          </Button>
          {proposal.status === "active" ? (
            <Button
              type="button"
              className="min-h-10"
              disabled={busy}
              onClick={() => void setStatus("confirmed")}
            >
              Bekräfta datum
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
