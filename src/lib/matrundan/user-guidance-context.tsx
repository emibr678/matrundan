import * as React from "react";
import { IS_STAGING } from "@/lib/app-environment";
import {
  acknowledgeUserGuidance,
  guidanceAcknowledgedForPresentation,
  guidanceIdentifier,
  loadAcknowledgedGuidance,
  resolveGuidanceAcknowledgementAction,
  setGuidancePreview,
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

type GuidancePreviewState = {
  userId: string | null;
  identifiers: Set<UserGuidanceIdentifier>;
};

type UserGuidanceContextValue = {
  status: UserGuidanceStatus;
  isAcknowledged: (definition: UserGuidanceDefinition) => boolean;
  isPreviewing: (definition: UserGuidanceDefinition) => boolean;
  preview: (definition: UserGuidanceDefinition) => void;
  clearPreview: (definition: UserGuidanceDefinition) => void;
  acknowledge: (definition: UserGuidanceDefinition) => Promise<void>;
};

const EMPTY_ACKNOWLEDGED = new Set<UserGuidanceIdentifier>();
const EMPTY_PREVIEWS = new Set<UserGuidanceIdentifier>();

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
  const [previewState, setPreviewState] = React.useState<GuidancePreviewState>({
    userId: null,
    identifiers: EMPTY_PREVIEWS,
  });
  const previews =
    previewState.userId === activeUserId
      ? previewState.identifiers
      : EMPTY_PREVIEWS;

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

    setLoaded((current) => ({
      userId: activeUserId,
      status: "loading",
      acknowledged:
        current.userId === activeUserId
          ? current.acknowledged
          : EMPTY_ACKNOWLEDGED,
    }));

    loadAcknowledgedGuidance(activeUserId)
      .then((acknowledged) => {
        if (cancelled) return;
        setLoaded((current) => {
          if (current.userId !== activeUserId) return current;
          return {
            userId: activeUserId,
            status: "ready",
            acknowledged: new Set([...acknowledged, ...current.acknowledged]),
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
        guidanceAcknowledgedForPresentation(
          loaded.acknowledged,
          previews,
          definition,
        ),
      ),
    [activeUserId, loaded.acknowledged, loaded.userId, previews],
  );

  const isPreviewing = React.useCallback(
    (definition: UserGuidanceDefinition) =>
      Boolean(activeUserId && previews.has(guidanceIdentifier(definition))),
    [activeUserId, previews],
  );

  const preview = React.useCallback(
    (definition: UserGuidanceDefinition) => {
      if (!IS_STAGING || !activeUserId) return;
      setPreviewState((current) => ({
        userId: activeUserId,
        identifiers: setGuidancePreview(
          current.userId === activeUserId
            ? current.identifiers
            : EMPTY_PREVIEWS,
          definition,
          true,
        ),
      }));
    },
    [activeUserId],
  );

  const clearPreview = React.useCallback(
    (definition: UserGuidanceDefinition) => {
      setPreviewState((current) =>
        current.userId === activeUserId
          ? {
              ...current,
              identifiers: setGuidancePreview(
                current.identifiers,
                definition,
                false,
              ),
            }
          : current,
      );
    },
    [activeUserId],
  );

  const acknowledge = React.useCallback(
    async (definition: UserGuidanceDefinition) => {
      const identifier = guidanceIdentifier(definition);
      const persistedAcknowledged = Boolean(
        activeUserId &&
        loaded.userId === activeUserId &&
        loaded.acknowledged.has(identifier),
      );
      const action = resolveGuidanceAcknowledgementAction({
        hasUser: Boolean(activeUserId),
        persistedAcknowledged,
        previewing: previews.has(identifier),
      });

      if (action === "ignore" || !activeUserId) return;
      if (action === "finish-preview") {
        setPreviewState((current) =>
          current.userId === activeUserId
            ? {
                ...current,
                identifiers: setGuidancePreview(
                  current.identifiers,
                  definition,
                  false,
                ),
              }
            : current,
        );
        return;
      }

      setLoaded((current) => {
        const acknowledged = new Set(
          current.userId === activeUserId
            ? current.acknowledged
            : EMPTY_ACKNOWLEDGED,
        );
        acknowledged.add(identifier);
        return {
          userId: activeUserId,
          status: current.userId === activeUserId ? current.status : "loading",
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
    [activeUserId, loaded.acknowledged, loaded.userId, previews],
  );

  const value = React.useMemo<UserGuidanceContextValue>(
    () => ({
      status,
      isAcknowledged,
      isPreviewing,
      preview,
      clearPreview,
      acknowledge,
    }),
    [acknowledge, clearPreview, isAcknowledged, isPreviewing, preview, status],
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
