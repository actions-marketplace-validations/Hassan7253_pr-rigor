# Contributing

Thank you for helping maintainers get clearer pull requests.

## Before opening a change

Open or find an issue for behavior changes. Small documentation and fixture fixes can go directly to a pull request.

```bash
npm install
npm run check
```

## Rule requirements

A new rule must:

1. Inspect observable pull-request or changed-file evidence.
2. Avoid contributor identity, account history, or inferred intent.
3. Include a concrete recovery step.
4. Be configurable and conservative by default.
5. Include passing and failing fixtures.
6. Document false-positive boundaries.

Rules that claim to detect “AI-generated code,” contributor trustworthiness, or semantic correctness will not be accepted.

## Pull requests

Keep changes focused. Explain the problem, approach, tests, compatibility impact, and security implications. Add or update tests before requesting review.

## Reporting false positives

Include a minimized file list, relevant patches with secrets removed, configuration, expected result, and actual result. A public repository link is helpful but not required.
