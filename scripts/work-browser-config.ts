export const WORK_CHROMIUM_VERSION = "152.0.0";

export const WORK_CHROMIUM_DOWNLOAD = {
  url: `https://github.com/Sparticuz/chromium/releases/download/v${WORK_CHROMIUM_VERSION}/chromium-v${WORK_CHROMIUM_VERSION}-pack.x64.tar`,
  sha256: "103844057dd5ee57fec95763811b55bead462e8caeef295a890823f7fb38352a",
} as const;

export const WORK_CHROMIUM_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--no-zygote",
  "--single-process",
  "--disable-dev-shm-usage",
  "--use-gl=angle",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--in-process-gpu",
] as const;

type BrowserEnvironment = Record<string, string | undefined>;

export function workChromiumLaunchOptions(environment: BrowserEnvironment = process.env) {
  const executablePath = environment.MATRUNDAN_WORK_CHROMIUM_EXECUTABLE_PATH;
  if (!executablePath) {
    return undefined;
  }

  const serializedArgs = environment.MATRUNDAN_WORK_CHROMIUM_ARGS;
  const args: unknown = serializedArgs ? JSON.parse(serializedArgs) : [];
  if (!Array.isArray(args) || !args.every((argument) => typeof argument === "string")) {
    throw new Error("MATRUNDAN_WORK_CHROMIUM_ARGS måste vara en JSON-array av strängar.");
  }

  return { executablePath, args };
}
