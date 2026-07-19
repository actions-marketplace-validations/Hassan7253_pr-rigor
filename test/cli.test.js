import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const bin = path.resolve('bin/pr-rigor.js');

test('CLI lists presets', () => {
  const result = spawnSync(process.execPath, [bin, 'presets'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /library/);
});

test('CLI analyzes fixtures and emits JSON', () => {
  const result = spawnSync(process.execPath, [
    bin, 'analyze', '--event', 'examples/event.json', '--files', 'examples/files.json',
    '--format', 'json', '--no-exit-code'
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.tool.name, 'PR Rigor');
  assert.ok(parsed.findings.length > 0);
});
