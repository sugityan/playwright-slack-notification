## @sugityan/playwright-slack-notification

Playwright / CI スクリプトから Slack（Incoming Webhook）へ通知するための npm package です。

## 使い方

### 1. インストール

```bash
npm i @sugityan/playwright-slack-notification
```

### 2. Slack Webhook URL を設定

プロジェクトの**ルートディレクトリ**に `.env` ファイルを作成します：

```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR_WEBHOOK_URL
```
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

#### 4-1. `.env` ファイルを読み込む

Playwright が `.env` ファイルを読み込むよう設定する必要があります。`dotenv` をインストール：

```bash
npm install -D dotenv
```

`playwright.config.ts` で `.env` を読み込みます：

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

// .env ファイルを読み込む
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
      // 任意設定
      notifyMode: 'failure', // 'failure' | 'always'
      channel: '#ci',
    }],
  ],
  // ... 他の設定
});
```

### 5. このリポジトリでの動作確認

テスト通知を送るコマンド：

```bash
npm run slack:test
npm run slack:test -- "任意のメッセージ"
```
