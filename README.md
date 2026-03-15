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

2) Use a workflow like this (this repo already includes the same pattern in `.github/workflows/tests.yml`):

```yaml
name: Tests

on:
	push:
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

			- name: Run tests
				id: test
				continue-on-error: true
				run: npm test

			- name: Notify Slack (only on failure)
				if: steps.test.outcome == 'failure'
				env:
					SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
				run: node ./scripts/slack-send.mjs "CI failed: ${{ github.repository }} ${{ github.sha }}"

			- name: Fail job if tests failed
				if: steps.test.outcome == 'failure'
				run: exit 1
```
