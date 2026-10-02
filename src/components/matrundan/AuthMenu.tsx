import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Archive,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  FlaskConical,
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
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { AboutDialog } from "./AboutDialog";
import { StagingTestToolsDialog } from "./StagingTestToolsDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_ENVIRONMENT } from "@/lib/app-environment";
import { getPlaceMaintenanceAccess } from "@/lib/matrundan/place-maintenance";
import { EXAMPLE_IDS } from "@/lib/matrundan/example-scenarios";
import { getPersonalJourneyAttentionGroupIds } from "@/lib/matrundan/group-attention";
import { loadPersonalJourneyOverview } from "@/lib/matrundan/personal-journey";
import { DEMO_PERSONAL_JOURNEY_OVERVIEW } from "@/lib/matrundan/personal-journey-demo";
import { useSession, type UserGroupSummary } from "@/lib/matrundan/session";
import { canUseStagingTestTools } from "@/lib/matrundan/staging-test-tools";
import { APP_NAME } from "@/lib/matrundan/version";
import { toast } from "sonner";
import { AllGroupsDialog } from "./AllGroupsDialog";
import { ProfileDialog } from "./ProfileDialog";
import { openProductIntro } from "./ProductIntroDialog";
import { CreateGroupDialog } from "./CreateGroupDialog";
import { EmailAuthDialog } from "./EmailAuthDialog";
import {
  acceptGroupMemberInvitation,
  declineGroupMemberInvitation,
  type MyGroupInvitation,
} from "@/lib/matrundan/live-admin";
import {
  createPersonalJourneyReturnContext,
  getPersonalJourneyNavigationState,
  groupHomePath,
  isPersonalJourneyPath,
  personalJourneyDemoSearch,
} from "@/lib/matrundan/personal-journey-routes";

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

function AttentionDot() {
  return (
    <>
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-primary/70" />
      <span className="sr-only">Något väntar på dig</span>
    </>
  );
}

function GroupMenuItem({
  group,
  activeGroupId,
  hasAttention,
  onSelect,
}: {
  group: UserGroupSummary;
  activeGroupId: string | null;
  hasAttention: boolean;
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
      {hasAttention ? <AttentionDot /> : null}
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

function PersonalJourneyMenuItem({ onSelect }: { onSelect: () => void }) {
  return (
    <DropdownMenuItem onSelect={onSelect}>
      <Compass className="mr-2 h-4 w-4" />
      <span className="min-w-0 flex-1">
        <span className="block">Min matresa</span>
        <span className="block text-xs font-normal text-muted-foreground">
          Samlat från dina grupper
        </span>
      </span>
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
    pendingGroupInvitations: pendingInvites,
    refreshPendingGroupInvitations: refreshPendingInvites,
  } = useSession();
  const navigate = useNavigate();
  const location = useRouterState({ select: (state) => state.location });
  const personalJourney = isPersonalJourneyPath(location.pathname);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [allGroupsOpen, setAllGroupsOpen] = React.useState(false);
  const [emailCodeOpen, setEmailCodeOpen] = React.useState(false);
  const [testToolsOpen, setTestToolsOpen] = React.useState(false);
  const [recentGroupIds, setRecentGroupIds] = React.useState<string[]>([]);
  const [hasPlaceMaintenanceAccess, setHasPlaceMaintenanceAccess] = React.useState(false);
  const userId = user?.id ?? null;
  const showTestTools = canUseStagingTestTools({
    environment: APP_ENVIRONMENT,
    signedIn: Boolean(user),
    liveMode: mode === "live",
  });
  const attentionOverview = useQuery({
    queryKey: ["personal-journey", "overview", mode],
    enabled: mode === "demo" || (mode === "live" && Boolean(user)),
    retry: false,
    queryFn: () =>
      mode === "demo"
        ? Promise.resolve(DEMO_PERSONAL_JOURNEY_OVERVIEW)
        : loadPersonalJourneyOverview(),
  });
  const attentionGroupIds = React.useMemo(
    () => getPersonalJourneyAttentionGroupIds(attentionOverview.data),
    [attentionOverview.data],
  );
  const hasAttention = attentionGroupIds.size > 0;

  React.useEffect(() => {
    if (typeof window === "undefined" || mode !== "live") return;
    const refreshAttention = () => void attentionOverview.refetch();
    window.addEventListener("matrundan:reload", refreshAttention);
    return () => window.removeEventListener("matrundan:reload", refreshAttention);
  }, [attentionOverview.refetch, mode]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const openInvitations = () => {
      setAllGroupsOpen(true);
      void refreshPendingInvites();
    };
    window.addEventListener("matrundan:open-group-invitations", openInvitations);
    return () => window.removeEventListener("matrundan:open-group-invitations", openInvitations);
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

  function openPersonalJourney() {
    const existing = getPersonalJourneyNavigationState(location.state);
    const returnContext = personalJourney
      ? existing.returnContext
      : createPersonalJourneyReturnContext(location.href, activeGroupId);
    void navigate({
      to: "/min-matresa",
      search: personalJourneyDemoSearch(mode),
      state: (previous) => ({
        ...previous,
        personalJourney: returnContext ? { returnContext } : undefined,
      }),
    });
  }

  function openGroup(groupId: string) {
    selectGroup(groupId);
    if (personalJourney) {
      void navigate({
        to: groupHomePath(exampleMode),
        state: (previous) => ({ ...previous, personalJourney: undefined }),
      });
    }
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
              aria-label={`Profil och grupp: ${groupName}${hasAttention ? ". Något väntar på dig" : ""}`}
              className="max-w-[10.5rem] min-w-0 rounded-full px-3 sm:max-w-[14rem]"
            >
              <span className="shrink-0">{groupEmoji}</span>
              <span className="min-w-0 flex-1 truncate">{groupName}</span>
              {hasAttention ? <AttentionDot /> : null}
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
                <PersonalJourneyMenuItem onSelect={openPersonalJourney} />
                {personalJourney ? (
                  <DropdownMenuItem
                    onSelect={() =>
                      void navigate({
                        to: "/exempel",
                        state: (previous) => ({ ...previous, personalJourney: undefined }),
                      })
                    }
                  >
                    <span className="mr-2">{suppliedGroupEmoji ?? "🍽️"}</span>
                    <span className="min-w-0 flex-1">Öppna exempelgruppen</span>
                    {attentionGroupIds.has(EXAMPLE_IDS.group) ? <AttentionDot /> : null}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
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
            <DropdownMenuItem onSelect={openProductIntro}>
              <CircleHelp className="mr-2 h-4 w-4" />
              Så funkar Matrundan
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
            aria-label={`Profil och grupp: ${groupName}${hasAttention ? ". Något väntar på dig" : ""}`}
            className="max-w-[10.5rem] min-w-0 rounded-full px-3 sm:max-w-[14rem] md:max-w-[18rem]"
          >
            <span className="shrink-0">{groupEmoji}</span>
            <span className="min-w-0 flex-1 truncate">{groupName}</span>
            {hasAttention ? <AttentionDot /> : null}
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
          {activeGroupId || mode === "demo" ? (
            <DropdownMenuItem onSelect={openProductIntro}>
              <CircleHelp className="mr-2 h-4 w-4" />
              Så funkar Matrundan
            </DropdownMenuItem>
          ) : null}
          {showTestTools ? (
            <DropdownMenuItem onSelect={() => setTestToolsOpen(true)}>
              <FlaskConical className="mr-2 h-4 w-4" />
              Testverktyg
            </DropdownMenuItem>
          ) : null}
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
          {exampleMode || mode === "live" ? (
            <>
              <DropdownMenuSeparator />
              <PersonalJourneyMenuItem onSelect={openPersonalJourney} />
            </>
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
                  hasAttention={attentionGroupIds.has(group.id)}
                  onSelect={openGroup}
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
        attentionGroupIds={attentionGroupIds}
        onSelect={openGroup}
        onSelectPersonalJourney={openPersonalJourney}
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
      <StagingTestToolsDialog open={testToolsOpen} onOpenChange={setTestToolsOpen} />
      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
