import * as React from "react";
import {
  Archive,
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
import { useSession, type UserGroupSummary } from "@/lib/matrundan/session";
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

export function AuthMenu() {
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

  if (!user) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="rounded-full"
        onClick={async () => {
          try {
            await signInWithGoogle();
          } catch {
            toast.error("Kunde inte starta Google-inloggning.");
          }
        }}
      >
        <LogIn className="mr-1.5 h-4 w-4" />
        Logga in
      </Button>
    );
  }

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    "Inloggad";
  const activeGroups = userGroups.filter((g) => g.lifecycleStatus === "active");
  const archivedGroups = userGroups.filter(
    (g) => g.lifecycleStatus === "archived",
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
              {activeGroups.map((g) => (
                <GroupMenuItem
                  key={g.id}
                  group={g}
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
              {archivedGroups.map((g) => (
                <GroupMenuItem
                  key={g.id}
                  group={g}
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
      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
