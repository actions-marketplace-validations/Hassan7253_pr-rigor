# Adoption playbook

The project earns credibility through useful installations, bug fixes, and maintainer responsiveness—not through reciprocal stars or filler commits.

## First users

Install PR Rigor on repositories you already maintain. Ask one or two maintainers you know to test it on a real pull request. Give them a short request:

> Could you install this Action on one repository and tell me which findings are useful, noisy, or missing? A public issue with the repository language and configuration is ideal.

Do not ask them to star the repository as a condition of help.

## Useful launch material

Publish:

- one screenshot or link showing a real report;
- one short configuration example for a library;
- one example for a documentation repository;
- a clear list of limitations;
- a “good first issue” tied to a real feature or fixture.

## Good early issues

- Add fixtures for a language or package manager.
- Reduce a documented false positive.
- Improve a recovery suggestion.
- Add a configuration example from a real repository.
- Test SARIF ingestion and document results.
- Translate contributor-facing output.

Avoid creating dozens of empty roadmap issues. A small set of scoped, actionable issues is more credible.

## Evidence log

Maintain a monthly entry with:

- releases shipped;
- public repositories using the Action;
- external issues and pull requests;
- false positives fixed;
- support questions answered;
- verified package download counts.

This log makes future applications factual and easy to update.

## Feedback loop

For each early user:

1. Confirm installation.
2. Ask which rule was most and least useful.
3. Open a public issue for reproducible feedback.
4. Add a regression fixture before changing behavior.
5. Credit the reporter in the release notes.

First-run feedback is welcome in GitHub Discussions.
