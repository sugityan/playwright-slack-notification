## @sugityan/playwright-slack-notification

Send Slack notifications (Incoming Webhooks) from Playwright/CI scripts.

### Install

```bash
npm i @sugityan/playwright-slack-notification
```

### Setup

Create a `.env` file (recommended for local dev) and load it with Node:

```bash
cp .env.example .env
node --env-file=.env --input-type=module -e "import { sendNotification } from './lib/index.js'; await sendNotification('env-file test');"
```

### Usage

```ts
import { sendNotification } from '@sugityan/playwright-slack-notification';

await sendNotification('E2E tests passed ✅');
```

Send a real Slack notification from this repo (loads `SLACK_WEBHOOK_URL` from `.env`):

```bash
npm run slack:test
npm run slack:test -- "任意のメッセージ"
```

With blocks/attachments:

```ts
await sendNotification('Build finished', {
	channel: '#ci',
	blocks: [
		{ type: 'section', text: { type: 'mrkdwn', text: '*Build finished*' } },
	],
});
```

### API

- `sendNotification(message: string, options?: NotificationOptions): Promise<void>`

`NotificationOptions`:
- `channel?: string`
- `blocks?: Record<string, unknown>[]`
- `attachments?: Record<string, unknown>[]`
- `timeoutMs?: number` (default: `10000`)
- `retries?: number` (default: `2`)
- `retryDelayMs?: number` (default: `500`)

Errors:

- `ValidationError`
- `SlackApiError` (has `status` and `responseBody`)
- `NetworkError`

### GitHub Actions (notify only on failure)

1) Add a repository secret named `SLACK_WEBHOOK_URL`.

Note: On PRs from forks, GitHub does not expose secrets to workflows, so Slack notifications are automatically skipped.

2) Use a workflow like this (this repo already includes the same pattern in `.github/workflows/tests.yml`):

```yaml
name: Tests

on:
	push:
		branches: [ main ]
	pull_request:
		branches: [ main ]

jobs:
	build:
		runs-on: ubuntu-latest
		steps:
			- uses: actions/checkout@v4
			- uses: actions/setup-node@v4
				with:
					node-version: 22.x
			- run: npm ci

			- name: Run unit tests
				id: unit
				continue-on-error: true
				run: npm test

			- name: Install Playwright (Chromium)
				run: npx playwright install --with-deps chromium

			- name: Run E2E tests
				id: e2e
				continue-on-error: true
				env:
					SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
				run: npm run test:e2e

			# Unit failures are notified here.
			# E2E failures are notified by the Playwright reporter when SLACK_WEBHOOK_URL is set.
			- name: Notify Slack (unit tests only)
				if: secrets.SLACK_WEBHOOK_URL != '' && steps.unit.outcome == 'failure' && steps.e2e.outcome != 'failure' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository)
				env:
					SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
				run: node ./scripts/slack-send.mjs "CI unit tests failed: ${{ github.repository }} ${{ github.sha }}"

			- name: Fail job if any tests failed
				if: steps.unit.outcome == 'failure' || steps.e2e.outcome == 'failure'
				run: exit 1
```

### Playwright E2E

Install browsers (one-time):

```bash
npm run e2e:install
```

Run E2E tests:

```bash
npm run test:e2e
```

Run E2E tests and notify the result to Slack (local):

```bash
cp .env.example .env
# set SLACK_WEBHOOK_URL in .env
npm run test:e2e:slack

# pass through Playwright CLI args
npm run test:e2e:slack -- --headed
```

Slack notification on E2E failure:

- If `SLACK_WEBHOOK_URL` is set, Playwright will load the built-in reporter at `e2e/slack-reporter.ts`.
- When any E2E test fails, it sends a summary message via `sendNotification`.

Environment variables:

- `SLACK_WEBHOOK_URL`: required to send notifications.
- `PLAYWRIGHT_SLACK_NOTIFY`: `failure` (default) or `always`.
