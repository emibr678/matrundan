import * as React from "react";
import {
  Archive,
  ArchiveRestore,
  LogIn,
  LogOut,
  User as UserIcon,
  Plus,
  UserCog,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useSession, type UserGroupSummary } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
import { toast } from "sonner";
import { ProfileDialog } from "./ProfileDialog";
import { CreateGroupDialog } from "./CreateGroupDialog";

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

function GroupLifecycleActions() {
  const { state, archiveGroup, reactivateGroup, submitting } = useStore();
  const {
    mode,
    activeGroupRole,
    activeGroupLifecycleStatus,
    refreshGroups,
  } = useSession();
  const [confirmArchive, setConfirmArchive] = React.useState(false);
  const ownRole = state.members.find(
    (member) => member.id === state.currentUserId,
  )?.role;
  const owner = activeGroupRole === "owner" || ownRole === "ägare";
  const archived =
    state.group.lifecycleStatus === "archived" ||
    activeGroupLifecycleStatus === "archived";

  if (!owner) return null;

  async function run(action: "archive" | "reactivate") {
    try {
      if (action === "archive") await archiveGroup();
      else await reactivateGroup();
      if (mode === "live") await refreshGroups();
      toast.success(
        action === "archive"
          ? "Gruppen är arkiverad."
          : "Gruppen är återaktiverad.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte uppdatera gruppen.",
      );
    }
  }

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
        Gruppadministration
      </DropdownMenuLabel>
      {archived ? (
        <DropdownMenuItem
          disabled={submitting}
          onSelect={() => void run("reactivate")}
        >
          <ArchiveRestore className="mr-2 h-4 w-4" />
          Återaktivera gruppen
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem
          disabled={submitting}
          className="text-destructive focus:text-destructive"
          onSelect={() => setConfirmArchive(true)}
        >
          <Archive className="mr-2 h-4 w-4" />
          Arkivera gruppen
        </DropdownMenuItem>
      )}

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arkivera {state.group.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Historik, besök, ställen, betyg och kommentarer bevaras. Gruppen
              blir skrivskyddad, nästa stopp rensas och aktiva inbjudningar
              återkallas. Du kan återaktivera gruppen senare.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void run("archive")}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Arkivera gruppen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function AuthMenu({
  showGroupActions = false,
}: {
  showGroupActions?: boolean;
}) {
  const {
    user,
    mode,
    userGroups,
    activeGroupId,
    selectGroup,
    signInWithGoogle,
    signOut,
    refreshGroups,
  } = useSession();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);

  async function signIn() {
    try {
      await signInWithGoogle();
    } catch {
      toast.error("Kunde inte starta Google-inloggning.");
    }
  }

  if (!user && !showGroupActions) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="rounded-full"
        onClick={() => void signIn()}
      >
        <LogIn className="mr-1.5 h-4 w-4" />
        Logga in
      </Button>
    );
  }

  if (!user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="rounded-full">
            <UserIcon className="mr-1.5 h-4 w-4" />
            Demo
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Demo-läge</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => void signIn()}>
            <LogIn className="mr-2 h-4 w-4" />
            Logga in med Google
          </DropdownMenuItem>
          <GroupLifecycleActions />
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    "Inloggad";
  const activeGroups = userGroups.filter(
    (group) => group.lifecycleStatus === "active",
  );
  const archivedGroups = userGroups.filter(
    (group) => group.lifecycleStatus === "archived",
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="rounded-full">
            <UserIcon className="mr-1.5 h-4 w-4" />
            <span className="max-w-[10rem] truncate">{displayName}</span>
            {mode === "demo" ? (
              <span className="ml-2 rounded-full bg-mustard/40 px-1.5 py-0.5 text-[10px] font-medium">
                demo
              </span>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
            <UserCog className="mr-2 h-4 w-4" />
            Min profil
          </DropdownMenuItem>
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
          {showGroupActions ? <GroupLifecycleActions /> : null}
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
      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
