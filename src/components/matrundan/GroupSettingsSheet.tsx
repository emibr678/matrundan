import * as React from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ChevronRight,
  Copy,
  LogOut,
  Mail,
  RotateCcw,
  Search,
  Settings,
  Share2,
  SlidersHorizontal,
  Users,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { GroupBasicsSettingsSection } from "@/components/matrundan/GroupBasicsSettingsSection";
import { GroupSearchSettingsSection } from "@/components/matrundan/GroupSearchSettingsSection";
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
import { Input } from "@/components/ui/input";
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
  createGroupInvitation,
  leaveGroup,
  listGroupInvitations,
  revokeGroupInvitation,
  updateGroupSettings,
  type InvitationListItem,
} from "@/lib/matrundan/live-admin";
import { useSession } from "@/lib/matrundan/session";
import { formatDate, useStore } from "@/lib/matrundan/store";
import { APP_NAME } from "@/lib/matrundan/version";

type SettingsView =
  | "menu"
  | "group"
  | "search"
  | "members"
  | "places"
  | "progression"
  | "status";

const VIEW_COPY: Record<SettingsView, { title: string; description: string }> = {
  menu: {
    title: "Gruppinställningar",
    description: "Välj vad du vill hantera i den här gruppen.",
  },
  group: {
    title: "Gruppen",
    description: "Namn och symbol för gruppen.",
  },
  search: {
    title: "Sökområden",
    description: "Områden ni ofta söker i.",
  },
  members: {
    title: "Medlemmar och inbjudningar",
    description: "Se medlemmar och hantera roller eller inbjudningar när du har behörighet.",
  },
  places: {
    title: "Matställen",
    description: "Dolda sökträffar för den här gruppen.",
  },
  progression: {
    title: "Besök och progression",
    description: "Hur gruppens delade besök räknas.",
  },
  status: {
    title: "Gruppstatus",
    description: "Lämna, arkivera eller återaktivera gruppen när din roll tillåter det.",
  },
};

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
  const canEditGroupSettings = isAdmin && Boolean(activeGroupId);
  const canConfigureProgression = isAdmin && Boolean(activeGroupId);
  const canOpenStatus = isLive || mode === "demo";

  function viewCanBeDirty(current: SettingsView): boolean {
    return current === "group" || current === "search";
  }

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
              showGroupAndSearch={canEditGroupSettings}
              showPlaces={canMaintainPlaces}
              showProgression={canConfigureProgression}
              showStatus={canOpenStatus}
              onSelect={changeView}
            />
          ) : null}

          {view === "group" && isAdmin && activeGroupId ? (
            <GroupBasicsSettingsSection
              groupId={activeGroupId}
              initialName={state.group.name}
              initialEmoji={state.group.emoji}
              onDirtyChange={setSettingsDirty}
            />
          ) : null}

          {view === "search" && isAdmin && activeGroupId ? (
            <GroupSearchSettingsSection
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
              {isAdmin && activeGroupId ? <InvitationsSection groupId={activeGroupId} /> : null}
            </>
          ) : null}

          {view === "places" && canMaintainPlaces ? <HiddenPlaceSuggestionsSection /> : null}

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
  showGroupAndSearch,
  showPlaces,
  showProgression,
  showStatus,
  onSelect,
}: {
  showGroupAndSearch: boolean;
  showPlaces: boolean;
  showProgression: boolean;
  showStatus: boolean;
  onSelect: (view: SettingsView) => void;
}) {
  return (
    <Card className="divide-y divide-border/60 rounded-2xl border-border/70 p-0">
      {showGroupAndSearch ? (
        <>
          <MenuRow
            icon={Settings}
            title="Gruppen"
            description="Namn och symbol för gruppen"
            onClick={() => onSelect("group")}
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
        description="Medlemmar, roller och inbjudningslänkar"
        onClick={() => onSelect("members")}
      />
      {showPlaces ? (
        <MenuRow
          icon={Wrench}
          title="Matställen"
          description="Dolda sökträffar att hantera"
          onClick={() => onSelect("places")}
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
          icon={Archive}
          title="Gruppstatus"
          description="Lämna, arkivera eller återaktivera gruppen"
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

function InvitationsSection({ groupId }: { groupId: string }) {
  const [email, setEmail] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [lastLink, setLastLink] = React.useState<string | null>(null);
  const [lastEmail, setLastEmail] = React.useState<string | null>(null);
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

  async function createInvite(withEmail: boolean) {
    setCreating(true);
    try {
      const trimmed = email.trim();
      const invitation = await createGroupInvitation(
        groupId,
        withEmail && trimmed ? trimmed : null,
      );
      const link = `${window.location.origin}/inbjudan/${invitation.token}`;
      setLastLink(link);
      setLastEmail(withEmail && trimmed ? trimmed : null);
      if (withEmail) setEmail("");
      toast.success("Inbjudan skapad – kopiera länken nu.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte skapa inbjudan.");
    } finally {
      setCreating(false);
    }
  }

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

  async function copyLink() {
    if (!lastLink) return;
    try {
      await navigator.clipboard.writeText(lastLink);
      toast.success("Länk kopierad");
    } catch {
      toast.error("Kunde inte kopiera");
    }
  }

  function shareLink() {
    if (!lastLink) return;
    const data: ShareData = {
      title: APP_NAME,
      text: `Häng med i gruppen på ${APP_NAME}.`,
      url: lastLink,
    };
    if ("share" in navigator) void navigator.share(data).catch(() => {});
    else void copyLink();
  }

  function openMailClient() {
    if (!lastLink || !lastEmail) return;
    const subject = encodeURIComponent(`Inbjudan till ${APP_NAME}`);
    const body = encodeURIComponent(
      `Hej!\n\nJag vill bjuda in dig till vår grupp i ${APP_NAME}.\nGå med här: ${lastLink}\n\nLänken gäller i sju dagar och kan bara användas en gång.`,
    );
    window.location.href = `mailto:${lastEmail}?subject=${subject}&body=${body}`;
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">Bjud in</h3>
      <Card className="space-y-3 rounded-2xl border-border/70 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="inv-email">E-post (valfritt)</Label>
          <Input
            id="inv-email"
            type="email"
            placeholder="vän@example.se"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Öppen länk: flera personer kan använda den tills den återkallas eller går ut. Med
            e-post: bara den adressen kan använda länken, och länken gäller en gång.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => void createInvite(false)} disabled={creating}>
            Skapa öppen länk
          </Button>
          <Button onClick={() => void createInvite(true)} disabled={creating || !email.trim()}>
            <Mail className="mr-1 h-4 w-4" /> Skapa för e-post
          </Button>
        </div>
        {lastLink ? (
          <div className="rounded-xl border border-border/70 bg-muted/40 p-3 text-sm">
            <div className="mb-2 text-xs font-medium">Din inbjudningslänk – visas bara nu</div>
            <div className="break-all rounded-md bg-background p-2 text-xs">{lastLink}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void copyLink()}>
                <Copy className="h-4 w-4" /> Kopiera
              </Button>
              <Button size="sm" variant="outline" onClick={shareLink}>
                <Share2 className="h-4 w-4" /> Dela…
              </Button>
              {lastEmail ? (
                <Button size="sm" onClick={openMailClient}>
                  <Mail className="h-4 w-4" /> Öppna e-post
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            Aktiva och nyligen använda inbjudningar
          </div>
          {loading ? (
            <div className="text-xs text-muted-foreground">Laddar…</div>
          ) : items.length === 0 ? (
            <div className="text-xs text-muted-foreground">Inga inbjudningar än.</div>
          ) : (
            <ul className="divide-y divide-border/60 rounded-xl border border-border/70">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-2 p-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{item.invited_email ?? "Öppen länk"}</div>
                    <div className="text-muted-foreground">
                      {stateLabel(item.state)} · går ut {formatDate(item.expires_at)}
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
        </div>
      </Card>
    </section>
  );
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
      return "Använd";
    case "expired":
      return "Utgången";
    case "revoked":
      return "Återkallad";
  }
}
