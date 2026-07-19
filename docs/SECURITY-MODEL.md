# Security model

## Trust boundary

The recommended workflow uses `pull_request_target` so the GitHub token can update a pull-request comment for contributions from forks. That event runs in the context of the base repository and must be handled carefully.

PR Rigor's recommended job:

- does not check out the pull request;
- does not execute contributor code;
- fetches pull-request metadata and changed-file patches through GitHub's API;
- loads configuration from the trusted base commit;
- requests only `contents: read` and `pull-requests: write`.

## Critical rule for users

Never add a step to the same `pull_request_target` job that checks out and executes the fork's head commit. Put builds and tests in a separate `pull_request` workflow with a read-only token.

## Data flow

The Action sends requests only to the GitHub API selected by the repository event. It does not send source code, patches, filenames, or contributor information to a model or analytics service.

The CLI sends requests to GitHub when the `github` command is used. Fixture analysis is offline.

## Secret detection

The secret-pattern rule intentionally supports only a small high-confidence set. It prints the pattern type and file path, never the matched value. Repositories should still use dedicated secret scanning and rotate any exposed credential.

## Comment updates

The Action updates an existing marked comment only when GitHub identifies it as bot- or app-authored. This avoids editing a contributor's comment that copied the marker. When a user token creates comments as a normal user, the Action may create a new comment on a later run rather than modifying a user-authored comment.

## Configuration safety

`config-json` is a workflow input controlled by the base workflow. The `config` file is fetched from the base SHA. Pull-request changes cannot weaken policy until a maintainer merges them.

## Reporting vulnerabilities

Use GitHub private vulnerability reporting when enabled, or follow [SECURITY.md](../SECURITY.md). Do not open a public issue containing an unpatched vulnerability or live credential.
