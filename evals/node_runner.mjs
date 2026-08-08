import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { analyzePullRequest } from '../src/analyze.js';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let payload;
try {
  payload = JSON.parse(raw || '{}');
} catch (error) {
  console.error(`eval node runner: invalid JSON input: ${error.message}`);
  process.exit(2);
}

if (!Array.isArray(payload.cases)) {
  console.error('eval node runner: payload.cases must be an array');
  process.exit(2);
}

const results = [];
for (const item of payload.cases) {
  const started = performance.now();
  try {
    const report = analyzePullRequest(item.input || {}, item.config || {}, item.preset || '');
    results.push({
      id: item.id,
      ok: true,
      durationMs: Number((performance.now() - started).toFixed(4)),
      status: report.status,
      score: report.score,
      findingIds: report.findings.map((finding) => finding.id),
      findings: report.findings.map((finding) => ({
        id: finding.id,
        level: finding.level,
        category: finding.category,
        title: finding.title
      }))
    });
  } catch (error) {
    results.push({
      id: item.id,
      ok: false,
      durationMs: Number((performance.now() - started).toFixed(4)),
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

process.stdout.write(`${JSON.stringify({ schemaVersion: 1, results })}\n`);
