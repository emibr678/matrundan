import * as React from "react";
import {
  Archive,
  ChevronDown,
  Home,
  Info,
  LogIn,
  LogOut,
  Mail,
  Plus,
  UserCog,
  Wrench,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { AboutContent } from "./AboutContent";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ProfileDialog } from "./ProfileDialog";
import { CreateGroupDialog } from "./CreateGroupDialog";
import { EmailAuthDialog } from "./EmailAuthDialog";

function AboutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Om {APP_NAME}</DialogTitle>
          <DialogDescription>Om appen, aktuell version och tidigare uppdateringar.</DialogDescription>
        </DialogHeader>
        <AboutContent />
      </DialogContent>
    </Dialog>
  );
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
  return (
    <DropdownMenuItem
      onSelect={() => onSelect(group.id)}
      className={group.id === activeGroupId ? "font-semibold" : undefined}
    >
      <span className="mr-2">{group.emoji ?? "🍽️"}</span>
      <span className="min-w-0 flex-1 truncate">{group.name}</span>
      {archived ? (
        <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <Archive className="h-3 w-3" /> arkiverad
        </span>
      ) : group.role !== "member" ? (
        <span className="ml-2 text-[10px] uppercase text-muted-foreground">
          {group.role === "owner" ? "ägare" : "admin"}
        </span>
      ) : null}
    </DropdownMenuItem>
  );
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
  const [emailCodeOpen, setEmailCodeOpen] = React.useState(false);
  const [hasPlaceMaintenanceAccess, setHasPlaceMaintenanceAccess] = React.useState(false);

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
  const activeGroups = userGroups.filter((group) => group.lifecycleStatus === "active");
  const archivedGroups = userGroups.filter((group) => group.lifecycleStatus === "archived");
  const activeGroup = userGroups.find((group) => group.id === activeGroupId);
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
          {hasPlaceMaintenanceAccess ? (
            <DropdownMenuItem onSelect={() => void navigate({ to: "/platsunderhall" })}>
              <Wrench className="mr-2 h-4 w-4" />
              Platsunderhåll
            </DropdownMenuItem>
          ) : null}
          {activeGroups.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                Aktiva grupper
              </DropdownMenuLabel>
              {activeGroups.map((group) => (
                <GroupMenuItem
                  key={group.id}
                  group={group}
                  activeGroupId={activeGroupId}
                  onSelect={selectGroup}
                />
              ))}
            </>
          ) : null}
          {archivedGroups.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                Arkiverade grupper
              </DropdownMenuLabel>
              {archivedGroups.map((group) => (
                <GroupMenuItem
                  key={group.id}
                  group={group}
                  activeGroupId={activeGroupId}
                  onSelect={selectGroup}
                />
              ))}
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
      <ProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        onSaved={() => void refreshGroups()}
      />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
