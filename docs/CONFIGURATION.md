# Configuration

PR Rigor reads `.pr-rigor.json` from the pull request's trusted base commit. The optional `$schema` property enables editor assistance.

## Presets

- `balanced`: conservative defaults; most policy findings are warnings.
- `strict`: requires stronger traceability, release, testing, and supply-chain signals.
- `library`: emphasizes public API compatibility, changelogs, and tests.
- `docs`: disables source-test and release checks that do not fit documentation repositories.

A preset is only a starting point. Repository configuration overrides it.

## Rule configuration

Each rule accepts a `level`:

```json
{
  "rules": {
    "missing-tests": { "level": "fail" },
    "missing-changelog": { "level": "warn" },
    "low-test-ratio": {
      "level": "info",
      "minRatio": 0.15,
      "minCodeLines": 120
    }
  }
}
```

`off` disables a rule. `info` appears in the report but does not reduce the score. `warn` reduces the score and sets the status to `warn`. `fail` is blocking when `fail-on-error` is enabled.

## Paths

Path classes use small glob patterns:

```json
{
  "paths": {
    "code": ["src/**/*.ts"],
    "tests": ["test/**/*.test.ts"],
    "publicApi": ["src/public/**"],
    "ignore": ["docs/generated/**"]
  }
}
```

Providing a path array replaces the preset's array for that class. Copy defaults you still need.

## Waiver labels

Waiver labels are explicit maintainer decisions:

```json
{
  "waiverLabels": {
    "policy:no-tests-needed": ["missing-tests", "low-test-ratio"],
    "policy:release-reviewed": ["missing-changelog", "public-api-change"]
  }
}
```

The report lists waived rule IDs. Labels should be restricted by repository process, not granted automatically from contributor text.

## Skip policy

```json
{
  "skipDrafts": true,
  "skipLabels": ["pr-rigor:skip", "automation:trusted"]
}
```

Skipping removes all checks, so use skip labels sparingly.

## Scoring

```json
{
  "scoring": {
    "warn": 7,
    "fail": 24
  }
}
```

Each rule also has a weight. Scores summarize review preparation; they are not correctness, security, or contributor-quality scores.

## Validation

```bash
pr-rigor validate --config .pr-rigor.json
```

Unknown rules, unknown presets, invalid levels, and malformed path arrays fail validation.
