import * as React from "react";
import {
  acknowledgeUserGuidance,
  guidanceIdentifier,
  loadAcknowledgedGuidance,
  type UserGuidanceDefinition,
  type UserGuidanceIdentifier,
} from "@/lib/matrundan/user-guidance";
import { useSession } from "@/lib/matrundan/session";

export type UserGuidanceStatus = "loading" | "ready" | "unavailable";

type LoadedGuidanceState = {
  userId: string | null;
  status: UserGuidanceStatus;
  acknowledged: Set<UserGuidanceIdentifier>;
};

type UserGuidanceContextValue = {
  status: UserGuidanceStatus;
  isAcknowledged: (definition: UserGuidanceDefinition) => boolean;
  acknowledge: (definition: UserGuidanceDefinition) => Promise<void>;
};

const EMPTY_ACKNOWLEDGED = new Set<UserGuidanceIdentifier>();

const UserGuidanceContext =
  React.createContext<UserGuidanceContextValue | null>(null);

export function UserGuidanceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { mode, user } = useSession();
  const activeUserId = mode === "live" ? (user?.id ?? null) : null;
  const [loaded, setLoaded] = React.useState<LoadedGuidanceState>({
    userId: null,
    status: "ready",
    acknowledged: EMPTY_ACKNOWLEDGED,
  });

  React.useEffect(() => {
    let cancelled = false;

    if (!activeUserId) {
      setLoaded({
        userId: null,
        status: "ready",
        acknowledged: EMPTY_ACKNOWLEDGED,
      });
      return () => {
        cancelled = true;
      };
    }

    setLoaded({
      userId: activeUserId,
      status: "loading",
      acknowledged: EMPTY_ACKNOWLEDGED,
    });

    loadAcknowledgedGuidance(activeUserId)
      .then((acknowledged) => {
        if (cancelled) return;
        setLoaded((current) => {
          if (current.userId !== activeUserId) return current;
          return {
            userId: activeUserId,
            status: "ready",
            acknowledged: new Set([
              ...acknowledged,
              ...current.acknowledged,
            ]),
          };
        });
      })
      .catch((error) => {
        console.error("[Matrundan] kunde inte läsa produktguidning:", error);
        if (cancelled) return;
        setLoaded((current) =>
          current.userId === activeUserId
            ? { ...current, status: "unavailable" }
            : current,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [activeUserId]);

  const status = !activeUserId
    ? "ready"
    : loaded.userId !== activeUserId
      ? "loading"
      : loaded.status;

  const isAcknowledged = React.useCallback(
    (definition: UserGuidanceDefinition) =>
      Boolean(
        activeUserId &&
          loaded.userId === activeUserId &&
          loaded.acknowledged.has(guidanceIdentifier(definition)),
      ),
    [activeUserId, loaded.acknowledged, loaded.userId],
  );

  const acknowledge = React.useCallback(
    async (definition: UserGuidanceDefinition) => {
      if (!activeUserId) return;

      const identifier = guidanceIdentifier(definition);
      setLoaded((current) => {
        const acknowledged = new Set(
          current.userId === activeUserId
            ? current.acknowledged
            : EMPTY_ACKNOWLEDGED,
        );
        if (acknowledged.has(identifier)) return current;
        acknowledged.add(identifier);
        return {
          userId: activeUserId,
          status:
            current.userId === activeUserId ? current.status : "loading",
          acknowledged,
        };
      });

      try {
        await acknowledgeUserGuidance(activeUserId, definition);
      } catch (error) {
        // Behåll den optimistiska markeringen under sessionen. Vid nästa
        // session visas guiden igen om skrivningen inte nådde databasen.
        console.error("[Matrundan] kunde inte spara produktguidning:", error);
      }
    },
    [activeUserId],
  );

  const value = React.useMemo<UserGuidanceContextValue>(
    () => ({ status, isAcknowledged, acknowledge }),
    [acknowledge, isAcknowledged, status],
  );

  return (
    <UserGuidanceContext.Provider value={value}>
      {children}
    </UserGuidanceContext.Provider>
  );
}

export function useUserGuidance(): UserGuidanceContextValue {
  const value = React.useContext(UserGuidanceContext);
  if (!value) {
    throw new Error("useUserGuidance måste användas inom UserGuidanceProvider");
  }
  return value;
}
