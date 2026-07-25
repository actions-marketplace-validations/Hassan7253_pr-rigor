# PR Rigor

[![CI](https://github.com/Hassan7253/pr-rigor/actions/workflows/ci.yml/badge.svg)](https://github.com/Hassan7253/pr-rigor/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Hassan7253/pr-rigor/actions/workflows/codeql.yml/badge.svg)](https://github.com/Hassan7253/pr-rigor/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Deterministic pull-request readiness and supply-chain checks for open-source maintainers.**

PR Rigor performs the repeatable first pass before a human review. It identifies missing context, absent tests, risky workflow permission changes, probable credential files, high-confidence secret patterns, unpinned third-party Actions, dependency changes, migrations, public API changes, generated-file noise, and oversized diffs.

It does **not** score contributors, guess whether code was AI-generated, automatically approve a pull request, or send repository data to an external model.

## Why it is useful

Linters answer “does this code follow a rule?” PR Rigor answers “is this change prepared for focused human review?” Every finding cites observable evidence and provides a recovery step. Repository maintainers keep final authority.

## Highlights

- 27 deterministic checks across reviewability, testing, security, supply chain, release readiness, and compatibility
- One stable GitHub comment that is updated instead of duplicated
- GitHub step summary and file annotations
- SARIF 2.1.0 output for code-scanning integrations
- Local CLI for public or private GitHub pull requests
- Four presets: `balanced`, `strict`, `library`, and `docs`
- Maintainer-controlled waiver and skip labels
- Configuration loaded from the trusted base commit
- Blocking detection for unsafe `pull_request_target` checkout of pull-request-controlled code
- Zero runtime dependencies on Node.js 20+
- No telemetry, contributor profiling, or external AI service

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

No checkout is required. The action reads pull-request metadata through GitHub’s API and loads `.pr-rigor.json` from the **base commit**, not from untrusted pull-request code.

> Never add `actions/checkout` of a fork’s head commit to this `pull_request_target` job and never execute code from the pull request in it. See [the security model](docs/SECURITY-MODEL.md).

## Example report

```text
Status: FAIL  Score: 45/100

🛑 New broad GitHub Actions write permissions were detected.
⚠️ Source changed without test changes.
⚠️ A dependency manifest changed.
⚠️ A migration or schema file changed.
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

The runtime uses only Node.js built-ins. Tests use `node:test`.

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

## Contributing

Real-world fixtures, language presets, clearer recovery guidance, and false-positive reductions are especially valuable. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

MIT

## Maintainer note
PR Rigor is actively maintained, tested on its own pull requests, and open to community feedback.
