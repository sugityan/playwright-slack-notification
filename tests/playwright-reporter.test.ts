import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { PlaywrightSlackReporter } from '../lib/index.js';

const originalFetch = globalThis.fetch;
const originalWebhook = process.env.SLACK_WEBHOOK_URL;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWebhook === undefined) {
    delete process.env.SLACK_WEBHOOK_URL;
  } else {
    process.env.SLACK_WEBHOOK_URL = originalWebhook;
  }
  delete process.env.PLAYWRIGHT_SLACK_NOTIFY;
});

describe('PlaywrightSlackReporter', () => {
  it('is exported from package', () => {
    assert.equal(typeof PlaywrightSlackReporter, 'function');
  });

  it('does not send when webhook is missing', async () => {
    delete process.env.SLACK_WEBHOOK_URL;

    const calls = { count: 0 };
    globalThis.fetch = (async () => {
      calls.count++;
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const reporter = new PlaywrightSlackReporter();
    await reporter.onEnd?.({ status: 'failed' } as any);

    assert.equal(calls.count, 0);
  });

  it('sends Slack notification on failed result', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://example.invalid/webhook';

    const seen = { body: '' };
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      seen.body = String(init?.body ?? '');
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const reporter = new PlaywrightSlackReporter();
    reporter.onTestEnd?.(
      {
        titlePath: () => ['chromium', 'Should make failure'],
        parent: { project: () => ({ name: 'chromium' }) },
        location: { file: 'e2e/basic.spec.ts', line: 3, column: 5 },
      } as any,
      {
        status: 'failed',
        error: {
          message:
            'Error: expect(page).toHaveTitle(expected) failed\\nExpected: "Playwright"\\nReceived: "Playwright E2E"',
        },
      } as any,
    );

    await reporter.onEnd?.({ status: 'failed' } as any);

    const payload = JSON.parse(seen.body) as { text: string };
    assert.equal(typeof payload.text, 'string');
    assert.match(payload.text, /Playwright E2E result: failed/);
    assert.match(payload.text, /Expected: "Playwright"/);
    assert.match(payload.text, /Received: "Playwright E2E"/);
  });

  it('supports always mode via env variable', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://example.invalid/webhook';
    process.env.PLAYWRIGHT_SLACK_NOTIFY = 'always';

    const calls = { count: 0 };
    globalThis.fetch = (async () => {
      calls.count++;
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const reporter = new PlaywrightSlackReporter();
    await reporter.onEnd?.({ status: 'passed' } as any);

    assert.equal(calls.count, 1);
  });

  it('does not send on passed result when notifyMode is failure', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://example.invalid/webhook';

    const calls = { count: 0 };
    globalThis.fetch = (async () => {
      calls.count++;
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const reporter = new PlaywrightSlackReporter({ notifyMode: 'failure' });
    await reporter.onEnd?.({ status: 'passed' } as any);

    assert.equal(calls.count, 0);
  });

  it('sends on passed result when notifyMode is always', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://example.invalid/webhook';

    const calls = { count: 0 };
    globalThis.fetch = (async () => {
      calls.count++;
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const reporter = new PlaywrightSlackReporter({ notifyMode: 'always' });
    await reporter.onEnd?.({ status: 'passed' } as any);

    assert.equal(calls.count, 1);
  });
});
