import type { Page } from "@playwright/test";

const DEMO_STATE_KEY = "matrundan.state.v1";
const RESET_MARKER = "matrundan.e2e.demo-state-reset.v1";

export async function resetDemoStateBeforeNavigation(page: Page) {
  await page.addInitScript(
    ({ marker, stateKey }) => {
      if (window.sessionStorage.getItem(marker) === "done") return;

      window.localStorage.removeItem(stateKey);
      window.sessionStorage.setItem(marker, "done");
    },
    { marker: RESET_MARKER, stateKey: DEMO_STATE_KEY },
  );
}
