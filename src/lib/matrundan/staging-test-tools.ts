import type { AppEnvironment } from "@/lib/app-environment";

export function canUseStagingTestTools({
  environment,
  signedIn,
  liveMode,
}: {
  environment: AppEnvironment;
  signedIn: boolean;
  liveMode: boolean;
}): boolean {
  return environment === "staging" && signedIn && liveMode;
}
