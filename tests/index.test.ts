import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import pkg from '../lib/index.js';
import { sendNotification } from '../lib/index.js';

const SLACK_WEBHOOK_URL = 'https://example.invalid/webhook';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.SLACK_WEBHOOK_URL;
});

describe('Package exports', () => {
  it('default export is an object', () => {
    assert.equal(typeof pkg, 'object');
  });

  it('default export exposes sendNotification', () => {
    assert.equal(typeof (pkg as Record<string, unknown>).sendNotification, 'function');
  });

  it('named export sendNotification exists', () => {
    assert.equal(typeof sendNotification, 'function');
  });
});

describe('sendNotification', () => {
  it('throws ValidationError when webhook URL is missing', async () => {
    await assert.rejects(() => sendNotification('hi'), (err: any) => {
      assert.equal(err?.name, 'ValidationError');
      return true;
    });
  });

  it('sends a webhook with expected payload', async () => {
    process.env.SLACK_WEBHOOK_URL = SLACK_WEBHOOK_URL;

    const seen = { body: undefined as unknown };
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      assert.equal(init?.method, 'POST');
      assert.equal((init?.headers as Record<string, string>)['content-type'], 'application/json; charset=utf-8');
      seen.body = JSON.parse(String(init?.body));
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    await sendNotification('Hello', {
      channel: '#general',
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '*Hello*' } }],
      attachments: [{ fallback: 'Hello', color: '#36a64f' }],
      retries: 0,
      retryDelayMs: 0,
    });

    assert.deepEqual(seen.body, {
      text: 'Hello',
      channel: '#general',
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '*Hello*' } }],
      attachments: [{ fallback: 'Hello', color: '#36a64f' }],
    });
  });

  it('throws SlackApiError on non-2xx', async () => {
    process.env.SLACK_WEBHOOK_URL = SLACK_WEBHOOK_URL;

    globalThis.fetch = (async () => {
      return new Response('invalid_payload', { status: 400 });
    }) as typeof fetch;

    await assert.rejects(() => sendNotification('Hello', { retries: 0 }), (err: any) => {
      assert.equal(err?.name, 'SlackApiError');
      assert.equal(err.status, 400);
      assert.equal(err.responseBody, 'invalid_payload');
      assert.equal(err.code, 'invalid_payload');
      assert.equal(err.retryable, false);
      return true;
    });
  });

  it('does not retry known non-retryable webhook errors', async () => {
    process.env.SLACK_WEBHOOK_URL = SLACK_WEBHOOK_URL;

    const callCounter = { count: 0 };
    globalThis.fetch = (async () => {
      callCounter.count++;
      return new Response('action_prohibited', { status: 403 });
    }) as typeof fetch;

    await assert.rejects(() => sendNotification('Hello', { retries: 3, retryDelayMs: 0 }), (err: any) => {
      assert.equal(err?.name, 'SlackApiError');
      assert.equal(err.code, 'action_prohibited');
      assert.equal(err.retryable, false);
      return true;
    });

    assert.equal(callCounter.count, 1);
  });

  it('retries transient failures', async () => {
    process.env.SLACK_WEBHOOK_URL = SLACK_WEBHOOK_URL;

    const callCounter = { count: 0 };
    globalThis.fetch = (async () => {
      callCounter.count++;
      if (callCounter.count === 1) return new Response('oops', { status: 500 });
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    await sendNotification('Hello', { retries: 1, retryDelayMs: 0 });
    assert.equal(callCounter.count, 2);
  });
});
