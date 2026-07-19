import test from 'node:test';
import assert from 'node:assert/strict';
import { configTemplate, resolveConfig, validateConfig } from '../src/config.js';

test('resolves a preset and user override', () => {
  const config = resolveConfig({ preset: 'library', rules: { 'missing-tests': { level: 'fail' } } });
  assert.equal(config.preset, 'library');
  assert.equal(config.rules['missing-tests'].level, 'fail');
  assert.equal(config.rules['public-api-change'].level, 'warn');
});

test('rejects unknown presets', () => {
  assert.throws(() => resolveConfig({ preset: 'chaos' }), /Unknown preset/);
});

test('rejects unknown rules and invalid levels', () => {
  assert.throws(() => validateConfig({
    rules: { imaginary: { level: 'maybe' } },
    paths: {},
    skipLabels: [],
    waiverLabels: {},
    scoring: { warn: 1, fail: 2 }
  }), /Unknown rule/);
});

test('configuration template is valid JSON', () => {
  const parsed = JSON.parse(configTemplate('strict'));
  assert.equal(parsed.preset, 'strict');
});
