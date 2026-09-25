import * as React from "react";
import {
  Archive,
  Check,
  ChevronDown,
  Home,
  Info,
  List,
  LogIn,
  LogOut,
  Mail,
  Plus,
  UserCog,
  UserPlus,
  Wrench,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { AboutDialog } from "./AboutDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getPlaceMaintenanceAccess } from "@/lib/matrundan/place-maintenance";
import { useSession, type UserGroupSummary } from "@/lib/matrundan/session";
import { APP_NAME } from "@/lib/matrundan/version";
import { toast } from "sonner";
import { AllGroupsDialog } from "./AllGroupsDialog";
import { GroupInviteDialog } from "./GroupInviteDialog";
import { ProfileDialog } from "./ProfileDialog";
import { CreateGroupDialog } from "./CreateGroupDialog";
import { EmailAuthDialog } from "./EmailAuthDialog";
import {
  acceptGroupMemberInvitation,
  declineGroupMemberInvitation,
  listMyGroupInvitations,
  type MyGroupInvitation,
} from "@/lib/matrundan/live-admin";

const QUICK_GROUP_LIMIT = 4;
const RECENT_GROUPS_KEY_PREFIX = "matrundan.recentGroups.v1:";

function recentGroupsStorageKey(userId: string) {
  return `${RECENT_GROUPS_KEY_PREFIX}${userId}`;
}

function readRecentGroupIds(userId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(recentGroupsStorageKey(userId)) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function GroupMenuItem({
  group,
  activeGroupId,
  onSelect,
}: {
  group: UserGroupSummary;
  activeGroupId: string | null;
  onSelect: (groupId: string) => void;
}) {
  const archived = group.lifecycleStatus === "archived";
  const current = group.id === activeGroupId;

  return (
    <DropdownMenuItem
      onSelect={() => onSelect(group.id)}
      className={current ? "font-semibold" : undefined}
    >
      <span className="mr-2 shrink-0">{group.emoji ?? "🍽️"}</span>
      <span className="min-w-0 flex-1 truncate">{group.name}</span>
      {archived ? (
        <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <Archive className="h-3 w-3" /> arkiverad
        </span>
      ) : current ? (
        <Check className="ml-2 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      ) : null}
    </DropdownMenuItem>
  );
}

function buildQuickGroups(
  groups: UserGroupSummary[],
  activeGroupId: string | null,
  recentGroupIds: string[],
) {
  const activeGroups = groups.filter((group) => group.lifecycleStatus === "active");
  const currentGroup = groups.find((group) => group.id === activeGroupId) ?? null;

  if (currentGroup?.lifecycleStatus === "active" && activeGroups.length <= QUICK_GROUP_LIMIT) {
    return activeGroups;
  }

  const candidates = [
    ...(currentGroup ? [currentGroup] : []),
    ...recentGroupIds
      .map((id) => activeGroups.find((group) => group.id === id))
      .filter((group): group is UserGroupSummary => Boolean(group)),
    ...activeGroups,
  ];

  const seen = new Set<string>();
  return candidates
    .filter((group) => {
      if (group.lifecycleStatus === "archived" && group.id !== activeGroupId) return false;
      if (seen.has(group.id)) return false;
      seen.add(group.id);
      return true;
    })
    .slice(0, QUICK_GROUP_LIMIT);
}

export function AuthMenu({
  exampleMode = false,
  groupName: suppliedGroupName,
  groupEmoji: suppliedGroupEmoji,
  groupLifecycleStatus: suppliedGroupLifecycleStatus = "active",
}: {
  exampleMode?: boolean;
  groupName?: string;
  groupEmoji?: string | null;
  groupLifecycleStatus?: "active" | "archived";
}) {
  const {
    user,
    mode,
    userGroups,
    activeGroupId,
    selectGroup,
    signInWithGoogle,
    signOut,
    exitExampleMode,
    refreshGroups,
  } = useSession();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [allGroupsOpen, setAllGroupsOpen] = React.useState(false);
  const [emailCodeOpen, setEmailCodeOpen] = React.useState(false);
  const [recentGroupIds, setRecentGroupIds] = React.useState<string[]>([]);
  const [hasPlaceMaintenanceAccess, setHasPlaceMaintenanceAccess] = React.useState(false);
  const [pendingInvites, setPendingInvites] = React.useState<MyGroupInvitation[]>([]);
  const [createdGroupInvite, setCreatedGroupInvite] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const userId = user?.id ?? null;

  const refreshPendingInvites = React.useCallback(async () => {
    if (!user || mode !== "live") {
      setPendingInvites([]);
      return;
    }
    try {
      setPendingInvites(await listMyGroupInvitations());
    } catch (error) {
      console.error("[Matrundan] kunde inte läsa gruppinbjudningar:", error);
      setPendingInvites([]);
    }
  }, [mode, user]);

  React.useEffect(() => {
    void refreshPendingInvites();
  }, [refreshPendingInvites]);

  React.useEffect(() => {
    if (!userId) {
      setRecentGroupIds([]);
      return;
    }
    setRecentGroupIds(readRecentGroupIds(userId));
  }, [userId]);

  React.useEffect(() => {
    if (!userId || !activeGroupId) return;
    setRecentGroupIds((current) => {
      const next = [activeGroupId, ...current.filter((id) => id !== activeGroupId)].slice(0, 8);
      try {
        window.localStorage.setItem(recentGroupsStorageKey(userId), JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [activeGroupId, userId]);

  React.useEffect(() => {
    let cancelled = false;
    if (!user || mode !== "live") {
      setHasPlaceMaintenanceAccess(false);
      return () => {
        cancelled = true;
      };
    }

    void getPlaceMaintenanceAccess()
      .then((allowed) => {
        if (!cancelled) setHasPlaceMaintenanceAccess(allowed);
      })
      .catch(() => {
        // En saknad/odriftsatt maintenance-RPC ska inte störa vanlig navigation.
        if (!cancelled) setHasPlaceMaintenanceAccess(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, user]);

  async function signIn() {
    try {
      await signInWithGoogle();
    } catch {
      toast.error("Kunde inte starta Google-inloggning.");
    }
  }

  async function acceptPendingInvitation(invitation: MyGroupInvitation) {
    const result = await acceptGroupMemberInvitation(invitation.id);
    await refreshGroups();
    selectGroup(result.group_id);
    await refreshPendingInvites();
    toast.success("Du är nu med i " + invitation.group_name + ".");
  }

  async function declinePendingInvitation(invitation: MyGroupInvitation) {
    await declineGroupMemberInvitation(invitation.id);
    await refreshPendingInvites();
    toast.success("Inbjudan avböjd.");
  }

  if (!user && mode !== "demo") {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="rounded-full">
              <LogIn className="mr-1.5 h-4 w-4" />
              Logga in
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem onSelect={() => void signIn()}>
              <LogIn className="mr-2 h-4 w-4" />
              Fortsätt med Google
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setEmailCodeOpen(true)}>
              <Mail className="mr-2 h-4 w-4" />
              Fortsätt med e-post
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setAboutOpen(true)}>
              <Info className="mr-2 h-4 w-4" />
              Om {APP_NAME}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <EmailAuthDialog open={emailCodeOpen} onOpenChange={setEmailCodeOpen} />
        <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      </>
    );
  }

  if (!user) {
    const groupName = suppliedGroupName || (exampleMode ? "Exempelgrupp" : "Demo");
    const groupEmoji = suppliedGroupEmoji ?? "🍽️";
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              aria-label={`Profil och grupp: ${groupName}`}
              className="max-w-[10.5rem] min-w-0 rounded-full px-3 sm:max-w-[14rem]"
            >
              <span className="shrink-0">{groupEmoji}</span>
              <span className="min-w-0 flex-1 truncate">{groupName}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>
              <div className="truncate">{groupName}</div>
              <div className="text-xs font-normal text-muted-foreground">
                {exampleMode ? "Exempelgrupp" : "Demo-läge"}
              </div>
            </DropdownMenuLabel>
            {exampleMode ? (
              <>
                <DropdownMenuItem onSelect={exitExampleMode}>
                  <Home className="mr-2 h-4 w-4" />
                  Till startsidan
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem onSelect={() => void signIn()}>
              <LogIn className="mr-2 h-4 w-4" />
              Logga in med Google
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setEmailCodeOpen(true)}>
              <Mail className="mr-2 h-4 w-4" />
              Logga in med e-post
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setAboutOpen(true)}>
              <Info className="mr-2 h-4 w-4" />
              Om {APP_NAME}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <EmailAuthDialog open={emailCodeOpen} onOpenChange={setEmailCodeOpen} />
        <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      </>
    );
  }

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    "Inloggad";
  const displayEmail = user.email && user.email !== displayName ? user.email : null;
  const activeGroup = userGroups.find((group) => group.id === activeGroupId);
  const activeGroupCount = userGroups.filter((group) => group.lifecycleStatus === "active").length;
  const hasArchivedGroups = userGroups.some((group) => group.lifecycleStatus === "archived");
  const quickGroups = buildQuickGroups(userGroups, activeGroupId, recentGroupIds);
  const showAllGroups = activeGroupCount > QUICK_GROUP_LIMIT || hasArchivedGroups;
  const useSuppliedGroup = exampleMode || mode === "demo" || !activeGroup;
  const groupName = useSuppliedGroup
    ? (suppliedGroupName ?? activeGroup?.name ?? "Grupp")
    : activeGroup.name;
  const groupEmoji = useSuppliedGroup
    ? (suppliedGroupEmoji ?? activeGroup?.emoji ?? "🍽️")
    : (activeGroup.emoji ?? "🍽️");
  const groupArchived = useSuppliedGroup
    ? suppliedGroupLifecycleStatus === "archived"
    : activeGroup.lifecycleStatus === "archived";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            aria-label={`Profil och grupp: ${groupName}`}
            className="max-w-[10.5rem] min-w-0 rounded-full px-3 sm:max-w-[14rem] md:max-w-[18rem]"
          >
            <span className="shrink-0">{groupEmoji}</span>
            <span className="min-w-0 flex-1 truncate">{groupName}</span>
            {groupArchived ? (
              <Archive className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : null}
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>
            <div className="text-xs font-normal text-muted-foreground">Inloggad som</div>
            <div className="truncate">{displayName}</div>
            {displayEmail ? (
              <div className="truncate text-xs font-normal text-muted-foreground">
                {displayEmail}
              </div>
            ) : null}
          </DropdownMenuLabel>
          {exampleMode ? (
            <>
              <DropdownMenuItem onSelect={exitExampleMode}>
                <Home className="mr-2 h-4 w-4" />
                Till startsidan
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
            <UserCog className="mr-2 h-4 w-4" />
            Min profil
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAboutOpen(true)}>
            <Info className="mr-2 h-4 w-4" />
            Om {APP_NAME}
          </DropdownMenuItem>
          {pendingInvites.length > 0 ? (
            <DropdownMenuItem onSelect={() => setAllGroupsOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              <span className="flex-1">Inbjudningar</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {pendingInvites.length}
              </span>
            </DropdownMenuItem>
          ) : null}
          {hasPlaceMaintenanceAccess ? (
            <DropdownMenuItem onSelect={() => void navigate({ to: "/platsunderhall" })}>
              <Wrench className="mr-2 h-4 w-4" />
              Platsunderhåll
            </DropdownMenuItem>
          ) : null}
          {quickGroups.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                Byt grupp
              </DropdownMenuLabel>
              {quickGroups.map((group) => (
                <GroupMenuItem
                  key={group.id}
                  group={group}
                  activeGroupId={activeGroupId}
                  onSelect={selectGroup}
                />
              ))}
              {showAllGroups ? (
                <DropdownMenuItem onSelect={() => setAllGroupsOpen(true)}>
                  <List className="mr-2 h-4 w-4" />
                  Alla grupper
                </DropdownMenuItem>
              ) : null}
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Skapa ny grupp
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() =>
              void (async () => {
                try {
                  await signOut();
                  navigate({ to: "/" });
                } catch {
                  toast.error("Kunde inte logga ut.");
                }
              })()
            }
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logga ut
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AllGroupsDialog
        open={allGroupsOpen}
        onOpenChange={setAllGroupsOpen}
        groups={userGroups}
        activeGroupId={activeGroupId}
        onSelect={selectGroup}
        invitations={pendingInvites}
        onAcceptInvitation={acceptPendingInvitation}
        onDeclineInvitation={declinePendingInvitation}
      />
      <ProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        onSaved={() => void refreshGroups()}
      />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <CreateGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onInviteCreatedGroup={(group) => setCreatedGroupInvite(group)}
      />
      {createdGroupInvite ? (
        <GroupInviteDialog
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setCreatedGroupInvite(null);
          }}
          groupId={createdGroupInvite.id}
          groupName={createdGroupInvite.name}
        />
      ) : null}
    </>
  );
}
