#!/usr/bin/env bun

import { spawnSync } from "node:child_process";

const files = [
  "scripts/database-contract-check.mjs",
  "scripts/release-check.mjs",
];

spawnSync("bunx", ["prettier", "--write", ...files], {
  stdio: "inherit",
});
spawnSync("git", ["diff", "--", ...files], {
  stdio: "inherit",
});
