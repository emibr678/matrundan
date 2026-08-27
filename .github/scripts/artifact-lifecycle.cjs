"use strict";

const CI_PREFIXES = ["formatting-patch-pr-", "playwright-report-pr-"];
const VISUAL_PREFIX = "visual-review-pr-";

function matchesPrArtifact(name, prNumber, scope) {
  const pr = String(prNumber);

  if (scope === "ci" || scope === "all") {
    if (CI_PREFIXES.some((prefix) => name === `${prefix}${pr}`)) {
      return true;
    }
  }

  if (scope === "visual" || scope === "all") {
    if (name.startsWith(`${VISUAL_PREFIX}${pr}-`)) {
      return true;
    }
  }

  return false;
}

function isLegacyArtifact(name) {
  return (
    name === "formatting-patch" || name === "playwright-report" || /^visual-review-\d+$/.test(name)
  );
}

async function listArtifacts(github, owner, repo) {
  const artifacts = [];

  for (let page = 1; ; page += 1) {
    const response = await github.rest.actions.listArtifactsForRepo({
      owner,
      repo,
      per_page: 100,
      page,
    });
    const batch = response.data.artifacts || [];
    artifacts.push(...batch);

    if (batch.length < 100) {
      break;
    }
  }

  return artifacts;
}

async function getRunCreatedAt(github, owner, repo, runId, cache) {
  if (cache.has(runId)) {
    return cache.get(runId);
  }

  const response = await github.rest.actions.getWorkflowRun({
    owner,
    repo,
    run_id: runId,
  });
  const createdAt = Date.parse(response.data.created_at || "");

  if (!Number.isFinite(createdAt)) {
    throw new Error(`Workflow run ${runId} has no valid created_at timestamp.`);
  }

  cache.set(runId, createdAt);
  return createdAt;
}

module.exports = async function cleanupArtifacts({
  github,
  context,
  core,
  prNumber,
  currentRunId,
  scope = "all",
  keepCurrent = false,
  cleanupLegacy = false,
  requireCurrentArtifact = false,
}) {
  const { owner, repo } = context.repo;
  const runId = Number(currentRunId || 0);
  const artifacts = await listArtifacts(github, owner, repo);
  const totalBytes = artifacts.reduce((sum, artifact) => sum + (artifact.size_in_bytes || 0), 0);
  const totalMiB = (totalBytes / 1024 / 1024).toFixed(1);
  core.info(`Artifact inventory: ${artifacts.length} artifact(s), ${totalMiB} MiB.`);

  const candidates = artifacts.filter((artifact) => {
    if (cleanupLegacy && isLegacyArtifact(artifact.name)) {
      return true;
    }

    if (!prNumber) {
      return false;
    }

    return matchesPrArtifact(artifact.name, prNumber, scope);
  });

  if (requireCurrentArtifact) {
    const hasCurrentArtifact = candidates.some(
      (artifact) => !isLegacyArtifact(artifact.name) && artifact.workflow_run?.id === runId,
    );

    if (!hasCurrentArtifact) {
      core.info("No replacement artifact exists for the current run; keeping older artifacts.");
      return;
    }
  }

  const runCreatedAtCache = new Map();
  let currentRunCreatedAt = null;

  if (keepCurrent && candidates.length > 0) {
    if (!runId) {
      throw new Error("currentRunId is required when keepCurrent is enabled.");
    }

    currentRunCreatedAt = await getRunCreatedAt(github, owner, repo, runId, runCreatedAtCache);
  }

  let deletedCount = 0;
  let deletedBytes = 0;
  const kept = [];
  const protectedNewerOrUnknown = [];

  for (const artifact of candidates) {
    const artifactRunId = Number(artifact.workflow_run?.id || 0);
    const belongsToCurrentRun = artifactRunId === runId;
    const legacy = isLegacyArtifact(artifact.name);

    if (keepCurrent && belongsToCurrentRun && !legacy) {
      kept.push(artifact.name);
      continue;
    }

    if (keepCurrent && !belongsToCurrentRun) {
      if (!artifactRunId) {
        core.warning(`Keeping ${artifact.name}: its workflow run could not be identified safely.`);
        protectedNewerOrUnknown.push(artifact.name);
        continue;
      }

      try {
        const artifactRunCreatedAt = await getRunCreatedAt(
          github,
          owner,
          repo,
          artifactRunId,
          runCreatedAtCache,
        );

        if (artifactRunCreatedAt > currentRunCreatedAt) {
          core.info(`Keeping ${artifact.name}: it belongs to newer workflow run ${artifactRunId}.`);
          protectedNewerOrUnknown.push(artifact.name);
          continue;
        }
      } catch (error) {
        if (error.status === 404) {
          core.warning(
            `Keeping ${artifact.name}: workflow run ${artifactRunId} could not be age-verified.`,
          );
          protectedNewerOrUnknown.push(artifact.name);
          continue;
        }
        throw error;
      }
    }

    try {
      await github.rest.actions.deleteArtifact({
        owner,
        repo,
        artifact_id: artifact.id,
      });
      deletedCount += 1;
      deletedBytes += artifact.size_in_bytes || 0;
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
    }
  }

  const deletedMiB = (deletedBytes / 1024 / 1024).toFixed(1);
  core.info(
    `Artifact cleanup deleted ${deletedCount} artifact(s), ${deletedMiB} MiB; kept ${kept.length} from current run; protected ${protectedNewerOrUnknown.length} newer/unknown artifact(s).`,
  );

  await core.summary
    .addHeading("Artifact lifecycle cleanup")
    .addRaw(`Inventory before cleanup: ${artifacts.length} artifact(s), ${totalMiB} MiB\n`)
    .addRaw(`Deleted: ${deletedCount} artifact(s), ${deletedMiB} MiB\n`)
    .addRaw(`Kept from current run: ${kept.length}\n`)
    .addRaw(`Protected newer/unknown: ${protectedNewerOrUnknown.length}\n`)
    .write();
};
