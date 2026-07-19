import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePullRequest } from '../src/analyze.js';
import { renderMarkdown, renderText } from '../src/render.js';
import { renderSarif } from '../src/sarif.js';

const report = analyzePullRequest({
  pullRequest: { title: 'Change authentication middleware safely', body: 'Detailed context but no tests are included yet.', labels: [] },
  files: [{ filename: 'src/auth/login.js', additions: 30 }]
});

test('markdown includes stable marker, score, and evidence', () => {
  const markdown = renderMarkdown(report);
  assert.match(markdown, /<!-- pr-rigor-report -->/);
  assert.match(markdown, /Readiness score/);
  assert.match(markdown, /src\/auth\/login\.js/);
});

test('text rendering is terminal friendly', () => {
  const text = renderText(report);
  assert.match(text, /Status:/);
  assert.match(text, /Score:/);
});

test('SARIF 2.1.0 contains rules and results', () => {
  const sarif = renderSarif(report);
  assert.equal(sarif.version, '2.1.0');
  assert.ok(sarif.runs[0].tool.driver.rules.length > 0);
  assert.ok(sarif.runs[0].results.length > 0);
});
