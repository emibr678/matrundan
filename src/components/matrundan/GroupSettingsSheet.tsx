import * as React from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ChevronRight,
  LogOut,
  RotateCcw,
  Search,
  Settings,
  SlidersHorizontal,
  Users,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import {
  GroupBasicsSettingsSection,
  GroupSearchAreasSettingsSection,
} from "@/components/matrundan/GroupSearchSettingsSection";
import { HiddenPlaceSuggestionsSection } from "@/components/matrundan/HiddenPlaceSuggestionsSection";
import { MemberManagementSection } from "@/components/matrundan/MemberManagementSection";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  leaveGroup,
  listGroupInvitations,
  revokeGroupInvitation,
  updateGroupSettings,
  type InvitationListItem,
} from "@/lib/matrundan/live-admin";
import { useSession } from "@/lib/matrundan/session";
import { formatDate, useStore } from "@/lib/matrundan/store";

type SettingsView =
  "menu" | "basics" | "search" | "members" | "maintenance" | "progression" | "status";

const VIEW_COPY: Record<SettingsView, { title: string; description: string }> = {
  menu: {
    title: "Gruppinställningar",
    description: "Välj vad du vill hantera i gruppen.",
  },
  basics: {
    title: "Gruppen",
    description: "Namn och symbol för gruppen.",
  },
  search: {
    title: "Sökområden",
    description: "Områden ni ofta söker i och avstånd runt adresser och andra punktval.",
  },
  members: {
    title: "Medlemmar och inbjudningar",
    description: "Se medlemmar, hantera roller och följ gruppens inbjudningshistorik.",
  },
  maintenance: {
    title: "Matställen",
    description: "Dolda sökträffar som gäller den här gruppen.",
  },
  progression: {
    title: "Besök och progression",
    description: "Hur gruppens besök räknas.",
  },
  status: {
    title: "Lämna eller hantera gruppen",
    description: "Lämna gruppen eller hantera om den är aktiv eller arkiverad.",
  },
};

function viewCanBeDirty(view: SettingsView): boolean {
  return view === "basics" || view === "search";
}

export function GroupSettingsSheet() {
  const { state, resetDemo } = useStore();
  const { mode, activeGroupId, activeGroupRole, refreshGroups } = useSession();
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<SettingsView>("menu");
  const [settingsDirty, setSettingsDirty] = React.useState(false);

  const isLive = mode === "live" && !!activeGroupId;
  const ownStoredRole = state.members.find((member) => member.id === state.currentUserId)?.role;
  const isOwner = isLive && activeGroupRole === "owner";
  const isAdmin = isLive && (activeGroupRole === "owner" || activeGroupRole === "admin");
  const canChangeGroupStatus = isLive && ownStoredRole === "ägare";
  const canMaintainPlaces = isAdmin || mode === "demo";
  const showGroupSettings = isAdmin && Boolean(activeGroupId);
  const showProgression = isAdmin && Boolean(activeGroupId);
  const showStatus = (isLive && Boolean(activeGroupId)) || mode === "demo";

  function canLeaveSettings(): boolean {
    return !settingsDirty || window.confirm("Du har osparade ändringar. Lämna utan att spara?");
  }

  function changeView(next: SettingsView) {
    if (viewCanBeDirty(view) && next !== view && !canLeaveSettings()) return;
    setSettingsDirty(false);
    setView(next);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && viewCanBeDirty(view) && !canLeaveSettings()) return;
    setOpen(nextOpen);
    if (!nextOpen) {
      setView("menu");
      setSettingsDirty(false);
    }
  }

  const copy = VIEW_COPY[view];

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full"
          aria-label="Gruppinställningar"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          {view !== "menu" ? (
            <Button
              type="button"
              variant="ghost"
              className="-ml-2 mb-1 w-fit justify-start rounded-full px-2"
              onClick={() => changeView("menu")}
            >
              <ArrowLeft className="h-4 w-4" /> Till inställningar
            </Button>
          ) : null}
          <SheetTitle>{copy.title}</SheetTitle>
          <SheetDescription>{copy.description}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-4">
          {view === "menu" ? (
            <SettingsMenu
              showGroupSettings={showGroupSettings}
              showMaintenance={canMaintainPlaces}
              showProgression={showProgression}
              showStatus={showStatus}
              onSelect={changeView}
            />
          ) : null}

          {view === "basics" && isAdmin && activeGroupId ? (
            <GroupBasicsSettingsSection
              groupId={activeGroupId}
              initialName={state.group.name}
              initialEmoji={state.group.emoji}
              onDirtyChange={setSettingsDirty}
            />
          ) : null}

          {view === "search" && isAdmin && activeGroupId ? (
            <GroupSearchAreasSettingsSection
              groupId={activeGroupId}
              initialSearchAreas={state.group.searchAreas ?? []}
              initialRadius={state.group.defaultSearchRadiusKm ?? 1}
              initialHome={state.group.homeLocation ?? null}
              onDirtyChange={setSettingsDirty}
            />
          ) : null}

          {view === "members" ? (
            <>
              <MemberManagementSection
                members={state.members}
                currentUserId={state.currentUserId}
                isOwner={isOwner}
                isAdmin={isAdmin}
                groupId={activeGroupId}
                onChanged={refreshGroups}
              />
              {isAdmin && activeGroupId ? (
                <InvitationAdministrationSection groupId={activeGroupId} />
              ) : null}
            </>
          ) : null}

          {view === "maintenance" && canMaintainPlaces ? <HiddenPlaceSuggestionsSection /> : null}

          {view === "progression" && isAdmin && activeGroupId ? (
            <ProgressionSettingsSection groupId={activeGroupId} />
          ) : null}

          {view === "status" ? (
            <>
              {isLive && activeGroupId ? (
                <LeaveGroupSection
                  groupId={activeGroupId}
                  isOwner={isOwner}
                  onLeft={refreshGroups}
                />
              ) : null}
              {canChangeGroupStatus ? <GroupStatusSection /> : null}
              {mode === "demo" ? (
                <section>
                  <h3 className="mb-2 text-sm font-medium">Demo-data</h3>
                  <Card className="rounded-2xl border-border/70 p-4">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-destructive"
                      onClick={() => {
                        if (window.confirm("Nollställ demo-data?")) {
                          resetDemo();
                          toast.success("Demo-data återställd");
                        }
                      }}
                    >
                      <RotateCcw className="h-4 w-4" /> Återställ demo-data
                    </Button>
                  </Card>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SettingsMenu({
  showGroupSettings,
  showMaintenance,
  showProgression,
  showStatus,
  onSelect,
}: {
  showGroupSettings: boolean;
  showMaintenance: boolean;
  showProgression: boolean;
  showStatus: boolean;
  onSelect: (view: SettingsView) => void;
}) {
  return (
    <Card className="divide-y divide-border/60 rounded-2xl border-border/70 p-0">
      {showGroupSettings ? (
        <>
          <MenuRow
            icon={Settings}
            title="Gruppen"
            description="Namn och symbol för gruppen"
            onClick={() => onSelect("basics")}
          />
          <MenuRow
            icon={Search}
            title="Sökområden"
            description="Områden ni ofta söker i"
            onClick={() => onSelect("search")}
          />
        </>
      ) : null}
      <MenuRow
        icon={Users}
        title="Medlemmar och inbjudningar"
        description="Medlemmar, roller och inbjudningar"
        onClick={() => onSelect("members")}
      />
      {showMaintenance ? (
        <MenuRow
          icon={Wrench}
          title="Matställen"
          description="Dolda sökträffar för gruppen"
          onClick={() => onSelect("maintenance")}
        />
      ) : null}
      {showProgression ? (
        <MenuRow
          icon={SlidersHorizontal}
          title="Besök och progression"
          description="Hur gruppens besök räknas"
          onClick={() => onSelect("progression")}
        />
      ) : null}
      {showStatus ? (
        <MenuRow
          icon={LogOut}
          title="Lämna eller hantera gruppen"
          description="Lämna, arkivera eller återaktivera"
          onClick={() => onSelect("status")}
        />
      ) : null}
    </Card>
  );
}

function MenuRow({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 w-full items-center gap-3 p-4 text-left outline-none transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function ProgressionSettingsSection({ groupId }: { groupId: string }) {
  const { state } = useStore();
  const { refreshGroups } = useSession();
  const [enabled, setEnabled] = React.useState(state.group.sharedVisitsCountForProgression ?? true);
  const [busy, setBusy] = React.useState(false);
  const saved = state.group.sharedVisitsCountForProgression ?? true;

  async function save() {
    setBusy(true);
    try {
      await updateGroupSettings(groupId, {
        name: state.group.name,
        emoji: state.group.emoji,
        homeLocation: null,
        sharedVisitsCountForProgression: enabled,
      });
      await refreshGroups();
      window.dispatchEvent(new CustomEvent("matrundan:reload"));
      toast.success("Progressionsinställningen är uppdaterad.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara inställningen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">Delade besök</h3>
      <Card className="space-y-3 rounded-2xl border-border/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <Label htmlFor="gs-share-counts" className="text-sm font-normal">
            Räkna delade besök i progression
          </Label>
          <Switch
            id="gs-share-counts"
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={busy}
          />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Delade besök syns alltid i historik, besöksstatus och betyg. Inställningen påverkar bara
          framtida nivåer och märken.
        </p>
        <div className="flex justify-end">
          <Button disabled={busy || enabled === saved} onClick={() => void save()}>
            {busy ? "Sparar…" : "Spara"}
          </Button>
        </div>
      </Card>
    </section>
  );
}

function GroupStatusSection() {
  const { state, archiveGroup, reactivateGroup, submitting } = useStore();
  const { refreshGroups } = useSession();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const archived = state.group.lifecycleStatus === "archived";

  async function archive() {
    try {
      await archiveGroup();
      await refreshGroups();
      toast.success("Gruppen är arkiverad.");
      setConfirmOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte arkivera gruppen.");
    }
  }

  async function reactivate() {
    try {
      await reactivateGroup();
      await refreshGroups();
      toast.success("Gruppen är återaktiverad.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte återaktivera gruppen.");
    }
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">Gruppstatus</h3>
      <Card className="rounded-2xl border-border/70 p-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {archived
            ? "Gruppen är arkiverad och skrivskyddad. Historiken finns kvar."
            : "Arkivering bevarar historiken men gör gruppen skrivskyddad tills den återaktiveras."}
        </p>
        {archived ? (
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            disabled={submitting}
            onClick={() => void reactivate()}
          >
            <ArchiveRestore className="h-4 w-4" /> Återaktivera gruppen
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="mt-3 text-destructive hover:text-destructive"
            disabled={submitting}
            onClick={() => setConfirmOpen(true)}
          >
            <Archive className="h-4 w-4" /> Arkivera gruppen
          </Button>
        )}
      </Card>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arkivera {state.group.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Historik, besök, ställen, betyg och kommentarer bevaras. Gruppen blir skrivskyddad,
              nästa stopp rensas och aktiva inbjudningar återkallas. Du kan återaktivera gruppen
              senare.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(event) => {
                event.preventDefault();
                void archive();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Arkivera gruppen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function InvitationAdministrationSection({ groupId }: { groupId: string }) {
  const [items, setItems] = React.useState<InvitationListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listGroupInvitations(groupId));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function revoke(id: string) {
    setBusyId(id);
    try {
      await revokeGroupInvitation(id);
      await load();
      toast.success("Inbjudan återkallad.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte återkalla.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">Inbjudningshistorik</h3>
      <Card className="rounded-2xl border-border/70 p-3">
        {loading ? (
          <div className="text-xs text-muted-foreground">Laddar…</div>
        ) : items.length === 0 ? (
          <div className="text-xs text-muted-foreground">Inga inbjudningar än.</div>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((item) => (
              <li key={item.id} className="flex min-w-0 items-center gap-2 py-2 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{invitationAdminLabel(item)}</div>
                  <div className="truncate text-muted-foreground">
                    {stateLabel(item.state)} · skickad av {item.invited_by_name || "medlem"} · går
                    ut {formatDate(item.expires_at)}
                  </div>
                </div>
                {item.state === "active" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === item.id}
                    onClick={() => void revoke(item.id)}
                  >
                    Återkalla
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

function invitationAdminLabel(item: InvitationListItem): string {
  if (item.invite_kind === "internal") {
    return item.invited_user_name?.trim() || "Matrundan-medlem";
  }
  if (item.invite_kind === "email") return item.invited_email?.trim() || "E-postinbjudan";
  return "Öppen inbjudningslänk";
}

function LeaveGroupSection({
  groupId,
  isOwner,
  onLeft,
}: {
  groupId: string;
  isOwner: boolean;
  onLeft: () => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function confirmLeave() {
    setBusy(true);
    try {
      await leaveGroup(groupId);
      await onLeft();
      toast.success("Du har lämnat gruppen.");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte lämna gruppen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">Lämna gruppen</h3>
      <Card className="rounded-2xl border-border/70 p-4">
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive"
          disabled={isOwner}
          onClick={() => setOpen(true)}
        >
          <LogOut className="h-4 w-4" /> Lämna gruppen
        </Button>
        {isOwner ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Som ägare kan du inte lämna gruppen förrän du har överfört ägarskapet.
          </p>
        ) : null}
      </Card>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lämna gruppen?</AlertDialogTitle>
            <AlertDialogDescription>
              Du förlorar åtkomsten direkt. Dina tidigare besök och betyg finns kvar i gruppen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmLeave()} disabled={busy}>
              {busy ? "Lämnar…" : "Lämna"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function stateLabel(state: InvitationListItem["state"]): string {
  switch (state) {
    case "active":
      return "Aktiv";
    case "accepted":
      return "Accepterad";
    case "declined":
      return "Avböjd";
    case "expired":
      return "Utgången";
    case "revoked":
      return "Återkallad";
  }
}
