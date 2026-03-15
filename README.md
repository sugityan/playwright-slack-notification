## @sugityan/playwright-slack-notification

Send Slack notifications (Incoming Webhooks) from Playwright/CI scripts.

## Usage

### 1. Install

```bash
npm i @sugityan/playwright-slack-notification
```

### 2. Set `SLACK_WEBHOOK_URL`

Create `.env`:

```bash
cp .env.example .env
```

Set your Slack Incoming Webhook URL in `.env`:

```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### 3. Send a message

In your app:

```ts
import { sendNotification } from '@sugityan/playwright-slack-notification';

await sendNotification('E2E tests passed ✅');
```

With blocks/attachments:

```ts
await sendNotification('Build finished', {
  channel: '#ci',
  blocks: [
    { type: 'section', text: { type: 'mrkdwn', text: '*Build finished*' } },
  ],
  attachments: [{ fallback: 'Build finished' }],
});
```

### 4. Local check (from this repo)

Send a test notification:

```bash
npm run slack:test
npm run slack:test -- "任意のメッセージ"
```
