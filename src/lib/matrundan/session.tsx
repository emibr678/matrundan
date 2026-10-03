/**
 * Sessions- och läges-hantering för Matrundan.
 *
 * Filtrerar på aktivt medlemskap, men behåller både aktiva och arkiverade
 * grupper så att historiken kan öppnas utan att medlemskapets livscykel ändras.
 */
import { AccountGroups } from "./account-groups";
import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { listMyGroupInvitations, type MyGroupInvitation } from "./live-admin";

export type AppMode = "landing" | "demo" | "live";
export type GroupRole = "owner" | "admin" | "member";
export type GroupLifecycleStatus = "active" | "archived";

export interface UserGroupSummary {
  id: string;
  name: string;
  emoji: string | null;
  description: string | null;
  memberPreviewNames: string[];
  otherMemberCount: number;
  role: GroupRole;
  lifecycleStatus: GroupLifecycleStatus;
}

type RpcResponse = {
  data: unknown;
  error: { message?: string } | null;
};

type RpcCall = (fn: string, args?: Record<string, unknown>) => Promise<RpcResponse>;

interface SessionState {
  loading: boolean;
  groupsStatus: "idle" | "loading" | "ready" | "error";
  sessionEpoch: number;
  user: User | null;
  session: Session | null;
  mode: AppMode;
  exampleMode: boolean;
  needsOnboarding: boolean;
  activeGroupId: string | null;
  activeGroupRole: GroupRole | null;
  activeGroupLifecycleStatus: GroupLifecycleStatus | null;
  userGroups: UserGroupSummary[];
  pendingGroupInvitations: MyGroupInvitation[];
  pendingGroupInvitationsReady: boolean;
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
  refreshPendingGroupInvitations: () => Promise<void>;
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

async function readUserGroups(): Promise<UserGroupSummary[]> {
  const rpc = supabase.rpc.bind(supabase) as unknown as RpcCall;
  const { data, error } = await rpc("list_user_groups_v4b");
  if (error) throw error;
  return ((data ?? []) as UserGroupSummary[])
      .map((group): UserGroupSummary => ({
        id: group.id,
        name: group.name,
        emoji: group.emoji,
        description: typeof group.description === "string" ? group.description : null,
        memberPreviewNames: Array.isArray(group.memberPreviewNames)
          ? group.memberPreviewNames
              .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
              .map((name) => name.trim())
              .slice(0, 2)
          : [],
        otherMemberCount:
          typeof group.otherMemberCount === "number" && Number.isFinite(group.otherMemberCount)
            ? Math.max(0, Math.trunc(group.otherMemberCount))
            : 0,
        role: group.role,
        lifecycleStatus: group.lifecycleStatus === "archived" ? "archived" : "active",
      }))
      .sort((a, b) => {
        if (a.lifecycleStatus !== b.lifecycleStatus) {
          return a.lifecycleStatus === "active" ? -1 : 1;
        }
        return a.name.localeCompare(b.name, "sv");
      });

}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const demoRoute = React.useMemo(resolveDemoRoute, []);
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);
  const groupsLoader = React.useMemo(() => new AccountGroups(readUserGroups), []);
  const groupsSnapshot = React.useSyncExternalStore(groupsLoader.subscribe, groupsLoader.getSnapshot, groupsLoader.getSnapshot);
  const sessionUserId = React.useRef<string | null>(null);
  const userGroups = React.useMemo(() => groupsSnapshot.userId === session?.user.id ? groupsSnapshot.groups : [], [groupsSnapshot, session?.user.id]);
  const [pendingInvites, setPendingInvites] = React.useState<MyGroupInvitation[]>([]);
  const [pendingInvitesResolvedUserId, setPendingInvitesResolvedUserId] = React.useState<
    string | null
  >(null);
  const [activeGroupId, setActiveGroupId] = React.useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(ACTIVE_GROUP_KEY);
  });

  const refreshPendingInvites = React.useCallback(async () => {
    const userId = session?.user?.id;
    if (demoRoute.forceDemo || !userId) {
      setPendingInvites([]);
      setPendingInvitesResolvedUserId(null);
      return;
    }

    try {
      const invites = await listMyGroupInvitations();
      if (sessionUserId.current !== userId) return;
      setPendingInvites(invites);
    } catch (error) {
      console.error("[Matrundan] kunde inte läsa gruppinbjudningar:", error);
      if (sessionUserId.current === userId) setPendingInvites([]);
    } finally {
      if (sessionUserId.current === userId) setPendingInvitesResolvedUserId(userId);
    }
  }, [demoRoute.forceDemo, session?.user?.id]);

  React.useEffect(() => {
    void refreshPendingInvites();
  }, [refreshPendingInvites]);

  React.useEffect(() => {
    if (typeof window === "undefined" || demoRoute.forceDemo || !session?.user?.id) {
      return;
    }
    const refresh = () => void refreshPendingInvites();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [demoRoute.forceDemo, refreshPendingInvites, session?.user?.id]);

  React.useEffect(() => {
    if (groupsSnapshot.status !== "ready" || groupsSnapshot.userId !== session?.user.id) return;
    setActiveGroupId((current) => {
      if (current && userGroups.some((group) => group.id === current)) return current;
      const first = userGroups.find((group) => group.lifecycleStatus === "active") ?? userGroups[0];
      const firstId = first?.id ?? null;
      if (typeof window !== "undefined") {
        if (firstId) window.localStorage.setItem(ACTIVE_GROUP_KEY, firstId);
        else window.localStorage.removeItem(ACTIVE_GROUP_KEY);
      }
      return firstId;
    });
  }, [groupsSnapshot, session?.user.id, userGroups]);

  React.useEffect(() => {
    let cancelled = false;
    let authEventSeen = false;
    const applySession = (nextSession: Session | null) => {
      const uid = nextSession?.user.id ?? null;
      if (sessionUserId.current !== uid) {
        sessionUserId.current = uid;
        groupsLoader.setAccount(uid);
        setPendingInvites([]);
        setPendingInvitesResolvedUserId(null);
      }
      setSession(nextSession);
      setLoading(false);
      // Leave the synchronous Auth callback before calling another Supabase API.
      if (uid && !demoRoute.forceDemo) {
        setTimeout(() => {
          if (!cancelled && sessionUserId.current === uid) void groupsLoader.load();
        }, 0);
      }
    };
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (cancelled) return;
      authEventSeen = true;
      applySession(nextSession);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && !authEventSeen) applySession(data.session);
    }).catch(() => {
      if (!cancelled && !authEventSeen) applySession(null);
    });
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
      sessionUserId.current = null;
      groupsLoader.reset();
    };
  }, [demoRoute.forceDemo, groupsLoader]);

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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: origin,
      },
    });
    if (error) {
      console.error("[Matrundan] Google-inloggning misslyckades:", error);
      throw error;
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
    groupsLoader.reset();
  }, [groupsLoader]);

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
      // Supabase döljer att adressen redan finns genom att returnera en användare
      // utan identiteter. Vi tolkar det som "kontot finns redan".
      const accountAlreadyExists = Boolean(data.user && (data.user.identities?.length ?? 0) === 0);
      return {
        needsEmailConfirmation: !accountAlreadyExists && !data.session,
        accountAlreadyExists,
      };
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
    groupsLoader.reset();
    setPendingInvites([]);
    setPendingInvitesResolvedUserId(null);
  }, [groupsLoader]);

  const exitExampleMode = React.useCallback(() => {
    clearExampleSession();
    if (typeof window !== "undefined") {
      window.location.assign("/");
    }
  }, []);

  const refreshGroups = React.useCallback(async () => {
    await groupsLoader.load(true);
  }, [groupsLoader]);

  React.useEffect(() => {
    if (typeof window === "undefined" || demoRoute.forceDemo || !session?.user.id) return;
    const refresh = () => { void refreshGroups(); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [demoRoute.forceDemo, refreshGroups, session?.user.id]);

  const value = React.useMemo<SessionState>(() => {
    const user = session?.user ?? null;
    const mode: AppMode = demoRoute.forceDemo ? "demo" : user ? "live" : "landing";
    const activeGroup = userGroups.find((group) => group.id === activeGroupId) ?? null;
    const isLive = mode === "live";
    const isDemo = mode === "demo";

    return {
      loading,
      groupsStatus: groupsSnapshot.status,
      sessionEpoch: groupsSnapshot.epoch,
      user,
      session,
      mode,
      exampleMode: isDemo && demoRoute.exampleMode,
      needsOnboarding: isLive && groupsSnapshot.status === "ready" && userGroups.length === 0,
      activeGroupId: isLive ? (activeGroup?.id ?? null) : null,
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
      pendingGroupInvitations: pendingInvites,
      pendingGroupInvitationsReady: !isLive || pendingInvitesResolvedUserId === (user?.id ?? null),
      signInWithGoogle,
      signInWithPassword,
      signUpWithPassword,
      sendPasswordReset,
      signOut,
      exitExampleMode,
      selectGroup,
      refreshGroups,
      refreshPendingGroupInvitations: refreshPendingInvites,
    };
  }, [
    activeGroupId,
    demoRoute.exampleMode,
    demoRoute.forceDemo,
    exitExampleMode,
    loading,
    groupsSnapshot,
    pendingInvites,
    pendingInvitesResolvedUserId,
    refreshGroups,
    refreshPendingInvites,
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
