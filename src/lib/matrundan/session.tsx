/**
 * Sessions- och läges-hantering för Matrundan.
 *
 * Filtrerar grupper på aktivt medlemskap och hanterar pending invite path
 * genom OAuth-flödet via sessionStorage.
 */
import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export type AppMode = "demo" | "live";
export type GroupRole = "owner" | "admin" | "member";

export interface UserGroupSummary {
  id: string;
  name: string;
  emoji: string | null;
  role: GroupRole;
}

interface SessionState {
  loading: boolean;
  user: User | null;
  session: Session | null;
  mode: AppMode;
  needsOnboarding: boolean;
  activeGroupId: string | null;
  activeGroupRole: GroupRole | null;
  userGroups: UserGroupSummary[];
  signInWithGoogle: (opts?: { redirectPath?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  selectGroup: (groupId: string) => void;
  refreshGroups: () => Promise<void>;
}

const SessionContext = React.createContext<SessionState | null>(null);
const ACTIVE_GROUP_KEY = "matrundan.activeGroup.v1";
const PENDING_INVITE_KEY = "matrundan.pendingInvite.v1";

function useForceDemo(): boolean {
  return React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("demo") === "1";
  }, []);
}

export function setPendingInvitePath(path: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PENDING_INVITE_KEY, path);
  } catch {
    /* ignore */
  }
}

export function consumePendingInvitePath(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.sessionStorage.getItem(PENDING_INVITE_KEY);
    if (v) window.sessionStorage.removeItem(PENDING_INVITE_KEY);
    return v;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const forceDemo = useForceDemo();
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [userGroups, setUserGroups] = React.useState<UserGroupSummary[]>([]);
  const [activeGroupId, setActiveGroupId] = React.useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(ACTIVE_GROUP_KEY);
  });

  const loadGroups = React.useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setUserGroups([]);
      return;
    }
    const { data, error } = await supabase
      .from("memberships")
      .select("group_id, role, status, groups(id, name, emoji)")
      .eq("user_id", uid)
      .eq("status", "active");
    if (error) {
      console.error("[Matrundan] kunde inte läsa medlemskap:", error);
      setUserGroups([]);
      return;
    }
    const groups: UserGroupSummary[] = (data ?? [])
      .map((row) => {
        const g = (row as { groups: { id: string; name: string; emoji: string | null } | null }).groups;
        const role = (row as { role: string }).role as GroupRole;
        return g ? { id: g.id, name: g.name, emoji: g.emoji, role } : null;
      })
      .filter((g): g is UserGroupSummary => g !== null);
    setUserGroups(groups);
    setActiveGroupId((current) => {
      if (current && groups.some((g) => g.id === current)) return current;
      const first = groups[0]?.id ?? null;
      if (first && typeof window !== "undefined") {
        window.localStorage.setItem(ACTIVE_GROUP_KEY, first);
      } else if (!first && typeof window !== "undefined") {
        window.localStorage.removeItem(ACTIVE_GROUP_KEY);
      }
      return first;
    });
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (cancelled) return;
      setSession(s);
      if (s?.user) {
        void loadGroups(s.user.id);
      } else {
        setUserGroups([]);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      if (data.session?.user) {
        void loadGroups(data.session.user.id);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadGroups]);

  const selectGroup = React.useCallback((groupId: string) => {
    setActiveGroupId(groupId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_GROUP_KEY, groupId);
    }
  }, []);

  const signInWithGoogle = React.useCallback(
    async (opts?: { redirectPath?: string }) => {
      const origin =
        typeof window !== "undefined" ? window.location.origin : undefined;
      // Bevara ev. pending invite via sessionStorage-fallback.
      if (opts?.redirectPath) setPendingInvitePath(opts.redirectPath);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: origin,
      });
      if (result.error) {
        console.error("[Matrundan] Google-inloggning misslyckades:", result.error);
        throw result.error;
      }
    },
    [],
  );

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACTIVE_GROUP_KEY);
    }
    setActiveGroupId(null);
    setUserGroups([]);
  }, []);


  const refreshGroups = React.useCallback(async () => {
    await loadGroups(session?.user?.id);
  }, [loadGroups, session?.user?.id]);

  const value = React.useMemo<SessionState>(() => {
    const user = session?.user ?? null;
    const isLive = !forceDemo && !!user;
    const activeRole =
      userGroups.find((g) => g.id === activeGroupId)?.role ?? null;
    return {
      loading,
      user,
      session,
      mode: isLive ? "live" : "demo",
      needsOnboarding: isLive && userGroups.length === 0,
      activeGroupId: isLive ? activeGroupId : null,
      activeGroupRole: isLive ? activeRole : null,
      userGroups,
      signInWithGoogle,
      signOut,
      selectGroup,
      refreshGroups,
    };
  }, [
    activeGroupId,
    forceDemo,
    loading,
    refreshGroups,
    selectGroup,
    session,
    signInWithGoogle,
    signOut,
    userGroups,
  ]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = React.useContext(SessionContext);
  if (!ctx)
    throw new Error("useSession måste användas inuti <SessionProvider>");
  return ctx;
}
