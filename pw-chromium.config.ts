import base from "./playwright.config";
const config = {
  ...base,
  projects: (base.projects ?? []).filter((p: any) => p.name === "mobile-chromium").map((p: any) => ({
    ...p,
    use: { ...p.use, channel: "chromium" },
  })),
};
export default config;
