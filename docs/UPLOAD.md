# Upload and publish PR Rigor

This guide takes the downloaded project from a folder on your computer to a public GitHub Action and optional npm package.

## 1. Install the prerequisites

Install:

- Git
- Node.js 20 or newer
- A GitHub account with two-factor authentication
- GitHub CLI (`gh`) for the fastest path, or use the browser instructions below

Confirm the tools:

```bash
git --version
node --version
npm --version
gh --version
```

## 2. Unzip and customize

```bash
unzip pr-rigor-v1.zip
cd pr-rigor-v1
npm run customize -- \
  --owner YOUR_GITHUB_USERNAME \
  --name "YOUR DISPLAY NAME" \
  --npm-scope YOUR_NPM_USERNAME
npm install
npm run check
```

The npm scope can be the same as your GitHub username. Skip npm publishing entirely when you only want the GitHub Action.

Check that no placeholders remain:

```bash
grep -R "Hassan7253\|hassan7253\|Hassan7253" . \
  --exclude-dir=.git \
  --exclude=package-lock.json
```

The command should print nothing.

## 3. Create the GitHub repository with the CLI

From inside the project folder:

```bash
git init
git add .
git commit -m "Initial release of PR Rigor"
git branch -M main

gh repo create pr-rigor \
  --public \
  --description "Deterministic pull-request readiness and supply-chain checks for maintainers" \
  --source . \
  --remote origin \
  --push
```

Then open the repository:

```bash
gh repo view --web
```

### Browser-only alternative

1. Open GitHub and select **New repository**.
2. Name it `pr-rigor`.
3. Set visibility to **Public**.
4. Do not initialize it with a README, license, or `.gitignore`; those files are already included.
5. Select **Create repository**.
6. Run the “push an existing repository” commands GitHub displays.

## 4. Verify GitHub Actions

Open the repository’s **Actions** tab. The `CI` and `CodeQL` workflows should start after the push.

A green CI run verifies syntax, all tests, the demo report, and SARIF generation. Do not claim the project is operational until CI is green.

## 5. Protect the main branch

In the repository:

1. Open **Settings → Rules → Rulesets**.
2. Create a branch ruleset targeting `main`.
3. Require a pull request before merging.
4. Require the `test` status checks after they have appeared once.
5. Block force pushes and branch deletion.
6. Require conversation resolution.

For a solo project, one approval can be optional initially. The important part is that future changes go through visible pull requests and passing CI.

## 6. Open a real dogfood pull request

Do not push the first improvement directly to `main`. Exercise the project through its own workflow:

```bash
git switch -c docs/clarify-first-run
printf '\nFirst-run feedback is welcome in GitHub Discussions.\n' >> docs/ADOPTION.md
git add docs/ADOPTION.md
git commit -m "docs: clarify first-run feedback"
git push -u origin docs/clarify-first-run
gh pr create \
  --title "Clarify first-run feedback path" \
  --body "## Summary

Clarifies where early users can report first-run feedback.

## Testing

Documentation-only change."
```

Merge it only after CI passes. This creates legitimate evidence that the Action and maintainer workflow are functional.

## 7. Create the first release

Use a semantic version tag and a release-specific tag:

```bash
git switch main
git pull --ff-only
git tag -a v1.0.0 -m "PR Rigor v1.0.0"
git tag -f v1 v1.0.0
git push origin v1.0.0
git push origin v1 --force

gh release create v1.0.0 \
  --title "PR Rigor v1.0.0" \
  --notes-file CHANGELOG.md
```

For future releases, create `v1.0.1`, `v1.1.0`, and so on, then move the major `v1` tag after verification. Consider enabling GitHub immutable releases once your release workflow is settled.

## 8. Publish to GitHub Marketplace

1. Open `action.yml` on GitHub.
2. Select the banner to **Draft a release** or open an existing release for the Action.
3. Select **Publish this Action to the GitHub Marketplace**.
4. Accept the Marketplace Developer Agreement if prompted.
5. Choose categories such as **Code quality** and **Security**.
6. Publish the release.

The Action name must be unique in Marketplace. If `PR Rigor` is unavailable, change only the `name` field in `action.yml` to a distinctive name such as `PR Rigor Checks`; the repository and package can remain `pr-rigor`.

## 9. Install it on another repository

Create `.github/workflows/pr-rigor.yml` in a repository you actually maintain:

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
      - uses: YOUR_GITHUB_USERNAME/pr-rigor@v1
        with:
          token: ${{ github.token }}
```

Open a harmless documentation pull request and confirm that PR Rigor adds a report. This is stronger evidence than stars from friends because it proves actual use.

## 10. Optional npm publication

First confirm the scoped package name:

```bash
cat package.json | grep '"name"'
npm login
npm publish --access public --provenance
```

After the first package exists, configure npm trusted publishing for `.github/workflows/publish-npm.yml`. Use an npm account with two-factor authentication. Never commit an npm token.

## 11. Repository settings worth enabling

- Discussions, for usage questions and configuration examples
- Dependabot alerts and security updates
- Private vulnerability reporting
- Automatically delete head branches after merge
- Social preview after you create original project artwork
- A repository topic set such as `github-actions`, `maintainer-tools`, `pull-request`, `supply-chain`, and `sarif`

## 12. Before applying to an OSS program

Confirm that all of these statements are true:

- The repository is public.
- CI is green.
- `v1.0.0` and `v1` exist.
- The Marketplace listing or installation workflow works.
- At least one real pull request shows the report.
- Your application uses actual numbers and links.
- You do not claim downloads, users, contributors, or criticality that the project has not earned.

Use [APPLICATIONS.md](APPLICATIONS.md) as a worksheet, not as permission to invent reach.
