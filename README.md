# PR Rigor

Deterministic pull-request quality gates and evaluation infrastructure for maintainers who want review evidence they can inspect, reproduce, and challenge.

[![GitHub release](https://img.shields.io/github/v/release/Hassan7253/pr-rigor?display_name=tag&sort=semver)](https://github.com/Hassan7253/pr-rigor/releases)
[![GitHub Marketplace](https://img.shields.io/badge/GitHub%20Marketplace-PR%20Rigor-2ea44f?logo=github)](https://github.com/marketplace/actions/pr-rigor)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)](package.json)

PR Rigor started as a deterministic first-pass reviewer for pull requests. It now includes two evaluation labs that apply the same principle to the measurement system itself: if a tool produces a score, the score should earn trust through explicit cases, reproducible execution, failure analysis, and regression testing.

## Three layers of evidence

| Layer | Question | What is measured |
| --- | --- | --- |
| **PR Rigor** | Is this pull request prepared for focused human review? | 27 deterministic checks across reviewability, testing, security-sensitive workflow changes, supply chain, release readiness, and compatibility |
| **Eval Lab** | Does PR Rigor itself measure those signals accurately? | 71 labeled synthetic PR scenarios, precision/recall/F1, exact finding-set and status accuracy, slice metrics, latency, and corpus-bound regression baselines |
| **Agentic Eval Lab** | Can an evaluation distinguish robust task behavior from benchmark or environment brittleness? | repeated trials, deterministic graders, irrelevant environment perturbations, uncertainty, failure taxonomy, environment consistency, and paired-bootstrap regression gating |

The common structure is:

```text
system under test
    -> observable behavior
    -> labeled or deterministic cases
    -> scoring
    -> failure analysis
    -> regression detection
    -> trustworthy measurement
```

## Agentic Eval Lab

The development-only Agentic Eval Lab extends PR Rigor's evaluator-of-the-evaluator approach into small synthetic coding environments. Every episode starts from a fresh workspace, applies a controlled environment condition, runs a local agent command, and grades only observable outcomes with deterministic oracles.

A built-in negative control compares a robust reference agent with a deliberately brittle reference that fails when a semantically irrelevant file appears. If the harness cannot distinguish those behaviors, the metric should not be trusted.

The lab reports:

- repeated-trial task success with 95% Wilson intervals
- grader-score variance and task-slice metrics
- environment consistency under irrelevant workspace perturbations
- separate task, agent, timeout, grader, and harness failure classes
- seeded paired-bootstrap comparison against a committed baseline

The committed corpus is synthetic and intentionally small. It demonstrates evaluation mechanics, not frontier-model accuracy or capability.

See [Agentic evaluation methodology](docs/AGENTIC-EVALS.md) and the [Agentic Eval Lab guide](evals/agentic/README.md).

## Core Action

The GitHub Action remains deterministic and dependency-light. It does not score contributors, guess whether code was AI-generated, automatically approve a pull request, send repository data to an external model, or add telemetry.

Every finding is tied to observable repository evidence and a concrete recovery step. Maintainers keep final authority.

## Thirty-second installation

Create `.github/workflows/pr-rigor.yml` in the repository you want to protect:

```yaml
name: PR Rigor

on:
  pull_request_target:
    types: [opened, edited, synchronize, reopened, ready_for_review, labeled, unlabeled]

permissions:
  contents: read
  pull-requests: write

jobs:
  readiness:
    runs-on: ubuntu-latest
    steps:
      - uses: Hassan7253/pr-rigor@v1
        with:
          token: ${{ github.token }}
```

No checkout is required. The action reads pull-request metadata through GitHubÃ¢â‚¬â„¢s API and loads `.pr-rigor.json` from the **base commit**, not from untrusted pull-request code.

> Never add `actions/checkout` of a forkÃ¢â‚¬â„¢s head commit to this `pull_request_target` job and never execute code from the pull request in it. See [the security model](docs/SECURITY-MODEL.md).

## Example report

```text
Status: FAIL  Score: 45/100

Ã°Å¸â€ºâ€˜ New broad GitHub Actions write permissions were detected.
Ã¢Å¡Â Ã¯Â¸Â Source changed without test changes.
Ã¢Å¡Â Ã¯Â¸Â A dependency manifest changed.
Ã¢Å¡Â Ã¯Â¸Â A migration or schema file changed.
```

The Markdown report includes exact paths and a next step for each signal. See [the generated example](examples/generated-report.md).

## CLI

Run without installing globally:

```bash
npx @hassan7253/pr-rigor github owner/repository#123
```

Or install it:

```bash
npm install --global @hassan7253/pr-rigor
pr-rigor init --preset library
pr-rigor validate
GITHUB_TOKEN=github_pat_... pr-rigor github owner/repository#123
```

Analyze saved fixtures without network access:

```bash
pr-rigor analyze \
  --event examples/event.json \
  --files examples/files.json \
  --format markdown
```

Supported formats are `markdown`, `text`, `json`, and `sarif`.

## Configuration

Start with:

```bash
pr-rigor init --preset balanced
```

A small configuration can be enough:

```json
{
  "$schema": "./schemas/pr-rigor.schema.json",
  "preset": "library",
  "rules": {
    "required-sections": {
      "level": "warn",
      "sections": ["Summary", "Testing", "Compatibility"]
    },
    "missing-issue-link": { "level": "warn" },
    "missing-changelog": { "level": "warn" }
  },
  "paths": {
    "ignore": ["docs/generated/**"]
  }
}
```

Rule levels are `off`, `info`, `warn`, and `fail`. Read [Configuration](docs/CONFIGURATION.md) and [Rules](docs/RULES.md).

## SARIF

Generate SARIF locally:

```bash
pr-rigor github owner/repository#123 \
  --format sarif \
  --output pr-rigor.sarif
```

Or from the Action:

```yaml
- uses: Hassan7253/pr-rigor@v1
  with:
    token: ${{ github.token }}
    sarif-output: pr-rigor.sarif
```

Uploading SARIF to GitHub code scanning requires the appropriate `security-events` permission and GitHub plan/repository support. The core Action does not require that permission.

## Maintainer waivers

Waivers are explicit labels controlled by repository maintainers:

- `pr-rigor:tests-not-needed`
- `pr-rigor:changelog-not-needed`
- `pr-rigor:generated-ok`
- `pr-rigor:risk-reviewed`
- `pr-rigor:skip`

Repositories can rename or remove them in configuration. A waiver is shown in the report and is never inferred from contributor identity.

## Development

```bash
git clone https://github.com/Hassan7253/pr-rigor.git
cd pr-rigor
npm install
npm run check
npm run test:coverage
```

The runtime uses only Node.js built-ins. Tests use `node:test`. The optional development-only [Eval Lab](evals/README.md) uses Python standard-library tooling to benchmark the analyzer against a labeled scenario corpus.

Run the system-level evaluation locally with:

```bash
python evals/run_evals.py --fail-on-regression
```

## Agentic Eval Lab

PR Rigor also includes a development-only, vendor-neutral coding-agent evaluation harness. It runs agents in fresh synthetic workspaces, grades observable outcomes with deterministic oracles, repeats trials, perturbs semantically irrelevant environment details, reports uncertainty and failure classes, and compares results against a committed baseline.

The included robust and intentionally brittle reference agents act as positive and known-negative controls for the measurement system. The goal is to test whether the evaluation can distinguish genuine task robustness from benchmark or environment brittleness.

```bash
python -m unittest evals.agentic.test_agent_evals
python evals/agentic/run_agent_evals.py \
  --agent "python evals/agentic/fixture_agent.py --profile robust" \
  --repeat 3 \
  --out evals/out/agentic \
  --baseline evals/agentic/baseline.json \
  --fail-on-regression
```

See [Agentic Eval Lab](evals/agentic/README.md) and the [measurement methodology](docs/AGENTIC-EVALS.md).
## Project documents

- [Upload and publish guide](docs/UPLOAD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY-MODEL.md)
- [Rule reference](docs/RULES.md)
- [Configuration](docs/CONFIGURATION.md)
- [Adoption playbook](docs/ADOPTION.md)
- [Release process](docs/RELEASING.md)
- [Open-source program application worksheet](docs/APPLICATIONS.md)
- [Roadmap](docs/ROADMAP.md)
- [Eval Lab](evals/README.md)

## Contributing

Real-world fixtures, language presets, clearer recovery guidance, and false-positive reductions are especially valuable. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

MIT

## Maintainer note
PR Rigor is actively maintained, tested on its own pull requests, and open to community feedback.
