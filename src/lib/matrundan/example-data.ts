import { buildExampleState } from "./example-scenarios";

/**
 * Fast referensfixture för enhets- och domäntester som behöver stabila datum.
 * Den publika exempelgruppen använder createExampleState() vid sessionsstart.
 */
export const EXAMPLE_FIXTURE_REFERENCE_TIME = "2026-08-06T07:00:00.000Z";

export const EXAMPLE_STATE = buildExampleState(new Date(EXAMPLE_FIXTURE_REFERENCE_TIME));

export function createExampleState(now = new Date()) {
  return buildExampleState(now);
}

export { buildExampleState, EXAMPLE_IDS } from "./example-scenarios";
