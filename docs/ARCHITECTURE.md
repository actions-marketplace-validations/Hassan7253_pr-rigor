# Architecture

PR Rigor is intentionally small and dependency-free at runtime.

## Modules

- `src/config.js`: presets, defaults, validation, and templates.
- `src/glob.js`: minimal repository-path matching.
- `src/analyze.js`: deterministic classification and rule evaluation.
- `src/render.js`: Markdown and terminal output.
- `src/sarif.js`: SARIF 2.1.0 conversion.
- `src/github.js`: GitHub REST requests, pagination, trusted config loading, and comment upserts.
- `src/action.js`: GitHub Action environment integration.
- `bin/pr-rigor.js`: local CLI.

## Analysis contract

`analyzePullRequest()` accepts pull-request metadata, a changed-file array, optional user configuration, and an optional preset override. It returns a stable JSON report with:

- tool and schema versions;
- status and score;
- file and line summaries;
- findings with rule ID, category, severity, evidence, and recovery guidance;
- waived rule IDs;
- the resolved configuration.

Rules must be deterministic, inspect only supplied evidence, avoid contributor identity, and provide a useful next step.

## Why no runtime dependencies

A GitHub Action sits in a privileged automation path. A dependency-free runtime reduces installation complexity, transitive supply-chain exposure, bundle maintenance, and cold-start cost. Development dependencies can be proposed later only when their value clearly exceeds their maintenance cost.

## Compatibility

The CLI supports Node.js 20 and newer. The GitHub Action runs on GitHub's Node 24 action runtime. The source avoids platform-specific system commands.
