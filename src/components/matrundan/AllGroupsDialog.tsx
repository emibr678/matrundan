import * as React from "react";
import { Archive, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UserGroupSummary } from "@/lib/matrundan/session";

function GroupRow({
  group,
  activeGroupId,
  onSelect,
}: {
  group: UserGroupSummary;
  activeGroupId: string | null;
  onSelect: (groupId: string) => void;
}) {
  const current = group.id === activeGroupId;
  const archived = group.lifecycleStatus === "archived";

  return (
    <button
      type="button"
      onClick={() => onSelect(group.id)}
      aria-current={current ? "page" : undefined}
      className="flex w-full min-w-0 items-start gap-3 rounded-xl border border-border/70 px-3 py-3 text-left transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="mt-0.5 shrink-0 text-xl" aria-hidden="true">
        {group.emoji ?? "🍽️"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-medium">{group.name}</span>
          {current ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-primary">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Nuvarande
            </span>
          ) : archived ? (
            <Archive
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-label="Arkiverad"
            />
          ) : null}
        </span>
        {group.description ? (
          <span className="mt-1 block line-clamp-2 break-words text-sm leading-snug text-muted-foreground">
            {group.description}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function AllGroupsDialog({
  open,
  onOpenChange,
  groups,
  activeGroupId,
  onSelect,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: UserGroupSummary[];
  activeGroupId: string | null;
  onSelect: (groupId: string) => void;
  onCreate: () => void;
}) {
  const activeGroups = React.useMemo(
    () => groups.filter((group) => group.lifecycleStatus === "active"),
    [groups],
  );
  const archivedGroups = React.useMemo(
    () => groups.filter((group) => group.lifecycleStatus === "archived"),
    [groups],
  );

  function select(groupId: string) {
    onSelect(groupId);
    onOpenChange(false);
  }

  function create() {
    onOpenChange(false);
    onCreate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-md overflow-hidden p-0">
        <DialogHeader className="px-5 pb-2 pt-5 text-left">
          <DialogTitle>Alla grupper</DialogTitle>
          <DialogDescription>Välj grupp att öppna.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-5 overflow-y-auto px-5 pb-4">
          <section aria-labelledby="active-groups-heading" className="space-y-2">
            <h3
              id="active-groups-heading"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Aktiva grupper
            </h3>
            <div className="space-y-2">
              {activeGroups.map((group) => (
                <GroupRow
                  key={group.id}
                  group={group}
                  activeGroupId={activeGroupId}
                  onSelect={select}
                />
              ))}
            </div>
          </section>

          {archivedGroups.length > 0 ? (
            <section aria-labelledby="archived-groups-heading" className="space-y-2">
              <h3
                id="archived-groups-heading"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Arkiverade grupper
              </h3>
              <div className="space-y-2">
                {archivedGroups.map((group) => (
                  <GroupRow
                    key={group.id}
                    group={group}
                    activeGroupId={activeGroupId}
                    onSelect={select}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border/70 px-5 py-4 sm:justify-start">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={create}>
            <Plus className="mr-2 h-4 w-4" />
            Skapa ny grupp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
