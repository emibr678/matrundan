/**
 * Sessions- och läges-hantering för Matrundan.
 *
 * Filtrerar på aktivt medlemskap, men behåller både aktiva och arkiverade
 * grupper så att historiken kan öppnas utan att medlemskapets livscykel ändras.
 */
import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export type AppMode = "landing" | "demo" | "live";
export type GroupRole = "owner" | "admin" | "member";
export type GroupLifecycleStatus = "active" | "archived";

export interface UserGroupSummary {
  id: string;
  name: string;
  emoji: string | null;
  role: GroupRole;
  lifecycleStatus: GroupLifecycleStatus;
}

type RpcResponse = {
  data: unknown;
  error: { message?: string } | null;
};

type RpcCall = (fn: string, args?: Record<string, unknown>) => Promise<RpcResponse>;

const rpc = supabase.rpc.bind(supabase) as unknown as RpcCall;

interface SessionState {
  loading: boolean;
  user: User | null;
  session: Session | null;
  mode: AppMode;
  exampleMode: boolean;
  needsOnboarding: boolean;
  activeGroupId: string | null;
  activeGroupRole: GroupRole | null;
  activeGroupLifecycleStatus: GroupLifecycleStatus | null;
  userGroups: UserGroupSummary[];
  signInWithGoogle: (opts?: { redirectPath?: string }) => Promise<void>;
  signInWithPassword: (
    email: string,
    password: string,
    opts?: { redirectPath?: string },
  ) => Promise<void>;
  signUpWithPassword: (
    email: string,
    password: string,
    opts?: { displayName?: string; redirectPath?: string },
  ) => Promise<{ needsEmailConfirmation: boolean; accountAlreadyExists: boolean }>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  exitExampleMode: () => void;
  selectGroup: (groupId: string) => void;
  refreshGroups: () => Promise<void>;
}

const SessionContext = React.createContext<SessionState | null>(null);
const ACTIVE_GROUP_KEY = "matrundan.activeGroup.v1";
const PENDING_INVITE_KEY = "matrundan.pendingInvite.v1";
const EXAMPLE_SESSION_KEY = "matrundan.exampleSession.v1";

function resolveDemoRoute(): { forceDemo: boolean; exampleMode: boolean } {
  if (typeof window === "undefined") return { forceDemo: false, exampleMode: false };

  const params = new URLSearchParams(window.location.search);
  if (params.get("demo") === "1") {
    return { forceDemo: true, exampleMode: false };
  }

  const explicitExample = window.location.pathname === "/exempel";
  if (explicitExample) {
    try {
      window.sessionStorage.setItem(EXAMPLE_SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    return { forceDemo: true, exampleMode: true };
  }

  try {
    const storedExample = window.sessionStorage.getItem(EXAMPLE_SESSION_KEY) === "1";
    return { forceDemo: storedExample, exampleMode: storedExample };
  } catch {
    return { forceDemo: false, exampleMode: false };
  }
}

function clearExampleSession() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(EXAMPLE_SESSION_KEY);
  } catch {
    /* ignore */
  }
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
    const value = window.sessionStorage.getItem(PENDING_INVITE_KEY);
    if (value) window.sessionStorage.removeItem(PENDING_INVITE_KEY);
    return value;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const demoRoute = React.useMemo(resolveDemoRoute, []);
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

    const { data, error } = await rpc("list_user_groups_v4b");
    if (error) {
      console.error("[Matrundan] kunde inte läsa medlemskap:", error);
      setUserGroups([]);
      return;
    }

    const groups: UserGroupSummary[] = ((data ?? []) as UserGroupSummary[])
      .map(
        (group): UserGroupSummary => ({
          id: group.id,
          name: group.name,
          emoji: group.emoji,
          role: group.role,
          lifecycleStatus: group.lifecycleStatus === "archived" ? "archived" : "active",
        }),
      )
      .sort((a, b) => {
        if (a.lifecycleStatus !== b.lifecycleStatus) {
          return a.lifecycleStatus === "active" ? -1 : 1;
        }
        return a.name.localeCompare(b.name, "sv");
      });

    setUserGroups(groups);
    setActiveGroupId((current) => {
      if (current && groups.some((group) => group.id === current)) return current;
      const first = groups.find((group) => group.lifecycleStatus === "active") ?? groups[0];
      const firstId = first?.id ?? null;
      if (firstId && typeof window !== "undefined") {
        window.localStorage.setItem(ACTIVE_GROUP_KEY, firstId);
      } else if (!firstId && typeof window !== "undefined") {
        window.localStorage.removeItem(ACTIVE_GROUP_KEY);
      }
      return firstId;
    });
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (cancelled) return;
      setSession(nextSession);
      if (nextSession?.user) {
        void loadGroups(nextSession.user.id);
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
      subscription.subscription.unsubscribe();
    };
  }, [loadGroups]);

  const selectGroup = React.useCallback((groupId: string) => {
    setActiveGroupId(groupId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_GROUP_KEY, groupId);
    }
  }, []);

  const signInWithGoogle = React.useCallback(async (opts?: { redirectPath?: string }) => {
    const origin = typeof window !== "undefined" ? window.location.origin : undefined;
    clearExampleSession();
    if (opts?.redirectPath) setPendingInvitePath(opts.redirectPath);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: origin,
    });
    if (result.error) {
      console.error("[Matrundan] Google-inloggning misslyckades:", result.error);
      throw result.error;
    }
  }, []);

  /** Rensar en eventuell tidigare session så att inloggning alltid byter konto. */
  const resetBeforeAuth = React.useCallback(async () => {
    clearExampleSession();
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      await supabase.auth.signOut();
    }
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACTIVE_GROUP_KEY);
    }
    setActiveGroupId(null);
    setUserGroups([]);
  }, []);

  const signInWithPassword = React.useCallback(
    async (email: string, password: string, opts?: { redirectPath?: string }) => {
      await resetBeforeAuth();
      if (opts?.redirectPath) setPendingInvitePath(opts.redirectPath);
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
    },
    [resetBeforeAuth],
  );

  const signUpWithPassword = React.useCallback(
    async (
      email: string,
      password: string,
      opts?: { displayName?: string; redirectPath?: string },
    ) => {
      const origin = typeof window !== "undefined" ? window.location.origin : undefined;
      await resetBeforeAuth();
      if (opts?.redirectPath) setPendingInvitePath(opts.redirectPath);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: origin,
          data: opts?.displayName?.trim() ? { full_name: opts.displayName.trim() } : undefined,
        },
      });
      if (error) throw error;
      return { needsEmailConfirmation: !data.session };
    },
    [resetBeforeAuth],
  );

  const sendPasswordReset = React.useCallback(async (email: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${origin}/nytt-losenord`,
    });
    if (error) throw error;
  }, []);

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut();
    clearExampleSession();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACTIVE_GROUP_KEY);
    }
    setActiveGroupId(null);
    setUserGroups([]);
  }, []);

  const exitExampleMode = React.useCallback(() => {
    clearExampleSession();
    if (typeof window !== "undefined") {
      window.location.assign("/");
    }
  }, []);

  const refreshGroups = React.useCallback(async () => {
    await loadGroups(session?.user?.id);
  }, [loadGroups, session?.user?.id]);

  const value = React.useMemo<SessionState>(() => {
    const user = session?.user ?? null;
    const mode: AppMode = demoRoute.forceDemo ? "demo" : user ? "live" : "landing";
    const activeGroup = userGroups.find((group) => group.id === activeGroupId) ?? null;
    const isLive = mode === "live";
    const isDemo = mode === "demo";

    return {
      loading,
      user,
      session,
      mode,
      exampleMode: isDemo && demoRoute.exampleMode,
      needsOnboarding: isLive && userGroups.length === 0,
      activeGroupId: isLive ? activeGroupId : null,
      activeGroupRole:
        isLive && activeGroup?.lifecycleStatus === "active"
          ? activeGroup.role
          : isLive
            ? null
            : isDemo
              ? "owner"
              : null,
      activeGroupLifecycleStatus: isLive
        ? (activeGroup?.lifecycleStatus ?? null)
        : isDemo
          ? "active"
          : null,
      userGroups,
      signInWithGoogle,
      signInWithPassword,
      signUpWithPassword,
      sendPasswordReset,
      signOut,
      exitExampleMode,
      selectGroup,
      refreshGroups,
    };
  }, [
    activeGroupId,
    demoRoute.exampleMode,
    demoRoute.forceDemo,
    exitExampleMode,
    loading,
    refreshGroups,
    selectGroup,
    session,
    signInWithGoogle,
    signInWithPassword,
    signUpWithPassword,
    sendPasswordReset,
    signOut,
    userGroups,
  ]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = React.useContext(SessionContext);
  if (!context) {
    throw new Error("useSession måste användas inuti <SessionProvider>");
  }
  return context;
}
