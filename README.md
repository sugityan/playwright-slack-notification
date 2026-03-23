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
      // 失敗時のみ通知（デフォルト）
      notifyMode: 'failure', // 'failure' | 'always'
      channel: '#ci',
      // CI環境でのみ通知を送る（デフォルト: false）
      ciOnly: true,
    }],
  ],
  // ... 他の設定
});
```

`notifyMode` の指定:

- `failure`: 失敗時のみ Slack 通知
- `always`: 成功/失敗に関わらず Slack 通知

`ciOnly` オプション:

- `true`: CI環境でのみSlack通知を送る（ローカル環境では送信しない）
- `false`: すべての環境でSlack通知を送る（デフォルト値）

CI環境の判定は、`process.env.CI` が `'true'` または `'1'` かどうかで行われます。
GitHub Actions, GitLab CI, CircleCI などの主要なCIサービスでは、この環境変数が自動的に設定されます。
- `false`: すべての環境でSlack通知を送る（デフォルト値）

CI環境の判定は、`process.env.CI` が `'true'` または `'1'` かどうかで行われます。
GitHub Actions, GitLab CI, CircleCI などの主要なCIサービスでは、この環境変数が自動的に設定されます。

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
