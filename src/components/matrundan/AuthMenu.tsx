import * as React from "react";
import { LogIn, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/lib/matrundan/session";
import { toast } from "sonner";

export function AuthMenu() {
  const { user, mode, userGroups, activeGroupId, selectGroup, signInWithGoogle, signOut } =
    useSession();

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

  return (
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
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
        {userGroups.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
              Byt grupp
            </DropdownMenuLabel>
            {userGroups.map((g) => (
              <DropdownMenuItem
                key={g.id}
                onSelect={() => selectGroup(g.id)}
                className={g.id === activeGroupId ? "font-semibold" : undefined}
              >
                <span className="mr-2">{g.emoji ?? "🍽️"}</span>
                {g.name}
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          Logga ut
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
