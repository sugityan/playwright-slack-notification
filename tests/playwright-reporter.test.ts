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
  delete process.env.SLACK_BOT_TOKEN;
  delete process.env.SLACK_BOT_CHANNEL_ID;
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

  it('posts error reasons to thread via Slack bot user when enabled', async () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    process.env.SLACK_BOT_CHANNEL_ID = 'C1234567890';

    const payloads: Array<{ text: string; thread_ts?: string }> = [];
    const calls = { count: 0 };
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      calls.count += 1;
      const body = JSON.parse(String(init?.body ?? '{}')) as { text: string; thread_ts?: string };
      payloads.push(body);
      if (calls.count === 1) {
        return new Response('{"ok":true,"ts":"1742600000.123456"}', { status: 200 });
      }
      return new Response('{"ok":true,"ts":"1742600001.123456"}', { status: 200 });
    }) as typeof fetch;

    const reporter = new PlaywrightSlackReporter({ errorDetailsInThread: true });
    reporter.onTestEnd?.(
      {
        titlePath: () => ['chromium', 'thread details test'],
        parent: { project: () => ({ name: 'chromium' }) },
        location: { file: 'e2e/thread.spec.ts', line: 10, column: 2 },
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

    assert.equal(payloads.length, 2);
    assert.equal(payloads[0].thread_ts, undefined);
    assert.match(payloads[0].text, /Playwright E2E result: failed/);
    assert.equal(payloads[1].thread_ts, '1742600000.123456');
    assert.match(payloads[1].text, /Failed test error reasons:/);
    assert.match(payloads[1].text, /Expected: "Playwright"/);
    assert.doesNotMatch(payloads[1].text, /details:/);
  });

  it('uses parent ts returned from bot API as thread ts for detail post', async () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    process.env.SLACK_BOT_CHANNEL_ID = 'C1234567890';

    const payloads: Array<{ text: string; thread_ts?: string }> = [];
    const calls = { count: 0 };
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      calls.count += 1;
      const body = JSON.parse(String(init?.body ?? '{}')) as { text: string; thread_ts?: string };
      payloads.push(body);

      if (calls.count === 1) {
        return new Response('{"ok":true,"ts":"1742600000.123456"}', { status: 200 });
      }
      return new Response('{"ok":true,"ts":"1742600001.123456"}', { status: 200 });
    }) as typeof fetch;

    const reporter = new PlaywrightSlackReporter({ errorDetailsInThread: true });
    reporter.onTestEnd?.(
      {
        titlePath: () => ['chromium', 'bot thread ts test'],
        parent: { project: () => ({ name: 'chromium' }) },
        location: { file: 'e2e/bot-thread.spec.ts', line: 8, column: 3 },
      } as any,
      {
        status: 'failed',
        error: {
          message: 'Error: first line\\nsecond line',
        },
      } as any,
    );

    await reporter.onEnd?.({ status: 'failed' } as any);

    assert.equal(payloads.length, 2);
    assert.equal(payloads[0].thread_ts, undefined);
    assert.equal(payloads[1].thread_ts, '1742600000.123456');
  });

  it('falls back to inline details when bot settings are missing', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://example.invalid/webhook';
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_BOT_CHANNEL_ID;

    const payloads: Array<{ text: string; thread_ts?: string }> = [];
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      payloads.push(JSON.parse(String(init?.body ?? '{}')) as { text: string; thread_ts?: string });
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const reporter = new PlaywrightSlackReporter({ errorDetailsInThread: true });
    reporter.onTestEnd?.(
      {
        titlePath: () => ['chromium', 'inline fallback test'],
        parent: { project: () => ({ name: 'chromium' }) },
        location: { file: 'e2e/fallback.spec.ts', line: 2, column: 1 },
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

    assert.equal(payloads.length, 1);
    assert.equal(payloads[0].thread_ts, undefined);
    assert.match(payloads[0].text, /details:/);
    assert.match(payloads[0].text, /Expected: "Playwright"/);
  });

  it('does not include error content when showErrorDetails is false (webhook mode)', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://example.invalid/webhook';

    const payloads: Array<{ text: string }> = [];
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      payloads.push(JSON.parse(String(init?.body ?? '{}')) as { text: string });
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const reporter = new PlaywrightSlackReporter({ showErrorDetails: false });
    reporter.onTestEnd?.(
      {
        titlePath: () => ['chromium', 'hide error content webhook'],
        parent: { project: () => ({ name: 'chromium' }) },
        location: { file: 'e2e/no-details.spec.ts', line: 4, column: 1 },
      } as any,
      {
        status: 'failed',
        error: {
          message: 'Error: internal detail\\nExpected: "A"\\nReceived: "B"',
        },
      } as any,
    );

    await reporter.onEnd?.({ status: 'failed' } as any);

    assert.equal(payloads.length, 1);
    assert.doesNotMatch(payloads[0].text, /reason:/);
    assert.doesNotMatch(payloads[0].text, /details:/);
    assert.doesNotMatch(payloads[0].text, /Expected:/);
  });

  it('does not post thread details when showErrorDetails is false (bot mode)', async () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    process.env.SLACK_BOT_CHANNEL_ID = 'C1234567890';

    const payloads: Array<{ text: string; thread_ts?: string }> = [];
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { text: string; thread_ts?: string };
      payloads.push(body);
      return new Response('{"ok":true,"ts":"1742600000.123456"}', { status: 200 });
    }) as typeof fetch;

    const reporter = new PlaywrightSlackReporter({
      errorDetailsInThread: true,
      showErrorDetails: false,
    });
    reporter.onTestEnd?.(
      {
        titlePath: () => ['chromium', 'hide error content bot'],
        parent: { project: () => ({ name: 'chromium' }) },
        location: { file: 'e2e/no-details-bot.spec.ts', line: 5, column: 1 },
      } as any,
      {
        status: 'failed',
        error: {
          message: 'Error: hidden detail\\nExpected: "X"\\nReceived: "Y"',
        },
      } as any,
    );

    await reporter.onEnd?.({ status: 'failed' } as any);

    assert.equal(payloads.length, 1);
    assert.equal(payloads[0].thread_ts, undefined);
    assert.doesNotMatch(payloads[0].text, /reason:/);
    assert.doesNotMatch(payloads[0].text, /Expected:/);
  });
});
