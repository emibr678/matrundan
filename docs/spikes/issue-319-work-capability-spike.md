# Issue #319 Work capability spike

> Disposable evidence checkpoint from 2026-09-13. This branch is not intended
> for merge.

## Baseline and isolation

- Repository: `emibr678/matrundan`.
- Verified `main`: `51113075d23928eb90c1059e5c9828409cbf9d5d`.
- Local branch: `spike/319-work-cloud-capability-20260913`.
- The checkout was cloned independently from the public GitHub remote and was
  clean before the spike.
- Open PRs were inspected before changes. The temporary UI exercise avoided the
  broad review-flow surface in PR #317 and the workflow/docs surfaces in PRs
  #324 and #326.

## Local toolchain evidence

- The base Work image did not expose `bun` on `PATH`.
- `bash scripts/bootstrap-agent.sh --with-chromium` installed pinned Bun 1.3.14
  and the frozen dependencies, but its system-dependency step could not use the
  default apt sandbox in this container.
- `bun run doctor` passed after adding the installed Bun directory to `PATH`.
- `bun test src/lib/matrundan/example-data.test.ts` passed: 6 tests, 0 failures.
- `bun run format:check:changed` passed.
- `bun run verify:changed` passed with exit code 0, including unit tests,
  TypeScript checks and a production build.
- Multiple local files were changed together before any commit: a temporary
  homepage spacing change plus a temporary 360 px harness page.

## Runtime and rendered review evidence

- Vite failed on `--host 0.0.0.0` because Node could not enumerate network
  interfaces in this Work container.
- Vite started successfully on `127.0.0.1:4173` with the same dummy public
  Supabase values used by the repository Playwright configuration.
- The separate Work CDP browser rejected container localhost with
  `ERR_BLOCKED_BY_CLIENT`.
- Playwright's normal Chromium download endpoint timed out or returned an empty
  invalid archive. A temporary browser runtime installed outside the repository
  through the available package registry did work with the repository's
  Playwright client.
- The local Playwright process reached the running app, verified an exact
  360×800 viewport and reported `documentWidth === clientWidth === 360`.
- A real Playwright interaction clicked `Matställen`, reached
  `http://127.0.0.1:4173/matstallen`, verified the `Matställen` heading and found
  no horizontal overflow or page error.
- Google Fonts was unavailable from the isolated browser, so screenshots used
  a local Open Sans fallback rather than the production font files.

## Render → inspect → correct → re-render

1. Temporarily changed the homepage wrapper from `space-y-6 pt-2` to
   `space-y-12 pt-10`.
2. Rendered and opened the 360 px screenshot. Visual inspection found clearly
   excessive vertical gaps between the next-stop card, pending review and
   progress card.
3. Corrected the temporary candidate to `space-y-7 pt-3`.
4. Re-rendered and opened 360×800 and 1280×900 screenshots. The hierarchy and
   spacing were balanced, controls remained aligned and neither viewport had
   horizontal overflow.
5. Opened and inspected the Matställen 360×800 screenshot after the Playwright
   navigation.
6. Restored the tracked homepage file exactly to `main` and removed the
   temporary harness. No product change remains in this checkpoint.

Temporary screenshots live only in the git-ignored `visual-review/` workspace;
they are not part of this branch checkpoint.
