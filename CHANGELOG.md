# Changelog

## Unreleased

## 1.2.0 - 2026-08-09

### Added

- Agentic Eval Lab for reproducible coding-agent evaluation in fresh synthetic workspaces
- Deterministic graders, repeated trials, 95% Wilson confidence intervals, variance summaries, and task-slice metrics
- Environment-consistency measurement using semantically irrelevant workspace perturbations
- Explicit task, agent, timeout, grader, and harness failure taxonomy
- Robust and deliberately brittle reference agents as controls for evaluator validation
- Seeded paired-bootstrap regression gate against a committed per-task baseline
- GitHub Actions `measurement-validation` workflow for the Agentic Eval Lab
- Agentic evaluation methodology and limitations documentation

### Changed

- Expanded the project framing from a deterministic PR quality gate to a three-layer measurement stack: PR Rigor, Eval Lab, and Agentic Eval Lab
- Refreshed the repository README so the evaluation research story is visible before implementation details

### Notes

- The Agentic Eval Lab corpus is synthetic and intentionally small. It demonstrates evaluation mechanics and robustness controls, not frontier-model accuracy or capability.
- The core GitHub Action remains deterministic and does not send repository data to an external AI service.
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
