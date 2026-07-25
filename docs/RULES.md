# Rule reference

Run `pr-rigor rules` for the installed version's complete list.

## Description and traceability

- `missing-title`: missing pull-request title.
- `short-title`: title below the configured length.
- `thin-description`: body below the configured length.
- `required-sections`: missing configured Markdown headings.
- `missing-issue-link`: no closing issue reference or issue URL.
- `unchecked-tasks`: unchecked template tasks remain.
- `draft-pr`: informational draft signal or skip trigger.

## Scope and reviewability

- `many-files`: file count exceeds policy.
- `large-diff`: total changed lines exceed policy.
- `large-file`: an individual file has an unusually large diff.
- `generated-heavy`: generated paths dominate the file set.
- `binary-change`: binary artifacts changed.

## Testing and release

- `missing-tests`: source changed without test paths.
- `low-test-ratio`: changed test lines are small relative to changed source lines.
- `deleted-tests`: test files were removed.
- `missing-changelog`: source changed without a changelog or changeset.

The ratio rule is a review signal, not code coverage. It cannot determine whether existing tests already cover a change.

## Supply chain

- `dependency-change`: dependency manifests changed.
- `manifest-without-lockfile`: no lockfile change accompanied a manifest change.
- `unpinned-action`: a newly added third-party GitHub Action uses a mutable reference instead of a full commit SHA.
- `lockfile-only`: the non-documentation change is only lockfiles.

Official `actions/*` and `github/*` owners are exempt from `unpinned-action` by default. Strict repositories can remove the exemption.

## Security and operations

- `sensitive-change`: a configured sensitive path changed.
- `workflow-permissions`: newly added broad write permissions in a workflow patch.
- `unsafe-pr-target-checkout`: a `pull_request_target` workflow introduces checkout of pull-request-controlled code.
- `credential-file`: a likely credential or private-key path changed.
- `secret-pattern`: a small set of high-confidence secret patterns appeared in added lines. Values are never printed.
- `migration-change`: database or schema migration paths changed.
- `public-api-change`: likely public API paths changed.

The unsafe-checkout rule inspects the changed workflow patch. It recognizes explicit pull-request head refs, `allow-unsafe-pr-checkout: true`, and common `gh pr checkout` or `git` checkout commands when the `pull_request_target` trigger is visible in the patch. It does not parse arbitrary shell scripts or replace dedicated workflow security analysis.

PR Rigor is not a secret scanner, dependency auditor, SAST engine, or migration verifier. These checks identify where a specialist review may be needed.
