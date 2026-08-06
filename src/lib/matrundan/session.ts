export * from "./session.tsx";

import { useSession as useBaseSession } from "./session.tsx";

/**
 * Den interna ?demo=1-sandlådan använder samma simulerade providerflöden som
 * exempelgruppen, men behåller sitt befintliga skrivbara demo-mode.
 */
export function useSession() {
  const session = useBaseSession();
  const simulatedDemo =
    session.mode !== "live" &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("demo") === "1";

  return simulatedDemo && !session.exampleMode
    ? { ...session, exampleMode: true }
    : session;
}
