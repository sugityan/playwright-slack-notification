## @sugityan/playwright-slack-notification

Playwright / CI スクリプトから Slack（Incoming Webhook）へ通知するための npm package です。

## 使い方

### 1. インストール

```bash
npm i @sugityan/playwright-slack-notification
```

### 2. 通知方式を選んで設定する

この package には 2 つの設定方式があります。

- **A. Incoming Webhook 方式**: シンプル。スレッド投稿は不可
- **B. Slack Bot Token 方式**: スレッド投稿（エラー理由）が可能

#### A. Incoming Webhook 方式

`.env` に Webhook URL を設定します（`webhookUrl` をコードで直接渡す場合は省略可能です）：

```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR_WEBHOOK_URL
```

#### B. Slack Bot Token 方式（スレッド投稿したい場合）

`.env` に Bot Token と Channel ID を設定します：

```env
SLACK_BOT_TOKEN=xoxb-...
SLACK_BOT_CHANNEL_ID=C1234567890
```

必要な Bot Scope（OAuth & Permissions）:

- `chat:write`（必須）
- `chat:write.public`（任意: Bot 未参加の public channel に投稿する場合）

Bot 方式を使う場合、Webhook URL (`SLACK_WEBHOOK_URL`) は不要です。
### 3. 通常通知を送る

アプリコードで以下のように呼び出します。環境変数 `SLACK_WEBHOOK_URL` が自動的に使用されます：

```ts
import { sendNotification } from '@sugityan/playwright-slack-notification';

await sendNotification('E2E tests passed ✅');
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
  testDir: './tests',
  // ... 他の設定
});
```

#### 4-2. Reporter を設定

Reporter を `playwright.config.ts` に設定します：

```ts
export default defineConfig({
  reporter: [
    ['list'],
    ['@sugityan/playwright-slack-notification/reporter', {
      // 失敗時のみ通知（デフォルト）
      notifyMode: 'failure', // 'failure' | 'always'

      // エラー内容（reason/details）を表示するか
      showErrorDetails: true,

      channel: '#ci',
    }],
  ],
  // ... 他の設定
});
```

Webhook 方式で使う場合は上記のみで OK です。

Bot 方式でスレッド投稿したい場合は `errorDetailsInThread: true` を指定します：

```ts
export default defineConfig({
  reporter: [
    ['list'],
    ['@sugityan/playwright-slack-notification/reporter', {
      notifyMode: 'failure',
      showErrorDetails: true,
      errorDetailsInThread: true,
    }],
  ],
});
```

`notifyMode` の指定:

- `failure`: 失敗時のみ Slack 通知
- `always`: 成功/失敗に関わらず Slack 通知

`errorDetailsInThread` の指定:

- `false` (デフォルト): エラー詳細をメイン通知本文に含める
- `true`: Slack bot user でエラー理由をスレッド投稿する

`showErrorDetails` の指定（Webhook / Bot 共通）:

- `true` (デフォルト): エラー内容を表示
- `false`: エラー内容を非表示（テスト名や件数のみ通知）

Slack bot user でスレッド投稿する場合は、以下を設定してください。

```env
SLACK_BOT_TOKEN=xoxb-...
SLACK_BOT_CHANNEL_ID=C1234567890
```

`SLACK_BOT_TOKEN` / `SLACK_BOT_CHANNEL_ID` が未指定の場合は、エラー詳細は本文表示にフォールバックします。

スレッド投稿は **Bot 方式のときのみ** 利用できます（Webhook 方式では不可）。

thread に投稿される内容は「失敗したテストのエラー理由のみ」です。

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
