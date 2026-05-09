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
          message: 'Error: expect(page).toHaveTitle(expected) failed',
          stack:
            'Error: expect(page).toHaveTitle(expected) failed\nExpected: "Playwright"\nReceived: "Playwright E2E"\n    at e2e/basic.spec.ts:3:5',
        },
      } as any,
    );

    await reporter.onEnd?.({ status: 'failed' } as any);

    const payload = JSON.parse(seen.body) as { text: string };
    assert.equal(typeof payload.text, 'string');
    assert.match(payload.text, /Playwright E2E result: failed/);
    assert.match(payload.text, /:large_green_circle: Passed: 0/);
    assert.match(payload.text, /:red_circle: Failed: 1/);
    assert.match(payload.text, /:red_circle:/);
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
          message: 'Error: expect(page).toHaveTitle(expected) failed',
          stack:
            'Error: expect(page).toHaveTitle(expected) failed\n\n  8 | test("thread details test", async ({ page }) => {\n  9 |   await page.goto("https://example.com");\n> 10 |   await expect(page).toHaveTitle("Wrong Title");\n    |         ^\n  11 | });\n\nExpected: "Playwright"\nReceived: "Playwright E2E"\n    at e2e/thread.spec.ts:10:2',
        },
      } as any,
    );

    await reporter.onEnd?.({ status: 'failed' } as any);

    assert.equal(payloads.length, 2);
    assert.equal(payloads[0].thread_ts, undefined);
    assert.match(payloads[0].text, /Playwright E2E result: failed/);
    assert.match(payloads[0].text, /:large_green_circle: Passed: 0/);
    assert.match(payloads[0].text, /:red_circle: Failed: 1/);
    
    // Main post should contain only test name (not full path) with red circle
    assert.match(payloads[0].text, /:red_circle: thread details test/);
    assert.doesNotMatch(payloads[0].text, /chromium › thread details test/);
    assert.doesNotMatch(payloads[0].text, /e2e\/thread\.spec\.ts/);
    
    // Thread post should contain full details including code snippet
    assert.equal(payloads[1].thread_ts, '1742600000.123456');
    assert.match(payloads[1].text, /\*\*chromium › thread details test\*\*/);
    assert.match(payloads[1].text, /chromium e2e\/thread\.spec\.ts:10:2/);
    assert.match(payloads[1].text, /```/);
    assert.match(payloads[1].text, /Expected: "Playwright"/);
    assert.match(payloads[1].text, /Received: "Playwright E2E"/);
    // Should contain code snippet
    assert.match(payloads[1].text, />.*10.*await expect\(page\)\.toHaveTitle/);
    assert.doesNotMatch(payloads[1].text, /Failed test error reasons:/);
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

  it('does not send when errorDetailsInThread is true but bot settings are missing', async () => {
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

    // Should not send any notification when errorDetailsInThread is true but bot config is missing
    assert.equal(payloads.length, 0);
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

  it('converts absolute file paths to relative paths', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://example.invalid/webhook';

    const seen = { body: '' };
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      seen.body = String(init?.body ?? '');
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const cwd = process.cwd();
    const absolutePath = `${cwd}/apps/web/e2e/contact-form.spec.ts`;

    const reporter = new PlaywrightSlackReporter();
    reporter.onTestEnd?.(
      {
        titlePath: () => ['chromium', 'contact form', 'submit form'],
        parent: { project: () => ({ name: 'web' }) },
        location: { file: absolutePath, line: 114, column: 1 },
      } as any,
      {
        status: 'failed',
        error: {
          message: 'Error: Form submission failed',
        },
      } as any,
    );

    await reporter.onEnd?.({ status: 'failed' } as any);

    const payload = JSON.parse(seen.body) as { text: string };
    assert.equal(typeof payload.text, 'string');
    // Should contain relative path, not absolute path
    assert.match(payload.text, /apps\/web\/e2e\/contact-form\.spec\.ts:114:1/);
    // Should NOT contain the full absolute path
    assert.doesNotMatch(payload.text, new RegExp(cwd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });

  it('posts multiple errors with test names in thread', async () => {
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
    
    // First failure
    reporter.onTestEnd?.(
      {
        titlePath: () => ['chromium', 'login test'],
        parent: { project: () => ({ name: 'chromium' }) },
        location: { file: 'e2e/auth.spec.ts', line: 15, column: 1 },
      } as any,
      {
        status: 'failed',
        error: {
          message: 'Error: Login failed\nLocator timeout',
        },
      } as any,
    );
    
    // Second failure
    reporter.onTestEnd?.(
      {
        titlePath: () => ['firefox', 'form test'],
        parent: { project: () => ({ name: 'firefox' }) },
        location: { file: 'e2e/form.spec.ts', line: 25, column: 1 },
      } as any,
      {
        status: 'failed',
        error: {
          message: 'Error: Form submission failed\nExpected 200, received 500',
        },
      } as any,
    );

    await reporter.onEnd?.({ status: 'failed' } as any);

    assert.equal(payloads.length, 2);
    
    // Main post should contain only test names (not full paths)
    const mainText = payloads[0].text;
    assert.match(mainText, /:red_circle: login test/);
    assert.match(mainText, /:red_circle: form test/);
    assert.doesNotMatch(mainText, /chromium › login test/);
    assert.doesNotMatch(mainText, /e2e\/auth\.spec\.ts/);
    assert.doesNotMatch(mainText, /e2e\/form\.spec\.ts/);
    
    // Thread post should contain full details
    assert.equal(payloads[1].thread_ts, '1742600000.123456');
    const threadText = payloads[1].text;
    
    // Should contain both test names with full paths
    assert.match(threadText, /\*\*chromium › login test\*\*/);
    assert.match(threadText, /\*\*firefox › form test\*\*/);
    
    // Should contain both locations
    assert.match(threadText, /e2e\/auth\.spec\.ts:15:1/);
    assert.match(threadText, /e2e\/form\.spec\.ts:25:1/);
    
    // Should contain both error messages
    assert.match(threadText, /Login failed/);
    assert.match(threadText, /Form submission failed/);
    
    // Should have code blocks
    const codeBlockCount = (threadText.match(/```/g) || []).length;
    assert.equal(codeBlockCount, 4); // 2 errors × 2 code blocks (open and close)
  });

  it('posts separate thread messages per test when splitThreadMessagePerTest is true', async () => {
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
      if (calls.count === 2) {
        return new Response('{"ok":true,"ts":"1742600001.123456"}', { status: 200 });
      }
      return new Response('{"ok":true,"ts":"1742600002.123456"}', { status: 200 });
    }) as typeof fetch;

    const reporter = new PlaywrightSlackReporter({
      errorDetailsInThread: true,
      splitThreadMessagePerTest: true,
    });
    
    // First failure
    reporter.onTestEnd?.(
      {
        titlePath: () => ['chromium', 'login test'],
        parent: { project: () => ({ name: 'chromium' }) },
        location: { file: 'e2e/auth.spec.ts', line: 15, column: 1 },
      } as any,
      {
        status: 'failed',
        error: {
          message: 'Error: Login failed\nLocator timeout',
        },
      } as any,
    );
    
    // Second failure
    reporter.onTestEnd?.(
      {
        titlePath: () => ['firefox', 'form test'],
        parent: { project: () => ({ name: 'firefox' }) },
        location: { file: 'e2e/form.spec.ts', line: 25, column: 1 },
      } as any,
      {
        status: 'failed',
        error: {
          message: 'Error: Form submission failed\nExpected 200, received 500',
        },
      } as any,
    );

    await reporter.onEnd?.({ status: 'failed' } as any);

    // Should make 3 API calls: 1 main message + 2 thread messages
    assert.equal(payloads.length, 3);
    
    // Main post should contain only test names (not full paths)
    const mainText = payloads[0].text;
    assert.equal(payloads[0].thread_ts, undefined);
    assert.match(mainText, /:red_circle: login test/);
    assert.match(mainText, /:red_circle: form test/);
    assert.doesNotMatch(mainText, /chromium › login test/);
    assert.doesNotMatch(mainText, /e2e\/auth\.spec\.ts/);
    assert.doesNotMatch(mainText, /e2e\/form\.spec\.ts/);
    
    // First thread message should contain only first test details
    assert.equal(payloads[1].thread_ts, '1742600000.123456');
    const firstThreadText = payloads[1].text;
    assert.match(firstThreadText, /\*\*chromium › login test\*\*/);
    assert.match(firstThreadText, /e2e\/auth\.spec\.ts:15:1/);
    assert.match(firstThreadText, /Login failed/);
    assert.match(firstThreadText, /```/);
    // Should NOT contain second test details
    assert.doesNotMatch(firstThreadText, /firefox › form test/);
    assert.doesNotMatch(firstThreadText, /e2e\/form\.spec\.ts/);
    assert.doesNotMatch(firstThreadText, /Form submission failed/);
    
    // Second thread message should contain only second test details
    assert.equal(payloads[2].thread_ts, '1742600000.123456');
    const secondThreadText = payloads[2].text;
    assert.match(secondThreadText, /\*\*firefox › form test\*\*/);
    assert.match(secondThreadText, /e2e\/form\.spec\.ts:25:1/);
    assert.match(secondThreadText, /Form submission failed/);
    assert.match(secondThreadText, /```/);
    // Should NOT contain first test details
    assert.doesNotMatch(secondThreadText, /chromium › login test/);
    assert.doesNotMatch(secondThreadText, /e2e\/auth\.spec\.ts/);
    assert.doesNotMatch(secondThreadText, /Login failed/);
  });

  it('does not send when splitThreadMessagePerTest is true but bot is not configured', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://example.invalid/webhook';
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_BOT_CHANNEL_ID;

    const payloads: Array<{ text: string }> = [];
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      payloads.push(JSON.parse(String(init?.body ?? '{}')) as { text: string });
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const reporter = new PlaywrightSlackReporter({
      errorDetailsInThread: true,
      splitThreadMessagePerTest: true,
    });
    
    reporter.onTestEnd?.(
      {
        titlePath: () => ['chromium', 'first test'],
        parent: { project: () => ({ name: 'chromium' }) },
        location: { file: 'e2e/test1.spec.ts', line: 10, column: 1 },
      } as any,
      {
        status: 'failed',
        error: {
          message: 'Error: first error',
        },
      } as any,
    );
    
    reporter.onTestEnd?.(
      {
        titlePath: () => ['firefox', 'second test'],
        parent: { project: () => ({ name: 'firefox' }) },
        location: { file: 'e2e/test2.spec.ts', line: 20, column: 1 },
      } as any,
      {
        status: 'failed',
        error: {
          message: 'Error: second error',
        },
      } as any,
    );

    await reporter.onEnd?.({ status: 'failed' } as any);

    // Should not send any notification when errorDetailsInThread is true but bot config is missing
    assert.equal(payloads.length, 0);
  });

  it('displays detailed timeout error with code snippet in thread', async () => {
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
        titlePath: () => ['chromium', 'timeout test'],
        parent: { project: () => ({ name: 'chromium' }) },
        location: { file: 'e2e/timeout.spec.ts', line: 10, column: 2 },
      } as any,
      {
        status: 'timedOut',
        error: {
          message: 'Test timeout of 30000ms exceeded.',
        },
        errors: [
          {
            message: 'Test timeout of 30000ms exceeded.',
          },
          {
            message: 'page.click: Timeout 30000ms exceeded.',
            stack:
              'Error: page.click: Timeout 30000ms exceeded.\n\n  10 |   await page.goto(\'/\');\n> 11 |   await page.click(\'#submit-button\');\n     |              ^\n  12 | });\n\n    at e2e/timeout.spec.ts:11:14',
          },
        ],
      } as any,
    );

    await reporter.onEnd?.({ status: 'failed' } as any);

    assert.equal(payloads.length, 2);
    
    // Main message should contain test name
    assert.match(payloads[0].text, /timeout test/);
    assert.equal(payloads[0].thread_ts, undefined);
    
    // Thread message should contain detailed timeout error with code snippet
    assert.equal(payloads[1].thread_ts, '1742600000.123456');
    const threadText = payloads[1].text;
    assert.match(threadText, /Test timeout of 30000ms exceeded/);
    assert.match(threadText, /---/); // Separator between errors
    assert.match(threadText, /page\.click: Timeout 30000ms exceeded/);
    assert.match(threadText, />.*11.*await page\.click/); // Code snippet with line marker
    assert.match(threadText, /timeout\.spec\.ts:11:14/);
  });
});
