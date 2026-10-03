// Temporary Issue #454 instrumentation. Remove before the implementation candidate.
import { IS_STAGING } from "@/lib/app-environment";

let sequence = 0;

export function beginLoadingMeasurement(stage: string, parent?: number) {
  const enabled = IS_STAGING && typeof window !== "undefined";
  const id = enabled ? ++sequence : 0;
  const started = enabled ? performance.now() : 0;
  return {
    id,
    end() {
      if (!enabled) return;
      console.info(
        "[Matrundan loading #454] " +
          JSON.stringify({
            id,
            parent,
            stage,
            startMs: Math.round(started * 10) / 10,
            durationMs: Math.round((performance.now() - started) * 10) / 10,
          }),
      );
    },
  };
}

export async function measureLoading<T>(
  stage: string,
  work: () => Promise<T>,
  parent?: number,
): Promise<T> {
  const measurement = beginLoadingMeasurement(stage, parent);
  try {
    return await work();
  } finally {
    measurement.end();
  }
}
