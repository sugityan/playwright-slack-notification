const { afterEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');

const pkg = require('../lib/index.js');

// Use a dummy URL that does NOT match Slack's webhook pattern.
// GitHub Push Protection blocks commits that contain Slack webhook-like URLs.
const SLACK_WEBHOOK_URL = 'https://example.invalid/webhook';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.SLACK_WEBHOOK_URL;
});

describe('Package exports', () => {
  it('default export is an object', () => {
    assert.equal(typeof pkg.default, 'object');
  });

  it('default export exposes sendNotification', () => {
    assert.deepEqual(Object.keys(pkg.default), ['sendNotification']);
  });

  it('named export sendNotification exists', () => {
    assert.equal(typeof pkg.sendNotification, 'function');
  });
});

describe('sendNotification', () => {
  it('throws ValidationError when webhook URL is missing', async () => {
    await assert.rejects(() => pkg.sendNotification('hi'), (err) => {
      assert.equal(err?.name, 'ValidationError');
      return true;
    });
  });

  it('sends a webhook with expected payload', async () => {
    process.env.SLACK_WEBHOOK_URL = SLACK_WEBHOOK_URL;

    let seenBody;
    globalThis.fetch = async (_input, init) => {
      assert.equal(init.method, 'POST');
      assert.equal(init.headers['content-type'], 'application/json; charset=utf-8');
      seenBody = JSON.parse(init.body);
      return new Response('ok', { status: 200 });
    };

    await pkg.sendNotification('Hello', {
      channel: '#general',
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '*Hello*' } }],
      attachments: [{ fallback: 'Hello', color: '#36a64f' }],
      retries: 0,
      retryDelayMs: 0,
    });

    assert.deepEqual(seenBody, {
      text: 'Hello',
      channel: '#general',
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '*Hello*' } }],
      attachments: [{ fallback: 'Hello', color: '#36a64f' }],
    });
  });

  it('throws SlackApiError on non-2xx', async () => {
    process.env.SLACK_WEBHOOK_URL = SLACK_WEBHOOK_URL;

    globalThis.fetch = async () => {
      return new Response('invalid_payload', { status: 400 });
    };

    await assert.rejects(() => pkg.sendNotification('Hello', { retries: 0 }), (err) => {
      assert.equal(err?.name, 'SlackApiError');
      assert.equal(err.status, 400);
      assert.equal(err.responseBody, 'invalid_payload');
      return true;
    });
  });

  it('retries transient failures', async () => {
    process.env.SLACK_WEBHOOK_URL = SLACK_WEBHOOK_URL;

    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      if (calls === 1) return new Response('oops', { status: 500 });
      return new Response('ok', { status: 200 });
    };

    await pkg.sendNotification('Hello', { retries: 1, retryDelayMs: 0 });
    assert.equal(calls, 2);
  });
});
