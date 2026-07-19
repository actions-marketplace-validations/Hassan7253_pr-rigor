import test from 'node:test';
import assert from 'node:assert/strict';
import { globToRegex, matchesAny, normalizePath } from '../src/glob.js';

test('normalizes Windows and relative paths', () => {
  assert.equal(normalizePath('.\\src\\thing.js'), 'src/thing.js');
});

test('double-star matches root and nested files', () => {
  const regex = globToRegex('**/*.test.*');
  assert.equal(regex.test('thing.test.js'), true);
  assert.equal(regex.test('src/thing.test.ts'), true);
  assert.equal(regex.test('src/thing.js'), false);
});

test('matchesAny handles exact and wildcard patterns', () => {
  assert.equal(matchesAny('package.json', ['package.json']), true);
  assert.equal(matchesAny('packages/a/package.json', ['**/package.json']), true);
  assert.equal(matchesAny('src/index.js', ['docs/**']), false);
});
