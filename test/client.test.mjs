/**
 * Client transport tests (node --test, no extra dependencies).
 *
 * The runner (scripts/run-tests.mjs) compiles src/api/client.ts with the
 * repo's own TypeScript into test/.build/ first. A stubbed global fetch
 * captures exactly what the client would put on the wire in each mode:
 *  - key mode:     Authorization: Bearer <key>, no cookie credentials.
 *  - session mode: credentials: 'include', NO Authorization header — the
 *                  rail resolves the identity session to the org and
 *                  enforces the org's entitlement server-side.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RevRuleClient, RevRuleApiError, toMicros } from './.build/client.js';

function stubFetch(responseBody = {}, status = 200) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => responseBody,
    };
  };
  return calls;
}

test('key mode sends the bearer key and does not include credentials', async () => {
  const calls = stubFetch({ entries: [], chainValid: true });
  const client = new RevRuleClient('secret-key-123', 'https://api.example/v1');
  await client.getLedger('g1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.example/v1/graphs/g1/ledger');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret-key-123');
  assert.notEqual(calls[0].init.credentials, 'include');
});

test('session mode includes credentials and never sends an Authorization header', async () => {
  const calls = stubFetch({ entries: [], chainValid: true });
  const client = new RevRuleClient(null, 'https://api.example/v1', { authMode: 'session' });
  await client.getLedger('g1', { participantId: 'dev' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.example/v1/graphs/g1/ledger?participantId=dev');
  assert.equal(calls[0].init.credentials, 'include');
  assert.equal(calls[0].init.headers.Authorization, undefined);
});

test('forSession builds a session-mode client', () => {
  const client = RevRuleClient.forSession('https://api.payloadhq.dev/v1');
  assert.equal(client.getAuthMode(), 'session');
  assert.equal(client.getKey(), null);
});

test('getSession and checkEntitlement hit the identity endpoints with credentials', async () => {
  const calls = stubFetch({ user_id: 'u1', org_id: 'o1' });
  const client = RevRuleClient.forSession('https://api.payloadhq.dev/v1');
  await client.getSession();
  assert.equal(calls[0].url, 'https://api.payloadhq.dev/v1/auth/session');
  assert.equal(calls[0].init.credentials, 'include');
  assert.equal(calls[0].init.headers.Authorization, undefined);
  await client.checkEntitlement('revrule');
  assert.equal(calls[1].url, 'https://api.payloadhq.dev/v1/auth/entitlements/check?product=revrule');
  assert.equal(calls[1].init.credentials, 'include');
});

test('session mode writes (graph create + event) also ride the cookie only', async () => {
  const calls = stubFetch({ graph: { id: 'g' } });
  const client = RevRuleClient.forSession('https://api.payloadhq.dev/v1');
  await client.createGraph({ id: 'g' });
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.credentials, 'include');
  assert.equal(calls[0].init.headers.Authorization, undefined);
});

test('API errors map to RevRuleApiError with code and status', async () => {
  stubFetch({ error: { code: 'ENTITLEMENT_REQUIRED', message: 'no active entitlement' } }, 403);
  const client = RevRuleClient.forSession('https://api.payloadhq.dev/v1');
  await assert.rejects(client.getLedger('g1'), (e) => {
    assert.ok(e instanceof RevRuleApiError);
    assert.equal(e.code, 'ENTITLEMENT_REQUIRED');
    assert.equal(e.status, 403);
    assert.equal(e.message, 'no active entitlement');
    return true;
  });
});

test('micros conversion stays integer-exact', () => {
  assert.equal(toMicros(22.5), 22_500_000);
  assert.equal(toMicros(0.01), 10_000);
});
