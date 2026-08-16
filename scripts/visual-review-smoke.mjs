import { rm } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const includeDesktop = args.includes("--desktop");
const routes = args.filter((argument) => argument !== "--desktop");

if (routes.length === 0) {
  console.error(
    "Ange minst en route, exempelvis: bun run test:visual-smoke -- /matstallen?demo=1",
  );
  process.exit(2);
}

for (const route of routes) {
  if (!route.startsWith("/")) {
    console.error(`Ogiltig route: ${route}. Routes ska börja med /.`);
    process.exit(2);
  }
}

const projects = ["mobile-360", ...(includeDesktop ? ["desktop-1280"] : [])];

for (const project of projects) {
  await rm(path.join("visual-review", project), { recursive: true, force: true });
}

console.log(
  `Visuell smoke check: ${routes.join(", ")} · ${projects.join(", ")}`,
);

const command = [
  "bunx",
  "playwright",
  "test",
  "tests/visual-review/visual-review.spec.ts",
  "--config=playwright.visual.config.ts",
  ...projects.flatMap((project) => ["--project", project]),
];

const child = Bun.spawn(command, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    VISUAL_REVIEW_PATHS: routes.join(","),
  },
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

process.exit(await child.exited);
