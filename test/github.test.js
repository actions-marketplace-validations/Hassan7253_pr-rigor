import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchRepositoryJson, githubRequest, upsertComment } from '../src/github.js';

function response(body, options = {}) {
  const status = options.status || 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(options.headers || {}),
    async text() { return typeof body === 'string' ? body : JSON.stringify(body); },
    async json() { return body; }
  };
}

test('githubRequest sends expected API headers and body', async () => {
  let captured;
  const result = await githubRequest('/example', {
    token: 'token-value',
    method: 'POST',
    body: { hello: 'world' },
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return response({ ok: true });
    }
  });
  assert.deepEqual(result, { ok: true });
  assert.match(captured.url, /api\.github\.com\/example/);
  assert.equal(captured.options.headers.Authorization, 'Bearer token-value');
  assert.equal(captured.options.headers['Content-Type'], 'application/json');
  assert.equal(captured.options.body, '{"hello":"world"}');
});

test('githubRequest includes rate-limit reset detail', async () => {
  await assert.rejects(
    githubRequest('/limited', {
      fetchImpl: async () => response({ message: 'rate limited' }, {
        status: 403,
        headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '2000000000' }
      })
    }),
    /Rate limit resets/
  );
});

test('fetchRepositoryJson decodes base64 and treats 404 as absent', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      if (String(url).includes('missing.json')) return response({ message: 'not found' }, { status: 404 });
      return response({ type: 'file', encoding: 'base64', content: Buffer.from('{"preset":"strict"}').toString('base64') });
    };
    assert.deepEqual(await fetchRepositoryJson('owner', 'repo', '.pr-rigor.json', 'abc', 'token'), { preset: 'strict' });
    assert.deepEqual(await fetchRepositoryJson('owner', 'repo', 'missing.json', 'abc', 'token'), {});
  } finally {
    globalThis.fetch = original;
  }
});

test('upsertComment updates a bot comment with the marker', async () => {
  const original = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method || 'GET', body: options.body });
      if (String(url).includes('/comments?')) {
        return response([{ id: 99, body: '<!-- pr-rigor-report --> old', user: { type: 'Bot' } }]);
      }
      return response({ id: 99, body: 'updated' });
    };
    await upsertComment('owner', 'repo', 7, 'token', '<!-- pr-rigor-report --> new');
    assert.ok(calls.some((call) => call.method === 'PATCH' && call.url.endsWith('/issues/comments/99')));
  } finally {
    globalThis.fetch = original;
  }
});
