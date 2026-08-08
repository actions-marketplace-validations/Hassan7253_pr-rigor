# Roadmap

Roadmap items are proposals, not promises.

## Near term

- Add independently sourced real-world evaluation fixtures as adopters report false positives and edge cases
- Track benchmark history across releases without turning synthetic metrics into adoption claims
- Ecosystem fixtures for Python, Rust, Go, Ruby, Java, and PHP
- More precise manifest-to-lockfile relationships
- SARIF validation fixtures and code-scanning documentation
- Configurable report wording for internationalization
- Better handling of truncated GitHub patches
- Repository configuration examples from real adopters

## Later

- GitLab merge-request adapter using the same analysis core
- Declarative custom rules that cannot execute arbitrary code
- Organization-level reusable workflow examples
- Release-note and changeset ecosystem presets
- Optional machine-readable policy waivers with expiration dates

## Non-goals

- Contributor reputation or account-age scoring
- Guessing whether code was produced by AI
- Automatic merge approval
- Executing untrusted pull-request code in privileged workflows
- Replacing tests, SAST, dependency auditing, or human review
