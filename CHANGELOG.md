# Changelog

## Unreleased

## 1.1.0 - 2026-08-07

### Added

- Python Eval Lab with 71 human-labeled synthetic pull-request scenarios and a dependency-free Node bridge to the production analyzer
- Precision, recall, F1, exact finding-set accuracy, status accuracy, per-rule metrics, tagged slice metrics, and latency summaries
- Corpus-hash-bound regression baseline so fixture/label changes require explicit review before a new baseline is accepted
- Static Markdown, JSON, and HTML evaluation reports with diagnostic separation for analyzer, data, harness, infrastructure, and baseline failures
- Deterministic eval sharding plus a four-shard GitHub Actions workflow that aggregates complete-corpus results and gates regressions
- Unit tests for the Python evaluation harness
- CodeQL analysis for both JavaScript/TypeScript and the new Python evaluation infrastructure
- `unsafe-pr-target-checkout` blocking rule for privileged workflows that introduce checkout of pull-request-controlled code
- Regression coverage for safe metadata-only workflows, explicit PR-head refs, checkout v7's unsafe opt-out, and removed-risk diffs

### Changed

- Store labeled evaluation cases as atomic JSONL records behind a small manifest after self-dogfooding exposed that the original monolithic benchmark was unnecessarily hard to review.
- Split report rendering from the evaluation runner so the harness remains modular and reviewable.
- Recognize Python's conventional `test_*.py` naming as test evidence, with regression coverage.
- Store secret-detection eval fixtures as inert placeholders and materialize synthetic credential-shaped values only in memory, so self-dogfooding does not confuse benchmark data with leaked credentials.

### Documentation

- Added an Eval Lab methodology and limitations document, including explicit language that synthetic benchmark performance is not real-world accuracy
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
