import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePullRequest } from '../src/analyze.js';

const healthy = {
  title: 'Add bounded retry handling to release uploads',
  body: '## Summary\n\nFixes #42 by adding bounded retry handling for temporary upload failures.\n\n## Testing\n\nAdded focused unit and integration coverage.\n\n## Compatibility\n\nNo public API changes.',
  labels: []
};

function ids(report) {
  return report.findings.map((item) => item.id);
}

test('healthy source and test change passes balanced policy', () => {
  const report = analyzePullRequest({
    pullRequest: healthy,
    files: [
      { filename: 'src/retry.js', additions: 20, deletions: 2 },
      { filename: 'test/retry.test.js', additions: 30, deletions: 0 }
    ]
  });
  assert.equal(report.status, 'pass');
  assert.equal(report.score, 100);
});

test('missing tests warns for source changes', () => {
  const report = analyzePullRequest({ pullRequest: healthy, files: [{ filename: 'src/retry.js', additions: 20 }] });
  assert.equal(report.status, 'warn');
  assert.ok(ids(report).includes('missing-tests'));
});

test('docs-only changes do not trigger test rules', () => {
  const report = analyzePullRequest({ pullRequest: healthy, files: [{ filename: 'docs/retries.md', additions: 50 }] });
  assert.equal(ids(report).includes('missing-tests'), false);
});

test('Python test_ files count as test changes', () => {
  const report = analyzePullRequest({
    pullRequest: healthy,
    files: [
      { filename: 'src/retry.py', additions: 20 },
      { filename: 'evals/test_retry.py', additions: 25 }
    ]
  });
  assert.equal(ids(report).includes('missing-tests'), false);
});

test('strict preset requires headings, issue links, and changelog', () => {
  const report = analyzePullRequest({
    pullRequest: { title: 'Improve parser compatibility', body: 'A detailed explanation without headings or an issue link.', labels: [] },
    files: [
      { filename: 'src/parser.js', additions: 50 },
      { filename: 'test/parser.test.js', additions: 20 }
    ]
  }, { preset: 'strict' });
  assert.ok(ids(report).includes('required-sections'));
  assert.ok(ids(report).includes('missing-issue-link'));
  assert.ok(ids(report).includes('missing-changelog'));
});

test('large diff escalates to fail at failAt', () => {
  const report = analyzePullRequest({
    pullRequest: healthy,
    files: [{ filename: 'src/parser.js', additions: 2100 }]
  });
  assert.equal(report.status, 'fail');
  assert.equal(report.findings.find((item) => item.id === 'large-diff').level, 'fail');
});

test('broad workflow permissions block', () => {
  const report = analyzePullRequest({
    pullRequest: healthy,
    files: [{
      filename: '.github/workflows/release.yml', additions: 2,
      patch: '@@ -1,1 +1,2 @@\n+permissions: write-all'
    }]
  });
  assert.equal(report.status, 'fail');
  assert.ok(ids(report).includes('workflow-permissions'));
});

test('pull_request_target checkout of PR head blocks', () => {
  const report = analyzePullRequest({
    pullRequest: healthy,
    files: [{
      filename: '.github/workflows/review.yml', additions: 8,
      patch: '@@ -0,0 +1,8 @@\n+on:\n+  pull_request_target:\n+jobs:\n+  review:\n+    steps:\n+      - uses: actions/checkout@v4\n+        with:\n+          ref: ${{ github.event.pull_request.head.sha }}'
    }]
  });
  assert.equal(report.status, 'fail');
  assert.ok(ids(report).includes('unsafe-pr-target-checkout'));
});

test('safe pull_request_target metadata workflow is not flagged', () => {
  const report = analyzePullRequest({
    pullRequest: healthy,
    files: [{
      filename: '.github/workflows/review.yml', additions: 6,
      patch: '@@ -0,0 +1,6 @@\n+on:\n+  pull_request_target:\n+jobs:\n+  review:\n+    steps:\n+      - uses: Hassan7253/pr-rigor@v1'
    }]
  });
  assert.equal(ids(report).includes('unsafe-pr-target-checkout'), false);
});

test('pull_request checkout is not treated as privileged target checkout', () => {
  const report = analyzePullRequest({
    pullRequest: healthy,
    files: [{
      filename: '.github/workflows/ci.yml', additions: 8,
      patch: '@@ -0,0 +1,8 @@\n+on:\n+  pull_request:\n+jobs:\n+  test:\n+    steps:\n+      - uses: actions/checkout@v4\n+        with:\n+          ref: ${{ github.event.pull_request.head.sha }}'
    }]
  });
  assert.equal(ids(report).includes('unsafe-pr-target-checkout'), false);
});

test('inline pull_request_target trigger with shell checkout blocks', () => {
  const report = analyzePullRequest({
    pullRequest: healthy,
    files: [{
      filename: '.github/workflows/review.yml', additions: 5,
      patch: '@@ -0,0 +1,5 @@\n+on: [pull_request_target]\n+jobs:\n+  review:\n+    steps:\n+      - run: gh pr checkout ${{ github.event.pull_request.number }}'
    }]
  });
  assert.ok(ids(report).includes('unsafe-pr-target-checkout'));
});

test('default checkout in pull_request_target is not treated as PR-head checkout', () => {
  const report = analyzePullRequest({
    pullRequest: healthy,
    files: [{
      filename: '.github/workflows/review.yml', additions: 6,
      patch: '@@ -0,0 +1,6 @@\n+on:\n+  pull_request_target:\n+jobs:\n+  review:\n+    steps:\n+      - uses: actions/checkout@v7'
    }]
  });
  assert.equal(ids(report).includes('unsafe-pr-target-checkout'), false);
});

test('unsafe checkout input in pull_request_target blocks', () => {
  const report = analyzePullRequest({
    pullRequest: healthy,
    files: [{
      filename: '.github/workflows/review.yml', additions: 1,
      patch: '@@ -1,8 +1,9 @@\n on:\n   pull_request_target:\n jobs:\n   review:\n     steps:\n       - uses: actions/checkout@v7\n         with:\n+          allow-unsafe-pr-checkout: true'
    }]
  });
  assert.ok(ids(report).includes('unsafe-pr-target-checkout'));
});

test('removed unsafe checkout does not trigger a new finding', () => {
  const report = analyzePullRequest({
    pullRequest: healthy,
    files: [{
      filename: '.github/workflows/review.yml', deletions: 2,
      patch: '@@ -1,9 +1,7 @@\n on:\n   pull_request_target:\n jobs:\n   review:\n     steps:\n       - uses: actions/checkout@v4\n-        with:\n-          ref: ${{ github.event.pull_request.head.sha }}'
    }]
  });
  assert.equal(ids(report).includes('unsafe-pr-target-checkout'), false);
});

test('high-confidence secrets are redacted and block', () => {
  const report = analyzePullRequest({
    pullRequest: healthy,
    files: [{
      filename: 'src/config.js', additions: 1,
      patch: '@@ -1,0 +1,1 @@\n+const token = "ghp_abcdefghijklmnopqrstuvwxyz1234567890";'
    }]
  });
  const finding = report.findings.find((item) => item.id === 'secret-pattern');
  assert.equal(report.status, 'fail');
  assert.ok(finding);
  assert.doesNotMatch(JSON.stringify(finding), /ghp_abcdefghijklmnopqrstuvwxyz/);
});

test('credential-like paths block even without patch text', () => {
  const report = analyzePullRequest({
    pullRequest: healthy,
    files: [{ filename: '.env.production', additions: 2 }]
  });
  assert.ok(ids(report).includes('credential-file'));
  assert.equal(report.status, 'fail');
});

test('third-party Actions on mutable refs are detected', () => {
  const report = analyzePullRequest({
    pullRequest: healthy,
    files: [{
      filename: '.github/workflows/ci.yml', additions: 1,
      patch: '@@ -1,0 +1,1 @@\n+  - uses: vendor/tool@v2'
    }]
  });
  assert.ok(ids(report).includes('unpinned-action'));
});

test('official Action owners are exempt by default', () => {
  const report = analyzePullRequest({
    pullRequest: healthy,
    files: [{
      filename: '.github/workflows/ci.yml', additions: 1,
      patch: '@@ -1,0 +1,1 @@\n+  - uses: actions/checkout@v7'
    }]
  });
  assert.equal(ids(report).includes('unpinned-action'), false);
});

test('manifest without lockfile produces supply-chain findings', () => {
  const report = analyzePullRequest({ pullRequest: healthy, files: [{ filename: 'package.json', additions: 2 }] });
  assert.ok(ids(report).includes('dependency-change'));
  assert.ok(ids(report).includes('manifest-without-lockfile'));
});

test('removed tests are surfaced', () => {
  const report = analyzePullRequest({
    pullRequest: healthy,
    files: [
      { filename: 'src/retry.js', additions: 2 },
      { filename: 'test/retry.test.js', status: 'removed', deletions: 20 }
    ]
  });
  assert.ok(ids(report).includes('deleted-tests'));
});

test('waiver label suppresses configured test findings', () => {
  const report = analyzePullRequest({
    pullRequest: { ...healthy, labels: ['pr-rigor:tests-not-needed'] },
    files: [{ filename: 'src/retry.js', additions: 20 }]
  });
  assert.equal(ids(report).includes('missing-tests'), false);
  assert.ok(report.waived.includes('missing-tests'));
});

test('skip label returns skipped report', () => {
  const report = analyzePullRequest({
    pullRequest: { ...healthy, labels: ['pr-rigor:skip'] },
    files: [{ filename: 'src/retry.js', additions: 20 }]
  });
  assert.equal(report.status, 'skipped');
});

test('drafts can be skipped through configuration', () => {
  const report = analyzePullRequest({
    pullRequest: { ...healthy, draft: true },
    files: []
  }, { skipDrafts: true });
  assert.equal(report.status, 'skipped');
});

test('low test ratio is a configurable signal', () => {
  const report = analyzePullRequest({
    pullRequest: healthy,
    files: [
      { filename: 'src/retry.js', additions: 200 },
      { filename: 'test/retry.test.js', additions: 5 }
    ]
  }, { rules: { 'low-test-ratio': { level: 'warn', minRatio: 0.1, minCodeLines: 100 } } });
  assert.ok(ids(report).includes('low-test-ratio'));
});

test('migration and public API paths are identified', () => {
  const report = analyzePullRequest({
    pullRequest: healthy,
    files: [
      { filename: 'db/migrations/001.sql', additions: 5 },
      { filename: 'src/index.js', additions: 3 },
      { filename: 'test/index.test.js', additions: 4 }
    ]
  }, { preset: 'library' });
  assert.ok(ids(report).includes('migration-change'));
  assert.ok(ids(report).includes('public-api-change'));
});

test('generated-heavy and binary changes are identified', () => {
  const report = analyzePullRequest({
    pullRequest: healthy,
    files: [
      { filename: 'dist/a.js', additions: 10 },
      { filename: 'dist/b.js', additions: 10 },
      { filename: 'dist/c.js', additions: 10 },
      { filename: 'assets/tool.exe', additions: 1 }
    ]
  });
  assert.ok(ids(report).includes('generated-heavy'));
  assert.ok(ids(report).includes('binary-change'));
});
