'use strict';

const CI_PREFIXES = ['formatting-patch-pr-', 'playwright-report-pr-'];
const VISUAL_PREFIX = 'visual-review-pr-';

function matchesPrArtifact(name, prNumber, scope) {
  const pr = String(prNumber);

  if (scope === 'ci' || scope === 'all') {
    if (CI_PREFIXES.some((prefix) => name === `${prefix}${pr}`)) {
      return true;
    }
  }

  if (scope === 'visual' || scope === 'all') {
    if (name.startsWith(`${VISUAL_PREFIX}${pr}-`)) {
      return true;
    }
  }

  return false;
}

function isLegacyArtifact(name) {
  return (
    name === 'formatting-patch' ||
    name === 'playwright-report' ||
    /^visual-review-\d+$/.test(name)
  );
}

module.exports = async function cleanupArtifacts({
  github,
  context,
  core,
  prNumber,
  currentRunId,
  scope = 'all',
  keepCurrent = false,
  cleanupLegacy = false,
  requireCurrentArtifact = false,
}) {
  const { owner, repo } = context.repo;
  const runId = Number(currentRunId || 0);
  const artifacts = await github.paginate(
    github.rest.actions.listArtifactsForRepo,
    { owner, repo, per_page: 100 },
    (response) => response.data.artifacts,
  );

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
      (artifact) =>
        !isLegacyArtifact(artifact.name) && artifact.workflow_run?.id === runId,
    );

    if (!hasCurrentArtifact) {
      core.info('No replacement artifact exists for the current run; keeping older artifacts.');
      return;
    }
  }

  let deletedCount = 0;
  let deletedBytes = 0;
  const kept = [];

  for (const artifact of candidates) {
    const belongsToCurrentRun = artifact.workflow_run?.id === runId;
    const legacy = isLegacyArtifact(artifact.name);

    if (keepCurrent && belongsToCurrentRun && !legacy) {
      kept.push(artifact.name);
      continue;
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
    `Artifact cleanup deleted ${deletedCount} artifact(s), ${deletedMiB} MiB; kept ${kept.length} from current run.`,
  );

  await core.summary
    .addHeading('Artifact lifecycle cleanup')
    .addRaw(`Deleted: ${deletedCount} artifact(s), ${deletedMiB} MiB\n`)
    .addRaw(`Kept from current run: ${kept.length}\n`)
    .write();
};
