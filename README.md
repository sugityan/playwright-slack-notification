## @sugityan/playwright-slack-notification

Playwright / CI スクリプトから Slack（Incoming Webhook）へ通知するための npm package です。

## 使い方

### 1. インストール

```bash
npm i @sugityan/playwright-slack-notification
```

### 2. Slack Webhook URL を設定

`.env` に Slack Incoming Webhook URL を設定します（`webhookUrl` をコードで直接渡す場合は省略可能です）：

```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR_WEBHOOK_URL
```

### 3. 通常通知を送る

アプリコードで以下のように呼び出します：

```ts
import { sendNotification } from '@sugityan/playwright-slack-notification';

await sendNotification('E2E tests passed ✅');

// または webhookUrl を直接指定
await sendNotification('E2E tests passed ✅', {
  webhookUrl: 'https://hooks.slack.com/services/...',
});
```

`blocks` / `attachments` を使う場合：

```ts
await sendNotification('Build finished', {
  channel: '#ci',
  blocks: [
    { type: 'section', text: { type: 'mrkdwn', text: '*Build finished*' } },
  ],
  attachments: [{ fallback: 'Build finished' }],
});
```

### 4. Playwright の結果を自動通知する

1) `.env` を読み込めるように `dotenv` をインストールします：

```bash
npm i -D dotenv
```

2) この package が提供する Reporter を `playwright.config.ts` に設定します：

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  reporter: [
    ['list'],
    ['@sugityan/playwright-slack-notification/reporter', {
      // 失敗時のみ通知（デフォルト）
      notifyMode: 'failure', // 'failure' | 'always'
      channel: '#ci',
    }],
  ],
});
```

`notifyMode` の指定:

- `failure`: 失敗時のみ Slack 通知
- `always`: 成功/失敗に関わらず Slack 通知

3) Playwright を実行します：

```bash
npx playwright test
```

### 5. このリポジトリでの動作確認

テスト通知を送るコマンド：

```bash
npm run slack:test
npm run slack:test -- "任意のメッセージ"
```
