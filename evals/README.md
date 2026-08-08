# PR Rigor Eval Lab

PR Rigor Eval Lab is a small, dependency-free evaluation system for measuring the deterministic analyzer against a labeled corpus of synthetic pull-request scenarios.

It exists for a different reason than the unit tests. Unit tests verify individual implementation behavior. The eval corpus asks a system-level question: across a deliberately mixed set of positive, negative, boundary, configuration, and multi-signal scenarios, how often does PR Rigor emit exactly the findings the benchmark expects?

## What it measures

The current corpus contains 71 human-labeled scenarios covering description quality, test signals, scope, supply-chain changes, GitHub Actions security, credential and secret detection, migrations, public API changes, generated artifacts, binary files, waivers, presets, and negative controls.

The harness reports:

- micro precision, recall, and F1 over finding IDs
- exact finding-set accuracy per scenario
- report-status accuracy (`pass`, `warn`, `fail`, or `skipped`)
- per-rule precision, recall, and F1
- slice metrics for tags such as `security`, `testing`, `negative-control`, and `boundary`
- p50 and p95 analyzer latency as an observational metric
- regression against a reviewed baseline tied to the benchmark corpus hash

A static HTML report is produced with no third-party Python packages.

The reviewed v1.1.0 baseline matches all 71 labeled scenarios exactly, with micro precision, recall, and F1 of 1.0 on this corpus. This is a regression-consistency result only; it must not be interpreted as 100% real-world accuracy.

## Run locally

From the repository root:

```bash
python evals/run_evals.py --fail-on-regression
```

The default report directory is `evals/out/` and contains:

- `results.json` for machine-readable case-level results
- `report.md` for review in a terminal or pull request artifact
- `report.html` for a lightweight dashboard

The Python harness uses only the standard library. It invokes the production Node.js analyzer through `evals/node_runner.mjs`, so the code being evaluated is the same analysis core used by the Action and CLI.

## Parallel shards

The corpus can be partitioned deterministically:

```bash
python evals/run_evals.py --shard-index 0 --shard-count 4 --out-dir evals/out/shard-0
```

GitHub Actions runs four shards in parallel and then aggregates them into one regression-gated report. Shard aggregation verifies that every benchmark case appears exactly once and that every shard used the same benchmark hash.

## Baseline discipline

`evals/baseline.json` is intentionally bound to a SHA-256 hash of the canonical benchmark document. If labels or fixtures change, the regression gate refuses to compare the new corpus with the old baseline.

After an intentional behavior or label change, review the changed cases first, then explicitly refresh the baseline:

```bash
python evals/run_evals.py --write-baseline
```

A baseline update should never be used merely to make a failing regression disappear.

## Failure classification

The harness separates common failure modes so a red eval is easier to triage:

- finding/status mismatch: analyzer behavior or benchmark-label regression
- benchmark validation failure: fixture/data error
- Node process or runner failure: harness/infrastructure error
- baseline hash mismatch: benchmark changed without an explicit baseline review

This mirrors the operational distinction between a system regression and an evaluation-system failure.

## Important limitation

This is a synthetic regression benchmark, not evidence of real-world accuracy or broad adoption. A perfect score means the current analyzer matches this reviewed corpus exactly. It does not imply 100% precision or recall on arbitrary repositories. Real external fixtures and independently reported false positives should be added as the project earns them.
