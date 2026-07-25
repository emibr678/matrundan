/**
 * Sessions- och läges-hantering för Matrundan.
 *
 * Denna provider isolerar Supabase Auth från övriga komponenter och
 * bestämmer om appen körs i demo- eller live-läge:
 *
 * - Ej inloggad + inget ?demo=1 → demo-läge (standard, ingen skrivning).
 * - Inloggad + inget ?demo=1     → live-läge, läser från Supabase.
 * - ?demo=1                      → demo-läge alltid (utveckling/sandlåda).
 *
 * Vykomponenterna använder useSession() och useStore() – de behöver inte
 * känna till hur data hämtas.
 */
import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export type AppMode = "demo" | "live";

export interface UserGroupSummary {
  id: string;
  name: string;
  emoji: string | null;
}

interface SessionState {
  loading: boolean;
  user: User | null;
  session: Session | null;
  mode: AppMode;
  /** true om användaren är inloggad men ingen aktiv grupp valts än. */
  needsOnboarding: boolean;
  /** Aktivt grupp-id i live-läge, eller null om ingen finns/valts. */
  activeGroupId: string | null;
  userGroups: UserGroupSummary[];
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  selectGroup: (groupId: string) => void;
  refreshGroups: () => Promise<void>;
}

const SessionContext = React.createContext<SessionState | null>(null);
const ACTIVE_GROUP_KEY = "matrundan.activeGroup.v1";

function useForceDemo(): boolean {
  return React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("demo") === "1";
  }, []);
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
      .select("group_id, groups(id, name, emoji)")
      .eq("user_id", uid);
    if (error) {
      console.error("[Matrundan] kunde inte läsa medlemskap:", error);
      setUserGroups([]);
      return;
    }
    const groups: UserGroupSummary[] = (data ?? [])
      .map((row) => {
        const g = (row as { groups: { id: string; name: string; emoji: string | null } | null }).groups;
        return g ? { id: g.id, name: g.name, emoji: g.emoji } : null;
      })
      .filter((g): g is UserGroupSummary => g !== null);
    setUserGroups(groups);
    setActiveGroupId((current) => {
      if (current && groups.some((g) => g.id === current)) return current;
      const first = groups[0]?.id ?? null;
      if (first && typeof window !== "undefined") {
        window.localStorage.setItem(ACTIVE_GROUP_KEY, first);
      }
      return first;
    });
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    // Registrera lyssnare först, gör sedan initial getSession.
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

  const signInWithGoogle = React.useCallback(async () => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : undefined;
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: origin,
    });
    if (result.error) {
      console.error("[Matrundan] Google-inloggning misslyckades:", result.error);
      throw result.error;
    }
  }, []);

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACTIVE_GROUP_KEY);
    }
    setActiveGroupId(null);
  }, []);

  const refreshGroups = React.useCallback(async () => {
    await loadGroups(session?.user?.id);
  }, [loadGroups, session?.user?.id]);

  const value = React.useMemo<SessionState>(() => {
    const user = session?.user ?? null;
    const isLive = !forceDemo && !!user;
    return {
      loading,
      user,
      session,
      mode: isLive ? "live" : "demo",
      needsOnboarding: isLive && userGroups.length === 0,
      activeGroupId: isLive ? activeGroupId : null,
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
