# Changelog

## Unreleased

### Added

- `unsafe-pr-target-checkout` blocking rule for privileged workflows that introduce checkout of pull-request-controlled code
- Regression coverage for safe metadata-only workflows, explicit PR-head refs, checkout v7's unsafe opt-out, and removed-risk diffs

### Documentation

- Expanded the rule reference and security model with detection scope, limitations, and the safe split-workflow pattern

## 1.0.0 - 2026-07-19

### Added

- GitHub Action and CLI with zero runtime dependencies
- 26 deterministic readiness, testing, security, supply-chain, release, and compatibility checks
- Balanced, strict, library, and docs presets
- Markdown, text, JSON, and SARIF output
- Trusted base-commit configuration loading
- Bot-safe comment updates, workflow annotations, and step summaries
- Maintainer waiver and skip labels
- Configuration schema, security model, tests, and publication guide
