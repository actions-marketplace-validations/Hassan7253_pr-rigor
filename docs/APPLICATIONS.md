# Open-source program application worksheet

This file helps you describe PR Rigor accurately. Replace every bracketed field with verifiable information and delete claims that are not true.

## Evidence to collect first

- Public repository URL
- Release URL and version
- GitHub Marketplace URL, when published
- Link to a pull request where PR Rigor produced a report
- Number of repositories where it is installed
- Unique external contributors, if any
- Issues closed and pull requests reviewed
- npm downloads, only after publication and only from npm's own statistics
- A short maintainer log describing bugs fixed, releases shipped, and support given

Screenshots can supplement links, but links and repository history are stronger evidence.

## OpenAI Codex for Open Source

### Project and repository

`https://github.com/[OWNER]/pr-rigor`

### What the project does

> PR Rigor is a zero-runtime-dependency GitHub Action and CLI that gives open-source maintainers a deterministic first pass on pull-request readiness. It checks review context, tests, release notes, dependency changes, risky workflow permissions, credential-like files, high-confidence secret patterns, unpinned third-party Actions, migrations, public API changes, generated output, binary artifacts, and oversized diffs. Findings cite observable evidence and include a recovery step. It does not profile contributors, send source code to an external model, or replace human review.

### Reach and importance

Use one of these forms.

**For a new project:**

> PR Rigor was released on [DATE]. It is currently installed on [NUMBER] public repositories and has produced reports on [NUMBER] pull requests. The initial users are [WHO, WITHOUT EXAGGERATION]. The project fills a gap between code linters and human review: it checks whether a change is prepared for review, while keeping repository policy and merge authority with maintainers. Evidence: [RELEASE], [MARKETPLACE OR INSTALLATION], [EXAMPLE PR].

**After adoption:**

> PR Rigor is installed on [NUMBER] repositories, has [NUMBER] npm downloads in the latest verified period, and has received contributions from [NUMBER] external contributors. Maintainers use it to standardize the review-preparation pass without sending code to a third-party model. Evidence: [LINKS].

### How the subscription would be used

> I would use Codex for maintainer work: reproducing bug reports, designing regression fixtures across JavaScript, Python, Rust, Go, Ruby, and Java repositories, reviewing external pull requests, improving SARIF output, hardening the GitHub Action security model, preparing releases, and writing clear migration documentation. I would keep deterministic checks and human merge authority as project constraints.

### Other information

> The project has zero runtime dependencies, a documented threat model, CI across supported Node versions, CodeQL analysis, a public roadmap, a security policy, and maintainer-controlled waiver labels. Current limitations and adoption numbers are documented openly rather than inferred.

## Anthropic Claude for Open Source

Anthropic publishes numeric examples. A new project generally will not meet them immediately. Apply through the “quietly depends on” path only when you can explain concrete ecosystem value, and state clearly which thresholds you do not yet meet.

### Tell us about the project's reach and impact

> PR Rigor is a deterministic GitHub Action and CLI for the first pass of open-source pull-request review. It checks review context, testing signals, dependency and workflow changes, probable secrets, migrations, public API changes, generated output, and binary artifacts without profiling contributors or sending code to an external model. Since release on [DATE], it has been installed on [NUMBER] repositories, analyzed [NUMBER] pull requests, and received [NUMBER] external contributions. It addresses a recurring maintainer gap: linters check code, but maintainers still need a consistent way to identify whether a change is ready for focused human review. Verifiable evidence: [LINKS].

For a new project, add this sentence:

> The project does not yet meet the published dependency, download, contributor, pull-request, or criticality examples; I am applying under the invitation for projects that may quietly support ecosystem maintenance.

### How will you use the subscription for your project?

> I will use Claude to maintain PR Rigor: investigate issues, review and test community contributions, create language-specific fixtures, improve false-positive handling, document secure `pull_request_target` usage, expand SARIF interoperability, and plan backward-compatible releases. The subscription would reduce the time required for review, test design, release notes, and contributor support while the project remains free and open source.

### Other info

> PR Rigor is MIT-licensed, has no telemetry and no runtime dependencies, and documents its security boundaries. Its reports are deterministic and evidence-backed. It never claims that a contributor or change is AI-generated and never makes merge decisions.

## What not to write

Do not write that the project has users because friends starred it. Do not count your own test repositories as independent adoption without labeling them. Do not call GitHub activity “contributors” unless other people had merged changes. Do not confuse OpenSSF Scorecard with OpenSSF Criticality Score. Do not imply that application acceptance is guaranteed.
